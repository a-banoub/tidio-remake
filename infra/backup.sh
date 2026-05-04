#!/usr/bin/env bash
set -euo pipefail
DATE=$(date +%Y-%m-%d)
sqlite3 /var/lib/tidio-remake/chat.db ".backup '/var/lib/tidio-remake/backups/chat-$DATE.db'"
gzip -f /var/lib/tidio-remake/backups/chat-$DATE.db
find /var/lib/tidio-remake/backups -name "*.db.gz" -mtime +30 -delete
