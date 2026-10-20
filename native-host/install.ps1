# @spec spec://modules/platform/INFRA-003-local-cli#acceptance
[CmdletBinding()]
param(
  [ValidatePattern('^[a-p]{32}$')][string]$ChromeId,
  [switch]$FirefoxOnly,
  [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'
$installRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Linguisty\native-host'))
$manifestChrome = Join-Path $installRoot 'chrome.json'
$manifestFirefox = Join-Path $installRoot 'firefox.json'
$registryChrome = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.linguisty.cli'
$registryFirefox = 'HKCU:\Software\Mozilla\NativeMessagingHosts\com.linguisty.cli'
if ($Uninstall) {
  foreach ($pair in @(@($registryChrome,$manifestChrome),@($registryFirefox,$manifestFirefox))) {
    if (Test-Path -LiteralPath $pair[0]) {
      $current = (Get-Item -LiteralPath $pair[0]).GetValue('')
      if ($current -eq $pair[1]) { Remove-Item -LiteralPath $pair[0] }
    }
  }
  Write-Output 'Linguisty CLI connector unregistered. Installed files and CLI accounts were preserved.'
  exit 0
}
if (-not $ChromeId -and -not $FirefoxOnly) {
  $ChromeId = Read-Host 'Paste the Chrome extension ID shown in Linguisty settings (Enter for Firefox only)'
  if ($ChromeId -and $ChromeId -notmatch '^[a-p]{32}$') { throw 'Invalid Chrome extension ID.' }
}
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Node.js 22.12+ is required by the connector. Install Node.js, then run this installer again.' }
$nodeVersion = (& $nodeCommand.Source --version).TrimStart('v')
if ([version]$nodeVersion -lt [version]'22.12.0') { throw 'Node.js 22.12+ is required.' }
New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($name in @('index.mjs','host.mjs','cli.mjs','protocol.mjs','schema.json')) {
  $source = Join-Path $PSScriptRoot $name
  $target = Join-Path $installRoot $name
  if ([IO.Path]::GetFullPath($source) -ne [IO.Path]::GetFullPath($target)) { Copy-Item -LiteralPath $source -Destination $target -Force }
}
$executables = @{}
foreach ($pair in @(@('codex-cli','codex'),@('claude-code','claude'),@('antigravity-cli','agy'),@('grok-build','grok'))) {
  $cliCommand = Get-Command $pair[1] -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cliCommand -and $cliCommand.Source) { $executables[$pair[0]] = $cliCommand.Source }
}
$config = @{ executables = $executables; protocolVersion = 1 } | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText((Join-Path $installRoot 'config.json'), $config, $utf8)
$launcher = Join-Path $installRoot 'launch.cmd'
$launcherText = '@echo off' + [Environment]::NewLine + '"' + $nodeCommand.Source + '" "' + (Join-Path $installRoot 'index.mjs') + '" %*' + [Environment]::NewLine
[IO.File]::WriteAllText($launcher, $launcherText, $utf8)
$firefox = @{ name='com.linguisty.cli'; description='Linguisty local CLI connector'; path=$launcher; type='stdio'; allowed_extensions=@('linguisty@isty.local') }
[IO.File]::WriteAllText($manifestFirefox, ($firefox | ConvertTo-Json -Depth 4), $utf8)
New-Item -Path $registryFirefox -Force | Out-Null
Set-Item -LiteralPath $registryFirefox -Value $manifestFirefox
if ($ChromeId) {
  $origins = @('chrome-extension://' + $ChromeId + '/')
  if (Test-Path -LiteralPath $manifestChrome) {
    $previous = Get-Content -LiteralPath $manifestChrome -Raw | ConvertFrom-Json
    $origins += @($previous.allowed_origins | Where-Object { $_ -match '^chrome-extension://[a-p]{32}/$' })
  }
  $chrome = @{ name='com.linguisty.cli'; description='Linguisty local CLI connector'; path=$launcher; type='stdio'; allowed_origins=@($origins | Select-Object -Unique) }
  [IO.File]::WriteAllText($manifestChrome, ($chrome | ConvertTo-Json -Depth 4), $utf8)
  New-Item -Path $registryChrome -Force | Out-Null
  Set-Item -LiteralPath $registryChrome -Value $manifestChrome
}
Write-Output 'Linguisty CLI connector installed for Firefox and the specified Chrome extension. No model requests were made.'
