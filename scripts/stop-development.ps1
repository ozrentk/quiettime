$ErrorActionPreference = 'Stop'
$launcherPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'dev-desktop.ps1')).Replace('/', '\')
# F5 launches this exact absolute script path. Do not stop other workspaces or standalone apps.
$launcherPattern = '(?i)-File\s+"?' + [regex]::Escape($launcherPath) + '"?\s*$'
$launchers = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.Replace('/', '\') -match $launcherPattern
}
foreach ($candidate in $launchers) {
    $launcher = Get-Process -Id $candidate.ProcessId -ErrorAction SilentlyContinue
    if (!$launcher) { continue }
    try {
        # Retain a process handle and verify creation time before stopping it to avoid PID reuse.
        $launcherHandle = $launcher.Handle
        if ([Math]::Abs(($launcher.StartTime.ToUniversalTime() - $candidate.CreationDate.ToUniversalTime()).TotalMilliseconds) -gt 1) { continue }
        if (!$launcher.HasExited) { Stop-Process -InputObject $launcher -Force }
    } catch [Microsoft.PowerShell.Commands.ProcessCommandException] {
        # The launcher may have exited between discovery and opening its handle.
    } finally { $launcher.Dispose() }
}
