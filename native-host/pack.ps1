# @spec spec://modules/platform/INFRA-003-local-cli#acceptance
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$package = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$outputRoot = Join-Path $root '.output'
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$sources = @('index.mjs','host.mjs','cli.mjs','protocol.mjs','schema.json','install.ps1','INSTALL.cmd') | ForEach-Object { Join-Path $PSScriptRoot $_ }
$sources += Join-Path $root 'docs/LOCAL-CLI.md'
$archive = Join-Path $outputRoot ('linguisty-' + $package.version + '-cli-helper.zip')
Compress-Archive -LiteralPath $sources -DestinationPath $archive -Force
Write-Output $archive
