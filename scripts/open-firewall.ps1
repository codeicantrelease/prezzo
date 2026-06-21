<#
.SYNOPSIS
    Opens the Windows Firewall for the prezzo Vite dev server (port 5173).
.DESCRIPTION
    Adds an inbound Allow rule on TCP 5173, scoped to the Private network
    profile only, so other devices on a trusted LAN can reach the dev server
    and the remote-control URLs. Self-elevates via UAC if not already running
    as Administrator. Idempotent: skips creation if the rule already exists.
.NOTES
    Remove the rule with scripts/close-firewall.ps1. The rule name matches the
    one scripts/dev.ps1 checks for in its status output.
#>
[CmdletBinding()]
param(
    [int]$Port = 5173,
    [string]$RuleName = "Prezzo dev 5173"
)

$ErrorActionPreference = "Stop"

# Self-elevate if not already Administrator.
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltinRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Elevating (accept the UAC prompt)..."
    $elevateArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Port $Port -RuleName `"$RuleName`""
    Start-Process powershell -Verb RunAs -ArgumentList $elevateArgs -Wait
    return
}

if (Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue) {
    Write-Host "Rule '$RuleName' already exists. Nothing to do."
    return
}

New-NetFirewallRule `
    -DisplayName $RuleName `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $Port `
    -Action Allow `
    -Profile Private | Out-Null

Write-Host "Created inbound Allow rule '$RuleName' for TCP $Port (Private profile)."
