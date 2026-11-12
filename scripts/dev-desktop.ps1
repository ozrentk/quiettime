$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if (Test-Path (Join-Path $projectRoot '.tools/cargo/bin/cargo.exe')) {
    $env:CARGO_HOME = Join-Path $projectRoot '.tools/cargo'
    $env:RUSTUP_HOME = Join-Path $projectRoot '.tools/rustup'
    $env:PATH = "$env:CARGO_HOME/bin;$env:PATH"
}
Set-Location $projectRoot
& npm.cmd run tauri -- dev
exit $LASTEXITCODE
