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

Banner "Director v0.8.0 - Planner reroll + AI backlog pass"
$git = Find-Exe 'git.exe' @('C:\Program Files\Git\cmd\git.exe','C:\Program Files\Git\bin\git.exe')
$gh = Find-Exe 'gh.exe' @('C:\Program Files\GitHub CLI\gh.exe')
if (-not $git) { throw 'Git was not found.' }
if (-not $gh) { throw 'GitHub CLI was not found.' }

$oldEap = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
& $gh auth status --hostname github.com *> $null
$authExit = $LASTEXITCODE
$ErrorActionPreference = $oldEap
if ($authExit -ne 0) {
  & $gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) { throw 'GitHub login was not completed.' }
}

$owner = 'EgorPos'
$repo = 'BankaiDirector'
$fullRepo = "$owner/$repo"
& $gh repo view $fullRepo --json name *> $null
if ($LASTEXITCODE -ne 0) { throw "GitHub repository $fullRepo was not found." }

$package = Get-Content (Join-Path $SourceRoot 'package.json') -Raw | ConvertFrom-Json
$version = [string]$package.version
if ($version -ne '0.8.0') { throw "This package must be v0.8.0, found $version." }
$tag = "v$version"

$tempRoot = Join-Path $env:TEMP ("DirectorReleaseRepair-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempRoot | Out-Null
$cloneDir = Join-Path $tempRoot 'repo'

try {
  Write-Host "Cloning $fullRepo..." -ForegroundColor Cyan
  & $gh repo clone $fullRepo $cloneDir -- --branch main
  if ($LASTEXITCODE -ne 0) { throw 'Could not clone Director repository.' }

  Push-Location $cloneDir
  try { & $git rm -r -f --ignore-unmatch . *> $null } finally { Pop-Location }

  $skip = @('.git','node_modules','release','dist')
  Get-ChildItem -LiteralPath $SourceRoot -Force | Where-Object { $skip -notcontains $_.Name } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $cloneDir -Recurse -Force
  }

  Push-Location $cloneDir
  try {
    if (-not (& $git config user.name 2>$null)) { & $git config user.name $owner }
    if (-not (& $git config user.email 2>$null)) { & $git config user.email "$owner@users.noreply.github.com" }
    & $git add -A
    & $git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
      & $git commit -m "Director v$version - Planner reroll + AI backlog pass"
      if ($LASTEXITCODE -ne 0) { throw 'Could not commit v0.8.0.' }
    }
    & $git push origin main
    if ($LASTEXITCODE -ne 0) { throw 'Could not push main.' }

    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    & $git ls-remote --exit-code --tags origin "refs/tags/$tag" *> $null
    $tagExists = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $oldEap
    if ($tagExists) { throw "$tag already exists." }

    & $git tag $tag
    & $git push origin $tag
    if ($LASTEXITCODE -ne 0) { throw "Could not push $tag." }
  } finally { Pop-Location }

  Write-Host "$tag pushed. Waiting for GitHub Actions..." -ForegroundColor Cyan
  $runId = $null
  for ($i = 0; $i -lt 24 -and -not $runId; $i++) {
    Start-Sleep -Seconds 5
    $jsonText = & $gh run list --repo $fullRepo --workflow release.yml --limit 10 --json databaseId,headBranch,status 2>$null
    if ($LASTEXITCODE -eq 0 -and $jsonText) {
      try {
        $runs = $jsonText | ConvertFrom-Json
        $match = $runs | Where-Object { $_.headBranch -eq $tag } | Select-Object -First 1
        if ($match) { $runId = [string]$match.databaseId }
      } catch {}
    }
  }

  if (-not $runId) {
    Write-Host "Build was pushed, but watcher did not find it quickly. Opening Actions." -ForegroundColor Yellow
    Start-Process "https://github.com/$fullRepo/actions"
  } else {
    Write-Host "Build found: $runId. Watching..." -ForegroundColor Cyan
    & $gh run watch $runId --repo $fullRepo --exit-status
    if ($LASTEXITCODE -ne 0) {
      & $gh run view $runId --repo $fullRepo --web
      throw 'v0.8.0 release build failed.'
    }
    Banner "Director v0.8.0 published"
    Start-Process "https://github.com/$fullRepo/releases/tag/$tag"
    Write-Host "The release must contain: Director-Setup-0.8.0.exe, its .blockmap, and latest.yml." -ForegroundColor Green
    Write-Host "Installed Director should now detect v0.8.0 through Check now / automatic updater. No manual install should be needed." -ForegroundColor Yellow
  }
}
finally {
  if (Test-Path $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
