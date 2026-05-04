#!/usr/bin/env bash
set -euo pipefail
echo "# Add the following to /etc/tidio-remake/env:"
node -e "const wp=require('web-push');const k=wp.generateVAPIDKeys();console.log('VAPID_PUBLIC_KEY='+k.publicKey+'\\nVAPID_PRIVATE_KEY='+k.privateKey);"
echo "VAPID_SUBJECT=mailto:alex@simple1031x.com"
