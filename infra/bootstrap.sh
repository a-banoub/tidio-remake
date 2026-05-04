#!/usr/bin/env bash
set -euo pipefail

# Run as root on a fresh Ubuntu 22.04+ server.

# 1. Install dependencies
apt update
apt install -y curl ca-certificates gnupg sqlite3
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs caddy

# 2. Create user + dirs
id -u tidio &>/dev/null || useradd --system --create-home --shell /bin/bash tidio
mkdir -p /opt/tidio-remake /var/lib/tidio-remake/backups /var/log/tidio-remake /etc/tidio-remake
chown -R tidio:tidio /opt/tidio-remake /var/lib/tidio-remake /var/log/tidio-remake

# 3. Generate secrets if env file missing
if [ ! -f /etc/tidio-remake/env ]; then
  {
    echo "VISITOR_COOKIE_SECRET=$(openssl rand -hex 32)"
    echo "OPERATOR_PASSWORD_PEPPER=$(openssl rand -hex 32)"
    echo "DATABASE_PATH=/var/lib/tidio-remake/chat.db"
    echo "GEOIP_DB_PATH=/var/lib/tidio-remake/GeoLite2-City.mmdb"
    echo "PORT=8080"
    echo "NODE_ENV=production"
    echo "LOG_LEVEL=info"
    node -e "const wp=require('web-push');const k=wp.generateVAPIDKeys();console.log('VAPID_PUBLIC_KEY='+k.publicKey+'\\nVAPID_PRIVATE_KEY='+k.privateKey);"
    echo "VAPID_SUBJECT=mailto:alex@simple1031x.com"
  } > /etc/tidio-remake/env
  chown tidio:tidio /etc/tidio-remake/env
  chmod 600 /etc/tidio-remake/env
  echo "Generated /etc/tidio-remake/env — review it now."
fi

# 4. Place Caddyfile + systemd unit
cp /opt/tidio-remake/infra/Caddyfile /etc/caddy/Caddyfile
cp /opt/tidio-remake/infra/tidio-remake.service /etc/systemd/system/

# 5. MaxMind GeoLite2 reminder
if [ ! -f /var/lib/tidio-remake/GeoLite2-City.mmdb ]; then
  echo "WARNING: /var/lib/tidio-remake/GeoLite2-City.mmdb missing."
  echo "Sign up at https://www.maxmind.com/en/geolite2/signup and download GeoLite2-City.mmdb."
fi

# 6. Enable services
systemctl daemon-reload
systemctl enable --now tidio-remake
systemctl reload caddy

echo "Bootstrap complete. Browse https://chat.simple1031x.com/console for first-run setup."
