#requires -Version 5.1
<#
.SYNOPSIS
  Start / stop / restart the Prezzo Vite dev server on Windows, detached and LAN-accessible.

.DESCRIPTION
  `npm run dev` works on Windows, but this helper adds the things an
  agent-driven or remote-presenting workflow needs that npm cannot give you:
   - A detached, hidden process that survives the shell/session that launched it
     (agent-launched background tasks get reaped at turn boundaries).
   - The server MUST bind to 0.0.0.0 (the default in vite.config.ts) for phone
     remote control. Never pass --host 127.0.0.1: that breaks remote control.
   - PID tracking for a clean stop, plus the local + LAN control URLs printed on
     start and a firewall-rule check.

  This launches node node_modules/vite/bin/vite.js directly as a detached, hidden
  process, lets vite.config.ts supply host/port, records the PID, and prints the
  local + LAN control URLs.

.PARAMETER Command
  start (default) | stop | restart | status

.PARAMETER Deck
  Initial deck slug for VITE_PREZZO_DECK (default: prezzo-demo). Affects the deck
  the remote PIN is printed for; the server still serves every deck.

.EXAMPLE
  powershell -NoProfile -File scripts/dev.ps1 start
  powershell -NoProfile -File scripts/dev.ps1 stop
  powershell -NoProfile -File scripts/dev.ps1 restart -Deck prezzo-demo
#>
param(
  [ValidateSet('start', 'stop', 'restart', 'status')]
  [string]$Command = 'start',
  [string]$Deck = 'prezzo-demo'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Port = 5173
$PidFile = Join-Path $env:TEMP 'prezzo-dev.pid'
$ViteBin = Join-Path $RepoRoot 'node_modules/vite/bin/vite.js'
$FirewallRule = 'Prezzo dev 5173'

function Get-LanAddress {
  # Prefer the interface that owns the default route (the real Wi-Fi/Ethernet NIC),
  # so we don't return a Hyper-V/WSL virtual adapter (e.g. 172.x.x.1).
  $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
    Sort-Object RouteMetric, ifMetric | Select-Object -First 1
  if ($route) {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.ifIndex -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1
    if ($ip) { return $ip.IPAddress }
  }
  $fallback = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } |
    Select-Object -First 1
  if ($fallback) { $fallback.IPAddress } else { 'localhost' }
}

function Get-ViteProcess {
  # Prefer the recorded PID; fall back to matching the vite command line.
  if (Test-Path $PidFile) {
    $savedPid = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($savedPid) {
      $p = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
      if ($p) { return $p }
    }
  }
  $match = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*vite*' -and $_.CommandLine -like '*bin/vite.js*' } |
    Select-Object -First 1
  if ($match) { Get-Process -Id $match.ProcessId -ErrorAction SilentlyContinue }
}

function Test-Listening {
  $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Show-Status {
  if (Test-Listening) {
    $lan = Get-LanAddress
    Write-Host "Prezzo dev server: UP on port $Port"
    Write-Host "  Local:   http://127.0.0.1:$Port/$Deck/"
    Write-Host "  LAN:     http://${lan}:$Port/$Deck/"
    Write-Host "  Control: http://${lan}:$Port/$Deck/control"
    if (-not (Get-NetFirewallRule -DisplayName $FirewallRule -ErrorAction SilentlyContinue)) {
      Write-Host "  NOTE: no firewall rule '$FirewallRule'. Phone remote may be blocked." -ForegroundColor Yellow
      Write-Host "        Create it once: powershell -File scripts/open-firewall.ps1 (elevates via UAC)." -ForegroundColor Yellow
    }
  } else {
    Write-Host "Prezzo dev server: DOWN"
  }
}

function Stop-Server {
  $p = Get-ViteProcess
  if ($p) {
    Stop-Process -Id $p.Id -Force
    Write-Host "Stopped Prezzo dev server (PID $($p.Id))"
  } else {
    Write-Host "No Prezzo dev server process found"
  }
  Remove-Item $PidFile -ErrorAction SilentlyContinue
}

function Start-Server {
  if (Test-Listening) { Write-Host "Already UP on port $Port"; Show-Status; return }
  if (-not (Test-Path $ViteBin)) { throw "vite not found at $ViteBin. Run 'npm install' first." }

  $env:VITE_PREZZO_DECK = $Deck
  # No --host: vite.config.ts already binds 0.0.0.0 (required for remote control).
  $proc = Start-Process -FilePath 'node' -ArgumentList $ViteBin `
    -WorkingDirectory $RepoRoot -WindowStyle Hidden -PassThru
  Set-Content -Path $PidFile -Value $proc.Id

  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 400
    if (Test-Listening) { break }
  }
  if (Test-Listening) { Write-Host "Started Prezzo dev server (PID $($proc.Id))"; Show-Status }
  else { throw "Server did not come up on port $Port within timeout." }
}

switch ($Command) {
  'start'   { Start-Server }
  'stop'    { Stop-Server }
  'restart' { Stop-Server; Start-Sleep -Milliseconds 600; Start-Server }
  'status'  { Show-Status }
}
