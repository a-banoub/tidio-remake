# Tidio Remake

Self-hosted live chat for simple1031x.com. See `docs/spec.md` for the design.

## Workspaces

- `server/` — Node 20 + WebSocket + SQLite
- `widget/` — vanilla TS visitor-side chat bubble
- `console/` — Preact PWA operator console
- `infra/` — Caddyfile, systemd unit, deploy scripts

## Local dev

```bash
nvm use
npm install
npm run dev   # runs server, widget watch, console watch in parallel
```

## Deploy

```bash
infra/deploy.sh
```

License: MIT
