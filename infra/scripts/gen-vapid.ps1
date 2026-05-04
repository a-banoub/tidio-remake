#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'
Write-Output "# Add the following to /etc/tidio-remake/env:"
node -e "const wp=require('web-push');const k=wp.generateVAPIDKeys();console.log('VAPID_PUBLIC_KEY='+k.publicKey+'\nVAPID_PRIVATE_KEY='+k.privateKey);"
Write-Output "VAPID_SUBJECT=mailto:alex@simple1031x.com"
