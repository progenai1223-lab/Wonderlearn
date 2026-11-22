# Store the Gemini API key encrypted for the current Windows user (DPAPI).
#
#   powershell -ExecutionPolicy Bypass -File store-gemini-key.ps1
#
# The key is typed into a hidden prompt, encrypted with Windows DPAPI (only this Windows account on this
# machine can decrypt it) and saved to %LOCALAPPDATA%\website-generator\gemini.key, outside any
# synced or project folder. The file's access is limited to the current user. Run it again to replace the key;
# -Remove deletes it.
param([switch]$Remove)

$dir  = Join-Path $env:LOCALAPPDATA 'website-generator'
$file = Join-Path $dir 'gemini.key'

if ($Remove) {
  if (Test-Path $file) { Remove-Item $file -Force; Write-Host "Removed $file" } else { Write-Host 'No stored key.' }
  exit 0
}

$secure = Read-Host -AsSecureString 'Paste your Gemini API key (input is hidden), then press Enter'
if ($secure.Length -lt 20) { Write-Host 'That looks too short for a Gemini API key; nothing was saved.'; exit 1 }

New-Item -ItemType Directory -Force -Path $dir | Out-Null
$secure | ConvertFrom-SecureString | Set-Content -Path $file -Encoding ascii

# Only the current user (and SYSTEM) may read the file.
$me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls $file /inheritance:r /grant:r "${me}:(R,W)" "SYSTEM:(F)" | Out-Null

Write-Host "Saved, encrypted for $me, to $file"
