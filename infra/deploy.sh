#!/usr/bin/env bash
set -euo pipefail
SERVER="${1:-server.mortalitygame.com}"
SSH_USER="${SSH_USER:-root}"

ssh "${SSH_USER}@${SERVER}" bash <<'EOF'
set -euo pipefail
cd /opt/tidio-remake
git fetch origin
git reset --hard origin/main
npm ci
cd server && npm run build
cd ../console && npm run build
cd ../widget && npm run build
sudo systemctl restart tidio-remake
sudo systemctl status tidio-remake --no-pager
EOF
echo "Deploy complete."
