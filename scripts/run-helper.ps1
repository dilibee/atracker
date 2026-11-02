$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
New-Item -ItemType Directory -Force -Path 'data\logs' | Out-Null
$log = Join-Path 'data\logs' ("helper-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))
try {
    # Keep this process alive so Task Scheduler sees failures and can restart it.
    & 'C:\Program Files\nodejs\node.exe' --import tsx scripts/helper.ts >> $log 2>&1
    exit $LASTEXITCODE
} catch {
    $_ | Out-File -FilePath $log -Append
    exit 1
}
