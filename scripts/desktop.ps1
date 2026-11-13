param([switch]$BuildOnly, [switch]$Rebuild)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if (Test-Path (Join-Path $projectRoot '.tools/cargo/bin/cargo.exe')) {
    $env:CARGO_HOME = Join-Path $projectRoot '.tools/cargo'
    $env:RUSTUP_HOME = Join-Path $projectRoot '.tools/rustup'
    $env:PATH = "$env:CARGO_HOME/bin;$env:PATH"
}
Set-Location $projectRoot

# Hash only source/config files, never dependency caches or build outputs.
$sourcePaths = @('src', 'src-tauri/src', 'src-tauri/sql', 'src-tauri/capabilities', 'src-tauri/icons', 'scripts')
$sourceFiles = @(
    foreach ($relativePath in $sourcePaths) {
        Get-ChildItem -LiteralPath (Join-Path $projectRoot $relativePath) -Recurse -File
    }
    foreach ($relativePath in @('package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'vite.config.ts', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock', 'src-tauri/build.rs', 'src-tauri/tauri.conf.json')) {
        $sourcePath = Join-Path $projectRoot $relativePath
        if (Test-Path -LiteralPath $sourcePath) { Get-Item -LiteralPath $sourcePath }
    }
)
$manifest = ($sourceFiles | Sort-Object FullName | ForEach-Object {
    $fileHasher = [System.Security.Cryptography.SHA256]::Create()
    try {
        $fileHash = [BitConverter]::ToString($fileHasher.ComputeHash([System.IO.File]::ReadAllBytes($_.FullName)))
        $_.FullName.Substring($projectRoot.Length) + ':' + $fileHash
    } finally { $fileHasher.Dispose() }
}) -join "`n"
$hasher = [System.Security.Cryptography.SHA256]::Create()
try {
    $fingerprint = [BitConverter]::ToString($hasher.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($manifest)))
} finally { $hasher.Dispose() }
$appDirectory = Join-Path $projectRoot '.tools/desktop'
$executable = Join-Path $appDirectory 'quiet-time.exe'
$stampPath = Join-Path $appDirectory 'source.sha256'
$cachedFingerprint = if (Test-Path -LiteralPath $stampPath) { (Get-Content -LiteralPath $stampPath -Raw).Trim() } else { '' }

if ($Rebuild -or !(Test-Path -LiteralPath $executable) -or $cachedFingerprint -ne $fingerprint) {
    # Do not overwrite an executable that is running. The user may have unsaved input.
    $running = Get-Process -Name 'quiet-time' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $executable }
    if ($running) { throw 'Quit Quiet Time from its tray menu before rebuilding, then run npm run desktop again.' }
    Write-Host 'Building the standalone app (first launch or source changes)...'
    # A separate target keeps hot-reload builds from replacing/locking this binary.
    $env:CARGO_TARGET_DIR = Join-Path $projectRoot 'src-tauri/target/standalone'
    & npm.cmd run tauri -- build --debug --no-bundle -- --locked
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    New-Item -ItemType Directory -Force -Path $appDirectory | Out-Null
    Copy-Item -LiteralPath (Join-Path $env:CARGO_TARGET_DIR 'debug/quiet-time.exe') -Destination $executable -Force
    Set-Content -LiteralPath $stampPath -Value $fingerprint -Encoding ASCII
}

if ($BuildOnly) {
    Write-Host "Standalone app ready: $executable"
} else {
    Write-Host 'Opening Quiet Time...'
    Start-Process -FilePath $executable -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null
}
