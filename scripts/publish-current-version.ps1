$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$Root = Get-Location
$gh = (Get-Command gh.exe -ErrorAction SilentlyContinue).Source
if (-not $gh -and (Test-Path 'C:\Program Files\GitHub CLI\gh.exe')) { $gh = 'C:\Program Files\GitHub CLI\gh.exe' }
$git = (Get-Command git.exe -ErrorAction SilentlyContinue).Source
if (-not $git -and (Test-Path 'C:\Program Files\Git\cmd\git.exe')) { $git = 'C:\Program Files\Git\cmd\git.exe' }
if (-not $gh -or -not $git) { throw 'Run CONNECT_GITHUB_AND_PUBLISH.cmd first.' }
if (-not (Test-Path '.git')) { throw 'This folder is not connected to GitHub. Run CONNECT_GITHUB_AND_PUBLISH.cmd first.' }
$package = Get-Content 'package.json' -Raw | ConvertFrom-Json
$version = [string]$package.version
$tag = "v$version"
$origin = (& $git remote get-url origin).Trim()
if (-not $origin) { throw 'Git origin is missing.' }
& $git add -A
& $git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { & $git commit -m "Director v$version" }
& $git push origin main
& $git ls-remote --exit-code --tags origin "refs/tags/$tag" *> $null
if ($LASTEXITCODE -eq 0) { throw "$tag already exists. Bump package.json version before publishing a new release." }
& $git tag $tag
& $git push origin $tag
Write-Host "Published $tag. GitHub Actions is building the update." -ForegroundColor Green
$repo = (& $gh repo view --json nameWithOwner --jq '.nameWithOwner').Trim()
Start-Process "https://github.com/$repo/actions"
Read-Host 'Press Enter to close'
