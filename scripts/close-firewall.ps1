<#
.SYNOPSIS
    Removes the Windows Firewall rule for the prezzo Vite dev server (port 5173).
.DESCRIPTION
    Deletes the inbound rule created by scripts/open-firewall.ps1. Self-elevates
    via UAC if not already running as Administrator. Idempotent: no-op if the
    rule is absent.
#>
[CmdletBinding()]
param(
    [string]$RuleName = "Prezzo dev 5173"
)

$ErrorActionPreference = "Stop"

# Self-elevate if not already Administrator.
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltinRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Elevating (accept the UAC prompt)..."
    $elevateArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -RuleName `"$RuleName`""
    Start-Process powershell -Verb RunAs -ArgumentList $elevateArgs -Wait
    return
}

if (-not (Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue)) {
    Write-Host "Rule '$RuleName' not found. Nothing to do."
    return
}

Remove-NetFirewallRule -DisplayName $RuleName
Write-Host "Removed firewall rule '$RuleName'."
