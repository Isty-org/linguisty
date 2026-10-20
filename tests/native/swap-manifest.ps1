# Only the known Linguisty host key is touched; restores its captured prior value.
param(
  [ValidateSet('set','restore')][string]$Action,
  [ValidateSet('chrome','firefox')][string]$Platform,
  [string]$Manifest,
  [string]$Previous
)
$ErrorActionPreference = 'Stop'
$key = if ($Platform -eq 'chrome') { 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.linguisty.cli' } else { 'HKCU:\Software\Mozilla\NativeMessagingHosts\com.linguisty.cli' }
$current = if (Test-Path -LiteralPath $key) { (Get-Item -LiteralPath $key).GetValue('') } else { $null }
if ($Action -eq 'set') {
  New-Item -Path $key -Force | Out-Null
  Set-Item -LiteralPath $key -Value $Manifest
  @{ previous = $current } | ConvertTo-Json -Compress
} else {
  if ($current -ne $Manifest) { throw 'Host registration changed during QA; refusing to overwrite it.' }
  if ($Previous) { Set-Item -LiteralPath $key -Value $Previous }
  else { Remove-Item -LiteralPath $key }
}
