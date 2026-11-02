$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$node = 'C:\Program Files\nodejs\node.exe'
if (-not (Test-Path -LiteralPath $node)) { throw 'Install Node.js first.' }
if (-not (Test-Path -LiteralPath (Join-Path $root 'node_modules\tsx'))) { throw 'ATracker dependencies must be installed first.' }
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$name = "ATracker helper $sid"
New-Item -ItemType Directory -Force -Path (Join-Path $root 'data\logs') | Out-Null
$hidden = Join-Path $PSScriptRoot 'run-hidden.vbs'
$runner = Join-Path $PSScriptRoot 'run-helper.ps1'
$powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$action = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\wscript.exe') -Argument "`"$hidden`" `"$powerShell`" -NoProfile -ExecutionPolicy Bypass -File `"$runner`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'ATracker local helper, hidden at logon; restarts on failure.' -Force | Out-Null
Start-ScheduledTask -TaskName $name
