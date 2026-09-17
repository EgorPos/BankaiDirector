$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$Root = Get-Location

function Banner($text) {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor DarkMagenta
  Write-Host "  $text" -ForegroundColor Magenta
  Write-Host "============================================================" -ForegroundColor DarkMagenta
  Write-Host ""
}

function Find-Exe([string]$Name, [string[]]$Fallbacks) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($path in $Fallbacks) { if (Test-Path $path) { return $path } }
  return $null
}

function Ensure-WingetPackage([string]$Id, [string]$Label) {
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $winget) { throw "winget is not available. Install $Label manually and run this file again." }
  Write-Host "Installing $Label once..." -ForegroundColor Yellow
  & winget.exe install --id $Id -e --source winget --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw "$Label installation failed (exit $LASTEXITCODE)." }
}

Banner "Director - one-time GitHub update setup"
Write-Host "This creates a PUBLIC GitHub repository containing the Director source code." -ForegroundColor Yellow
Write-Host "That source currently includes the built-in Reytrieve project context used by the AI prompt." -ForegroundColor Yellow
Write-Host "Why public: installed Director can fetch updates without storing a GitHub token on your PC." -ForegroundColor DarkGray
Write-Host "Do not continue if you want the source code to stay private; we can use a separate release repo later." -ForegroundColor DarkGray
$answer = Read-Host "Continue with a public repository? [Y/n]"
if ($answer -and $answer.ToLowerInvariant() -notin @('y','yes','д','да')) {
  Write-Host "Cancelled. Nothing was uploaded." -ForegroundColor Yellow
  exit 0
}

$git = Find-Exe 'git.exe' @('C:\Program Files\Git\cmd\git.exe','C:\Program Files\Git\bin\git.exe')
if (-not $git) {
  Ensure-WingetPackage 'Git.Git' 'Git'
  $git = Find-Exe 'git.exe' @('C:\Program Files\Git\cmd\git.exe','C:\Program Files\Git\bin\git.exe')
}
if (-not $git) { throw 'Git was installed but could not be found. Reboot Windows or install Git manually.' }

$gh = Find-Exe 'gh.exe' @('C:\Program Files\GitHub CLI\gh.exe')
if (-not $gh) {
  Ensure-WingetPackage 'GitHub.cli' 'GitHub CLI'
  $gh = Find-Exe 'gh.exe' @('C:\Program Files\GitHub CLI\gh.exe')
}
if (-not $gh) { throw 'GitHub CLI was installed but could not be found. Reboot Windows or install GitHub CLI manually.' }

Write-Host "Checking GitHub login..." -ForegroundColor Cyan
# gh writes a normal "not logged in" status to stderr. With $ErrorActionPreference='Stop'
# Windows PowerShell can turn that expected stderr into a terminating NativeCommandError.
# Temporarily silence native stderr so we can inspect the exit code ourselves.
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
& $gh auth status --hostname github.com *> $null
$authStatusExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($authStatusExitCode -ne 0) {
  Write-Host "A browser will open for GitHub login. This is the only account login Director setup needs." -ForegroundColor Yellow
  & $gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) { throw 'GitHub login was not completed.' }
}

$owner = (& $gh api user --jq '.login').Trim()
if (-not $owner) { throw 'Could not determine your GitHub username.' }
$defaultRepo = 'LifeDirector'
$repo = Read-Host "Repository name [$defaultRepo]"
if (-not $repo) { $repo = $defaultRepo }
if ($repo -notmatch '^[A-Za-z0-9_.-]+$') { throw 'Repository name may contain only letters, numbers, dot, underscore and dash.' }

$package = Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json
$version = [string]$package.version
if ($version -notmatch '^\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$') { throw "Invalid package version: $version" }
$fullRepo = "$owner/$repo"

if (-not (Test-Path (Join-Path $Root '.git'))) {
  & $git init
  & $git branch -M main
}

# Local identity only; does not change the user's global Git config.
$name = (& $git config user.name 2>$null)
if (-not $name) { & $git config user.name $owner }
$email = (& $git config user.email 2>$null)
if (-not $email) { & $git config user.email "$owner@users.noreply.github.com" }

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
& $gh repo view $fullRepo --json name *> $null
$repoViewExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
$repoExists = ($repoViewExitCode -eq 0)
if (-not $repoExists) {
  Write-Host "Creating public repository $fullRepo..." -ForegroundColor Cyan
  & $gh repo create $fullRepo --public --source . --remote origin --description "Director - local-first personal operating system" 
  if ($LASTEXITCODE -ne 0) { throw 'Could not create GitHub repository.' }
} else {
  Write-Host "Repository $fullRepo already exists." -ForegroundColor DarkGray
  $origin = (& $git remote get-url origin 2>$null)
  if (-not $origin) { & $git remote add origin "https://github.com/$fullRepo.git" }
}

# Persist updater destination for the installed application without touching the encrypted API key.
$settingsDir = Join-Path $env:APPDATA 'Director'
$settingsPath = Join-Path $settingsDir 'director-settings.json'
New-Item -ItemType Directory -Force -Path $settingsDir | Out-Null
if (Test-Path $settingsPath) {
  try { $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json } catch { $settings = [pscustomobject]@{} }
} else { $settings = [pscustomobject]@{} }
function Set-JsonProp($obj, $name, $value) {
  if ($obj.PSObject.Properties.Name -contains $name) { $obj.$name = $value }
  else { $obj | Add-Member -NotePropertyName $name -NotePropertyValue $value }
}
Set-JsonProp $settings 'updateRepoOwner' $owner
Set-JsonProp $settings 'updateRepoName' $repo
Set-JsonProp $settings 'autoUpdateEnabled' $true
Set-JsonProp $settings 'autoDownloadUpdates' $true
$settings | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $settingsPath
Write-Host "Director updater configured for $fullRepo." -ForegroundColor Green

# Commit source.
& $git add -A
& $git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  & $git commit -m "Director v$version"
}
& $git push -u origin main
if ($LASTEXITCODE -ne 0) { throw 'Could not push main branch.' }

$tag = "v$version"
$localTag = (& $git tag --list $tag | Out-String).Trim()
if (-not $localTag) { & $git tag $tag }
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
& $git ls-remote --exit-code --tags origin "refs/tags/$tag" *> $null
$lsRemoteExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
$remoteTagExists = ($lsRemoteExitCode -eq 0)
if (-not $remoteTagExists) {
  Write-Host "Publishing $tag. GitHub will build the Windows installer..." -ForegroundColor Cyan
  & $git push origin $tag
  if ($LASTEXITCODE -ne 0) { throw 'Could not push release tag.' }
} else {
  Write-Host "$tag is already published." -ForegroundColor DarkGray
}

Write-Host "Waiting for GitHub Actions to appear..." -ForegroundColor Cyan
$runId = $null
for ($i = 0; $i -lt 24 -and -not $runId; $i++) {
  Start-Sleep -Seconds 5
  try {
    $runId = (& $gh run list --repo $fullRepo --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId').Trim()
  } catch { $runId = $null }
}

if ($runId) {
  Write-Host "Build found. Watching it until completion..." -ForegroundColor Cyan
  & $gh run watch $runId --repo $fullRepo --exit-status
  if ($LASTEXITCODE -ne 0) {
    Write-Host "GitHub build failed. Opening the run in your browser." -ForegroundColor Red
    & $gh run view $runId --repo $fullRepo --web
    throw 'Release build failed.'
  }
} else {
  Write-Host "The run did not appear quickly enough. Opening GitHub Actions; it may still be starting." -ForegroundColor Yellow
  Start-Process "https://github.com/$fullRepo/actions"
  exit 0
}

Banner "GitHub updates are connected"
Write-Host "Repository: https://github.com/$fullRepo" -ForegroundColor Green
Write-Host "Release:    https://github.com/$fullRepo/releases/tag/$tag" -ForegroundColor Green
Write-Host ""
Write-Host "Now open your INSTALLED Director v0.4, go to Settings and press Check for updates." -ForegroundColor Cyan
Write-Host "It should see Director $version, download it, then offer Restart & Update." -ForegroundColor Cyan
Write-Host ""
Write-Host "From the next release onward, PUBLISH_CURRENT_VERSION.cmd can publish a new version with one double-click." -ForegroundColor DarkGray
Start-Process "https://github.com/$fullRepo/releases/tag/$tag"
Read-Host "Press Enter to close"
