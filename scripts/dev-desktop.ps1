$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if (Test-Path (Join-Path $projectRoot '.tools/cargo/bin/cargo.exe')) {
    $env:CARGO_HOME = Join-Path $projectRoot '.tools/cargo'
    $env:RUSTUP_HOME = Join-Path $projectRoot '.tools/rustup'
    $env:PATH = "$env:CARGO_HOME/bin;$env:PATH"
}
Set-Location $projectRoot
# Prevent a second launcher for this workspace from taking over the first session.
$pathHasher = [System.Security.Cryptography.SHA256]::Create()
try {
    $workspaceHash = [BitConverter]::ToString($pathHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($projectRoot.ToLowerInvariant()))).Replace('-', '')
} finally { $pathHasher.Dispose() }
$launcherMutex = [Threading.Mutex]::new($false, "Local\QuietTime.Development.$workspaceHash")
$ownsLauncher = $false
try {
    try { $ownsLauncher = $launcherMutex.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $ownsLauncher = $true }
    if (!$ownsLauncher) { throw 'A development launcher is already running for this workspace. Stop it before starting another.' }
    $launcherProcess = Get-Process -Id $PID
    $env:QUIET_TIME_DEV_LAUNCHER_PID = [string]$PID
    $env:QUIET_TIME_DEV_LAUNCHER_STARTED = [string]$launcherProcess.StartTime.ToFileTimeUtc()
    & npm.cmd run tauri -- dev
    $developmentExitCode = $LASTEXITCODE
} finally {
    if ($ownsLauncher) { $launcherMutex.ReleaseMutex() }
    $launcherMutex.Dispose()
}
exit $developmentExitCode
