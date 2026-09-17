$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$SourceRoot = (Get-Location).Path

function Banner([string]$Text) {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor DarkMagenta
  Write-Host "  $Text" -ForegroundColor Magenta
  Write-Host "============================================================" -ForegroundColor DarkMagenta
  Write-Host ""
}

function Find-Exe([string]$Name, [string[]]$Fallbacks) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($path in $Fallbacks) { if (Test-Path $path) { return $path } }
  return $null
}

Banner "Director v0.5.2 - repair GitHub release"
Write-Host "This fixes the failed v0.5.1 GitHub Actions release." -ForegroundColor Cyan
Write-Host "It keeps your existing repository and publishes a new v0.5.2 tag." -ForegroundColor DarkGray

$git = Find-Exe 'git.exe' @('C:\Program Files\Git\cmd\git.exe','C:\Program Files\Git\bin\git.exe')
$gh = Find-Exe 'gh.exe' @('C:\Program Files\GitHub CLI\gh.exe')
if (-not $git) { throw 'Git was not found. It should already be installed from the previous setup.' }
if (-not $gh) { throw 'GitHub CLI was not found. It should already be installed from the previous setup.' }

# Confirm GitHub auth without treating normal stderr as a PowerShell exception.
$oldEap = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
& $gh auth status --hostname github.com *> $null
$authExit = $LASTEXITCODE
$ErrorActionPreference = $oldEap
if ($authExit -ne 0) {
  Write-Host "GitHub login is required. A browser will open." -ForegroundColor Yellow
  & $gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) { throw 'GitHub login was not completed.' }
}

$settingsPath = Join-Path $env:APPDATA 'Director\director-settings.json'
$owner = ''
$repo = ''
if (Test-Path $settingsPath) {
  try {
    $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
    $owner = [string]$settings.updateRepoOwner
    $repo = [string]$settings.updateRepoName
  } catch {}
}
if (-not $owner) { $owner = (& $gh api user --jq '.login').Trim() }
if (-not $repo) {
  $repo = Read-Host 'Existing Director repository name [BankaiDirector]'
  if (-not $repo) { $repo = 'BankaiDirector' }
}
if ($owner -notmatch '^[A-Za-z0-9_.-]+$' -or $repo -notmatch '^[A-Za-z0-9_.-]+$') {
  throw "Invalid GitHub repository: $owner/$repo"
}
$fullRepo = "$owner/$repo"

Write-Host "Using repository: $fullRepo" -ForegroundColor Green
$oldEap = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
& $gh repo view $fullRepo --json name *> $null
$repoExit = $LASTEXITCODE
$ErrorActionPreference = $oldEap
if ($repoExit -ne 0) { throw "GitHub repository $fullRepo was not found." }

$package = Get-Content (Join-Path $SourceRoot 'package.json') -Raw | ConvertFrom-Json
$version = [string]$package.version
if ($version -ne '0.5.2') { throw "This repair package must be v0.5.2, found $version." }
$tag = "v$version"

$tempRoot = Join-Path $env:TEMP ("DirectorReleaseRepair-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempRoot | Out-Null
$cloneDir = Join-Path $tempRoot 'repo'

try {
  Write-Host "Cloning existing repository history..." -ForegroundColor Cyan
  & $gh repo clone $fullRepo $cloneDir -- --branch main
  if ($LASTEXITCODE -ne 0) { throw 'Could not clone the existing Director repository.' }

  # Replace tracked working tree with this fixed source, while preserving .git history.
  Push-Location $cloneDir
  try {
    & $git rm -r -f --ignore-unmatch . *> $null
  } finally { Pop-Location }

  $skip = @('.git','node_modules','release','dist')
  Get-ChildItem -LiteralPath $SourceRoot -Force | Where-Object { $skip -notcontains $_.Name } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $cloneDir -Recurse -Force
  }

  Push-Location $cloneDir
  try {
    # Make sure the exact hotfix is in the workflow.
    $workflow = Get-Content '.github\workflows\release.yml' -Raw
    if ($workflow -notmatch '--allow-same-version') { throw 'Hotfix workflow is missing --allow-same-version.' }

    $name = (& $git config user.name 2>$null)
    if (-not $name) { & $git config user.name $owner }
    $email = (& $git config user.email 2>$null)
    if (-not $email) { & $git config user.email "$owner@users.noreply.github.com" }

    & $git add -A
    & $git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
      & $git commit -m "Director v$version - fix release workflow"
      if ($LASTEXITCODE -ne 0) { throw 'Could not commit the v0.5.2 hotfix.' }
    }
    & $git push origin main
    if ($LASTEXITCODE -ne 0) { throw 'Could not push the v0.5.2 hotfix to main.' }

    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    & $git ls-remote --exit-code --tags origin "refs/tags/$tag" *> $null
    $tagExists = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $oldEap
    if ($tagExists) { throw "$tag already exists. Do not overwrite an existing release tag." }

    & $git tag $tag
    & $git push origin $tag
    if ($LASTEXITCODE -ne 0) { throw 'Could not push v0.5.2 release tag.' }
  } finally { Pop-Location }

  Write-Host "v0.5.2 pushed. Waiting for GitHub Actions..." -ForegroundColor Cyan
  $runId = $null
  for ($i = 0; $i -lt 24 -and -not $runId; $i++) {
    Start-Sleep -Seconds 5
    $raw = & $gh run list --repo $fullRepo --workflow release.yml --limit 5 --json databaseId,headBranch,status --jq ".[] | select(.headBranch == \"$tag\") | .databaseId" 2>$null
    if ($raw) { $runId = ($raw | Select-Object -First 1).ToString().Trim() }
  }

  if (-not $runId) {
    Write-Host "The build did not appear quickly enough. Opening GitHub Actions." -ForegroundColor Yellow
    Start-Process "https://github.com/$fullRepo/actions"
    exit 0
  }

  Write-Host "Build found. Watching until completion..." -ForegroundColor Cyan
  & $gh run watch $runId --repo $fullRepo --exit-status
  if ($LASTEXITCODE -ne 0) {
    Write-Host "GitHub build failed. Opening the failed run." -ForegroundColor Red
    & $gh run view $runId --repo $fullRepo --web
    throw 'v0.5.2 release build failed.'
  }

  Banner "Director v0.5.2 published"
  Write-Host "The GitHub Release is ready." -ForegroundColor Green
  Write-Host "Open your installed Director and use Settings -> Check for updates." -ForegroundColor Cyan
  Start-Process "https://github.com/$fullRepo/releases/tag/$tag"
}
finally {
  if (Test-Path $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
