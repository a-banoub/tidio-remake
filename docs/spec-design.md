# Tidio Remake — Design Spec

**Date:** 2026-05-03
**Branch:** `tidio-remake`
**Status:** Design approved, ready for implementation plan

A self-hosted live-chat console for Simple 1031 LLC. Visitors on `simple1031x.com` see a chat widget; the operator (Alex) sees a real-time list of live visitors with their behavior signals and can chat with any of them, from a PC console or an Android PWA. Backend runs on `server.mortalitygame.com` behind Caddy. No third-party SaaS, no Docker for v1.

---

## 1. Goals & Non-Goals

### Goals (v1)

1. **Replace** the existing rule-based AI chatbot widget on `simple1031x.com` with a human-driven live chat. (Old chatbot stays in the codebase but is unloaded from pages.)
2. **Live visitor view** — operator sees every visitor currently on the site, their lead score, current page, journey, source, geo, device, and engagement signals (Tidio-style).
3. **Two-phased visitor experience** — Phase 1: open chat (operator has up to ~3 min to respond), Phase 2: name/email/phone capture form if operator doesn't respond in time.
4. **Full proactive chat** — operator can click any live visitor and start a chat first; their widget pops open with the operator's message.
5. **Smart highlighting** — console surfaces high-priority visitors (lead_score ≥ 8, key pages, time on site) with visual + audio + push notifications.
6. **Mobile parity** — same operator console runs as a PWA on Android Chrome with Web Push notifications, so the operator can engage from anywhere.
7. **Operator status** — manual Online / Away / DND toggle plus configurable quiet hours (default 9pm–8am PT).
8. **Customizable quick-reply chips** — operator-managed canned responses with one-click insertion.
9. **Editable contact fields in right rail** — operator can capture name/email/phone mid-chat.

### Explicit non-goals (v1, see §10 for the deferral list)

Operator notes, HubSpot sync, multi-operator team, AI-bot handoff, file/image attachments in chat, rules-based auto-greet (operator-side rules only for v1), native React Native app, conversation tagging, GitHub Actions auto-deploy.

---

## 2. System Architecture

```
┌────────────────────┐       WSS :443 (presence + chat)      ┌──────────────────────┐
│  Visitor browser   │ ◄─────────────────────────────────────►│   Caddy (auto-TLS)  │
│  simple1031x.com   │       HTTPS (history fetch)           │  chat.simple1031x.com│
│  + chat-widget.js  │                                        └──────────┬───────────┘
└────────────────────┘                                                   │
                                                                         ▼
                                                          ┌──────────────────────────┐
                                                          │  Node 20 + ws server     │
                                                          │  systemd: tidio-remake   │
                                                          │  port :8080              │
                                                          └─┬───────────────┬────────┘
                                                            │               │
                                                            ▼               ▼
                                                  ┌──────────────┐  ┌────────────────┐
                                                  │  SQLite      │  │  GeoLite2 mmdb │
                                                  │  WAL mode    │  │  (city/tz)     │
                                                  └──────────────┘  └────────────────┘

┌────────────────────┐       WSS :443 (auth: Bearer)         ┌──────────────────────┐
│  Operator (PC)     │ ◄─────────────────────────────────────►│   Caddy → Node       │
│  Preact PWA        │                                        │                      │
│                    │       Web Push (VAPID, background)     │                      │
│  Operator (Android)│ ◄──────────────────────────────────────┤                      │
│  Same PWA, A2HS    │                                        └──────────────────────┘
└────────────────────┘
```

**Domain & TLS:** `chat.simple1031x.com` CNAME → `server.mortalitygame.com`. Caddy obtains and renews Let's Encrypt certs automatically.

**No Docker** for v1 (kept simple for solo operator). Stack is intentionally small enough to manage with `systemctl` + `journalctl`.

---

## 3. Component Breakdown

Three deployables, each with one tight responsibility.

### 3.1 Visitor widget — `widget/dist/chat-widget.js`

- Vanilla JavaScript IIFE, ~15kb gzipped, zero npm deps in the visitor's browser. Matches the style of the existing `js/chatbot-widget.js`.
- Replaces the existing chatbot widget (drop-in: same `<script>` tag pattern, mounted at the same DOM position).
- **Identity:** generates and persists `visitorId` in `localStorage`; per-tab `sessionId` in `sessionStorage`.
- **One WebSocket** per page load to `wss://chat.simple1031x.com/ws/visitor`. Idle WS connections are cheap (~10kb of memory each); we accept the cost in exchange for instant proactive-chat capability.
- **Streams to server:** page URL, scroll depth, lead score events (sourced from existing `analytics-engine.js`), UTM params (sourced from existing UTM capture), referrer, device info.
- **Renders:** floating bubble, chat panel, two-phase composer (text input → name/email/phone form after timeout), typing indicator, message history.
- **Resilience:** persists conversation to localStorage so a page reload restores the chat; auto-reconnects with exponential backoff (1s → 15s cap).

### 3.2 Server — `server/`

Node 20 LTS, runs as `tidio-remake.service` under systemd.

Dependencies (~6 npm packages): `ws`, `better-sqlite3`, `web-push`, `maxmind`, `pino`, `@node-rs/argon2`, `dotenv`.

- **WS upgrades:**
  - `/ws/visitor` — signed cookie session, no formal login.
  - `/ws/operator` — `Authorization: Bearer <token>` required on the upgrade request.
- **HTTP endpoints (Express):**
  - `POST /api/operator/login` — credentials → bearer token.
  - `POST /api/operator/push-subscribe` — register a Web Push endpoint.
  - `GET  /api/operator/quick-replies` / `POST` / `PUT` / `DELETE`
  - `GET  /api/operator/settings` / `PUT`
  - `GET  /api/widget/history?conversationId=...` — message history fetch (also embedded in `welcome` message; this endpoint is the explicit-fetch fallback).
  - `GET  /health`, `GET /metrics`
- **In-memory `LiveSessions` map** keyed by `visitorId` (current socket, lastSeen, page, lead score, …) — fast-path projection for rendering the operator's "live now" panel without a DB hit per render.
- **Web Push dispatcher:** when a visitor message arrives and the operator is offline OR Away OR DND OR within quiet hours, fan out push notifications to all registered devices via VAPID.
- **GeoIP:** `maxmind` reads a static `GeoLite2-City.mmdb` file from disk on first connect from each session.
- **Static file server** for `/console/*` (operator PWA build) and `/widget/*` (visitor widget bundle).

### 3.3 Operator console — `console/`

Preact + Vite + Tailwind. Builds to a static SPA. Installable PWA on PC and Android.

- **Three-pane layout** (see mockup):
  - Left: status pill, tabs (Live / Inbox / All), rows for in-conversation visitors, queued conversations, and live-but-not-chatting visitors. Hot leads (score ≥ 8) get an orange left-border accent.
  - Middle: active conversation thread with composer + customizable quick-reply chips.
  - Right: editable visitor detail panel — identity, lead score breakdown, journey timeline, source/UTMs, geo/device, engagement signals.
- **WebSocket client** to `/ws/operator`, auth'd via bearer token from localStorage.
- **Service Worker** handles Web Push events and offline shell caching.
- **Settings page:** quick-replies CRUD, quiet hours window, status, devices (registered push subscriptions, with revoke).

---

## 4. Repository Layout

The `tidio-remake` project lives in its own subtree on the `tidio-remake` branch (or in its own repo, TBD with writing-plans). Layout:

```
tidio-remake/
├── widget/                          # visitor-side bundle
│   ├── src/
│   ├── dist/                        # built artifact, served by Node
│   └── package.json
├── server/                          # Node + ws + sqlite
│   ├── src/
│   │   ├── index.ts                 # entry, sets up HTTP + WS
│   │   ├── ws/
│   │   │   ├── visitor.ts           # /ws/visitor handler
│   │   │   └── operator.ts          # /ws/operator handler
│   │   ├── api/                     # REST handlers
│   │   ├── db/
│   │   │   ├── client.ts            # better-sqlite3 wrapper
│   │   │   └── migrations/          # 001-initial.sql, ...
│   │   ├── live/
│   │   │   └── sessions.ts          # in-memory LiveSessions map
│   │   ├── push/
│   │   │   └── dispatcher.ts        # VAPID push fan-out
│   │   ├── geo/
│   │   │   └── lookup.ts
│   │   └── auth/
│   │       └── tokens.ts
│   ├── dist/                        # compiled JS (esbuild)
│   └── package.json
├── console/                         # Preact PWA
│   ├── src/
│   │   ├── App.tsx
│   │   ├── panels/{Left,Middle,Right}.tsx
│   │   ├── ws/operatorClient.ts
│   │   └── sw.ts                    # service worker
│   ├── dist/
│   └── package.json
├── infra/
│   ├── Caddyfile
│   ├── tidio-remake.service
│   ├── backup.sh
│   ├── bootstrap.sh                 # one-time server setup
│   └── deploy.sh                    # one-line deploy
└── README.md
```

---

## 5. Data Model

SQLite via `better-sqlite3` in WAL mode with `synchronous=NORMAL`. Migrations are sequential `.sql` files applied at boot.

### 5.1 Tables

```sql
-- 1. Durable visitor identity (across sessions)
CREATE TABLE visitors (
  id              TEXT PRIMARY KEY,            -- v_xxxx, generated client-side
  first_seen_at   INTEGER NOT NULL,
  last_seen_at    INTEGER NOT NULL,
  name            TEXT,                         -- editable in right rail
  email           TEXT,                         -- "
  phone           TEXT,                         -- "
  hubspot_contact_id TEXT                       -- v2, nullable
);
CREATE INDEX idx_visitors_last_seen ON visitors(last_seen_at);

-- 2. One per browser tab (a "visit")
CREATE TABLE sessions (
  id              TEXT PRIMARY KEY,            -- s_xxxx, generated client-side
  visitor_id      TEXT NOT NULL REFERENCES visitors(id),
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER,
  landing_url     TEXT,
  utm_source      TEXT, utm_medium TEXT, utm_campaign TEXT,
  utm_term        TEXT, utm_content TEXT,
  gclid           TEXT, fbclid TEXT,
  referrer        TEXT,
  ip              TEXT,
  city            TEXT, region TEXT, country TEXT, timezone TEXT,
  device_type     TEXT, browser TEXT, os TEXT,
  current_lead_score INTEGER NOT NULL DEFAULT 0  -- cached aggregate (see §5.3)
);
CREATE INDEX idx_sessions_visitor ON sessions(visitor_id, started_at);

-- 3. Page-by-page journey within a session
CREATE TABLE page_views (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT NOT NULL REFERENCES sessions(id),
  url             TEXT NOT NULL,
  title           TEXT,
  entered_at      INTEGER NOT NULL,
  left_at         INTEGER,
  max_scroll_pct  INTEGER DEFAULT 0,
  exit_intent     INTEGER DEFAULT 0
);
CREATE INDEX idx_pv_session ON page_views(session_id, entered_at);

-- 4. Engagement events (event-sourced lead score)
CREATE TABLE lead_signals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT NOT NULL REFERENCES sessions(id),
  kind            TEXT NOT NULL,               -- 'calculator_used','exit_intent',...
  payload         TEXT,                         -- JSON
  score_delta     INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_signals_session ON lead_signals(session_id);

-- 5. A chat thread (one visitor can have many over time)
CREATE TABLE conversations (
  id                TEXT PRIMARY KEY,
  visitor_id        TEXT NOT NULL REFERENCES visitors(id),
  opened_session_id TEXT REFERENCES sessions(id),
  status            TEXT NOT NULL,             -- 'live','queued','closed','abandoned','closed_for_followup'
  opened_at         INTEGER NOT NULL,
  closed_at         INTEGER,
  last_message_at   INTEGER NOT NULL,
  initiated_by      TEXT NOT NULL,             -- 'visitor' | 'operator'
  timeout_capture   TEXT                        -- JSON: { name, email, phone } if Phase-2 fired
);
CREATE INDEX idx_conv_status ON conversations(status, last_message_at);
CREATE INDEX idx_conv_visitor ON conversations(visitor_id);

-- 6. Individual messages
CREATE TABLE messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  sender          TEXT NOT NULL,               -- 'visitor' | 'operator' | 'system'
  body            TEXT NOT NULL,
  sent_at         INTEGER NOT NULL,
  seen_at         INTEGER,
  quick_reply_id  INTEGER REFERENCES quick_replies(id)
);
CREATE INDEX idx_msg_conv ON messages(conversation_id, sent_at);

-- 7. Operators (one in v1, structured for more)
CREATE TABLE operators (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  email             TEXT UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,             -- argon2id
  display_name      TEXT NOT NULL,             -- "Alex"
  status            TEXT NOT NULL DEFAULT 'online',  -- 'online'|'away'|'dnd'
  timezone          TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  quiet_hours_start TEXT,                      -- 'HH:MM' in operator's tz
  quiet_hours_end   TEXT,
  created_at        INTEGER NOT NULL
);

-- 8. Per-device push subscriptions
CREATE TABLE push_subscriptions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  operator_id     INTEGER NOT NULL REFERENCES operators(id),
  endpoint        TEXT UNIQUE NOT NULL,
  p256dh          TEXT NOT NULL,
  auth            TEXT NOT NULL,
  device_label    TEXT,                        -- "PC Chrome" / "Pixel 8"
  created_at      INTEGER NOT NULL,
  last_used_at    INTEGER
);

-- + bearer token table for operator auth, quick_replies table
CREATE TABLE operator_tokens (
  token TEXT PRIMARY KEY,
  operator_id INTEGER NOT NULL REFERENCES operators(id),
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE quick_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator_id INTEGER NOT NULL REFERENCES operators(id),
  label TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

### 5.2 Runtime mirror — in-memory `LiveSessions`

The server keeps an in-memory map keyed by `visitorId`:

```typescript
type LiveSession = {
  visitorId: string;
  sockets: Set<WebSocket>;      // one visitor may have multiple tabs open
  activeSessionId: string;      // sessionId of the most-recently-active tab
  lastSeenAt: number;
  currentPage: { url: string; title: string; enteredAt: number };  // from active tab
  scrollPct: number;
  leadScore: number;            // mirror of sessions.current_lead_score (max across tabs)
  isHot: boolean;               // leadScore >= 8
  isTyping: boolean;
  conversationId?: string;      // if currently in a chat
};
```

This is the source of truth for the "live now" panel rendering. SQLite is the durable record; on server restart the map rebuilds from reconnecting clients (visitors auto-reconnect within ~3 seconds).

**Multi-tab handling.** A single visitor with N tabs open creates one `LiveSession` entry with N sockets in the `sockets` set. The `currentPage` and `activeSessionId` reflect the most recently active tab (server uses the last `[presence]` or `[hello]` message to determine active). Operator-initiated `[operator_pinged_you]` fans out to **all** sockets — whichever tab is foregrounded shows the chat. Visitor-initiated `[chat_message]` is associated with the originating tab's `sessionId`.

### 5.3 Lead score: event-sourced + cached

- `lead_signals` is the source of truth — every event with its `score_delta` is appended.
- `sessions.current_lead_score` is a cached `SUM(score_delta) WHERE session_id = ?`, updated transactionally on each insert.
- Operator panel reads the cached column for the live list. The right-rail "score breakdown" reads `lead_signals` rows for the selected session.
- This lets us retroactively re-score by replaying events with new weights, without losing data.

---

## 6. Wire Protocol — WebSocket Messages

JSON over WSS, every message has a `type` discriminator.

### 6.1 `/ws/visitor` — visitor browser ↔ server

| Direction | `type`               | Payload                                                                  | When sent                                                  |
|-----------|----------------------|--------------------------------------------------------------------------|------------------------------------------------------------|
| C → S     | `hello`              | `{visitorId, sessionId, page, utms, referrer, userAgent}`                | First message after WS open                                |
| C → S     | `presence`           | `{page, scrollPct, idle}`                                                | Every 15s + on page change                                 |
| C → S     | `lead_signal`        | `{kind, payload}`                                                        | When analytics-engine fires (calculator_used, etc.)        |
| C → S     | `chat_open`          | `{}`                                                                     | Visitor clicks bubble                                      |
| C → S     | `chat_message`       | `{body}`                                                                 | Visitor sends a message                                    |
| C → S     | `typing`             | `{isTyping: bool}`                                                       | Throttled, on input                                        |
| C → S     | `capture`            | `{name?, email?, phone?}`                                                | Phase-2 form submitted                                     |
| S → C     | `welcome`            | `{conversationId?, history?, operatorOnline}`                            | Server's reply to `hello`                                  |
| S → C     | `operator_message`   | `{messageId, body, operatorName, sentAt}`                                | Operator replied                                           |
| S → C     | `operator_typing`    | `{isTyping}`                                                             | Operator typing indicator                                  |
| S → C     | `operator_pinged_you`| `{operatorName, body}`                                                   | Proactive chat: widget should open with this message       |
| S → C     | `phase_transition`   | `{phase: 'live' \| 'capture'}`                                           | After 3-min timeout, switch to capture form                |
| S → C     | `seen`               | `{messageId, seenAt}`                                                    | Operator read the message                                  |
| S → C     | `error`              | `{code, message}`                                                        | Server error / rate limit / disconnect reason              |

### 6.2 `/ws/operator` — operator console ↔ server

Auth: `Authorization: Bearer <token>` on the WS upgrade.

| Direction | `type`                  | Payload                                                                  | When sent                                                  |
|-----------|-------------------------|--------------------------------------------------------------------------|------------------------------------------------------------|
| C → S     | `subscribe`             | `{filters?}`                                                             | Operator opens console — server starts streaming           |
| C → S     | `set_status`            | `{status: 'online'\|'away'\|'dnd'}`                                      | Manual toggle                                              |
| C → S     | `open_chat`             | `{visitorId}`                                                            | Operator clicked a visitor — proactive chat                |
| C → S     | `send_message`          | `{conversationId, body, quickReplyId?}`                                  | Operator sends                                             |
| C → S     | `typing`                | `{conversationId, isTyping}`                                             | Operator typing                                            |
| C → S     | `mark_seen`             | `{conversationId, lastMessageId}`                                        | Operator looked at the conversation                        |
| C → S     | `update_visitor`        | `{visitorId, name?, email?, phone?}`                                     | Operator edited contact fields                             |
| C → S     | `end_chat`              | `{conversationId}`                                                       | Operator closed                                            |
| S → C     | `state_snapshot`        | `{liveVisitors[], openConversations[], queuedConversations[]}`           | After `subscribe`, full initial state                      |
| S → C     | `visitor_appeared`      | `{visitor, session}`                                                     | New visitor connected                                      |
| S → C     | `visitor_updated`       | `{visitorId, patch}`                                                     | Page change, score change (delta only)                     |
| S → C     | `visitor_left`          | `{visitorId}`                                                            | WS closed for >30s                                         |
| S → C     | `new_message`           | `{conversationId, message}`                                              | Visitor message arrived                                    |
| S → C     | `visitor_typing`        | `{conversationId, isTyping}`                                             |                                                            |
| S → C     | `conversation_queued`   | `{conversation}`                                                         | New visitor opened chat → queue                            |
| S → C     | `high_priority_alert`   | `{visitorId, reason}`                                                    | Score crossed threshold OR rule fired                      |

### 6.3 Protocol design notes

- **Patches, not replays.** `visitor_updated` sends only changed fields — the operator UI applies the patch to its local state. Saves bandwidth on the constantly-updating presence panel.
- **No `chat_open` from operator side.** Operator's `open_chat` creates the conversation server-side AND sends `operator_pinged_you` to the visitor's WS in one transaction. The visitor's widget opens automatically with the operator's first message visible.
- **Idempotency.** `open_chat` with the same `visitorId` within 60 seconds is a no-op (returns the existing conversation). Prevents double-pings from rapid clicks.
- **Ordering.** Messages buffered client-side during a WS dropout are sent on reconnect with monotonic local IDs; server preserves order via `sent_at`.

---

## 7. Key User Journeys

### Flow 1 — Visitor opens widget, operator is online → live chat

1. Visitor lands on `/tax-calculator`. `chat-widget.js` boots, opens WS, sends `[hello]`.
2. Server creates `sessions` row, runs GeoIP, looks up `visitorId` in `visitors`. Sends `[welcome]` with `operatorOnline: true`.
3. Visitor clicks bubble (`[chat_open]`), types message (`[chat_message]`).
4. Server creates `conversations` row (status `live`), inserts `message`. Sends `[new_message]` to operator WS plus an in-app sound + visual nudge.
5. Operator types reply. `[send_message]` → server stores it, fans out `[operator_message]` to visitor.
6. Conversation continues until either side sends `[end_chat]` or both go quiet for 30 min (auto-`abandoned`).

### Flow 2 — Visitor opens widget, operator is offline/DND → 3-min wait → Phase-2

1. Steps 1–3 same as Flow 1, but server sees operator status ≠ `online` (or quiet hours active). Conversation status = `queued`.
2. Server triggers `[high_priority_alert]` to console (if open) AND fires Web Push to all operator devices: *"Visitor on /tax-calculator wants to chat — lead score 9."*
3. Server sets a 3-min timer keyed by conversation ID.
4. **If operator responds within 3 min**: `[send_message]` cancels the timer. Conversation transitions to `live`.
5. **If 3 min pass with no operator reply**: server sends `[phase_transition: capture]` to visitor's WS. Widget swaps the composer for a name/email/phone form.
6. Visitor submits (`[capture]`). Server stores on `visitors` row + `conversations.timeout_capture`. Conversation status → `closed_for_followup`. Push: *"Lead captured — Alex from Henderson NV, will follow up."*

### Flow 3 — Operator proactively pings a hot visitor

1. Console shows visitor `#a4f2` on `/lp/start-your-1031-exchange.html`, lead score 9 (hot in left rail).
2. Operator clicks them, types message in a modal: *"Hi! Saw you reading our forward exchange flow — any questions?"*
3. Console sends `[open_chat]` + `[send_message]`.
4. Server creates `conversations` row (`initiated_by: operator`), inserts message, sends `[operator_pinged_you]` to visitor's WS — atomic.
5. Visitor's widget pops open with the message, soft chime. Conversation continues like Flow 1.

### Flow 4 — Returning visitor

1. Visitor returns 3 days later. Widget reads `visitorId` from localStorage, sends `[hello]` with the existing ID.
2. Server matches existing `visitors` row, creates a NEW `sessions` row (new visit), looks up conversations from the last 30 days with `status IN ('live','queued','closed_for_followup')`.
3. `[welcome]` includes `conversationId` and `history` (last N messages).
4. Visitor opens bubble — sees prior conversation as context. Picks up where they left off.
5. Right rail shows `RETURNING · 2nd visit` badge (because `visitors.first_seen_at` < `sessions.started_at` − 24h).

### Flow 5 — Server restart mid-conversation

1. Operator deploys. systemd restarts the Node service. WS connections drop.
2. Visitor widget detects close, retries with backoff (1s → 15s cap). Operator console same.
3. On reconnect, both sides send `[hello]` / `[subscribe]`. Server rebuilds in-memory state from new connections, replays missed messages from SQLite via `[welcome.history]` / `[state_snapshot]`.
4. Visitor sees conversation restored. Operator sees queue + live visitors restored. Total downtime: ~3–5 seconds.

---

## 8. Auth & Security

### 8.1 Operator auth

- Single account in `operators` table. Password hashed with **argon2id** (`@node-rs/argon2`).
- `POST /api/operator/login` returns a 32-byte hex bearer token (stored in `operator_tokens`).
- Console stores token in `localStorage`, sends as `Authorization: Bearer <token>` on WS upgrade and REST calls.
- Tokens never expire automatically; manually revocable from settings (deletes the row).
- No magic-link in v1 (one user). No 2FA in v1.

### 8.2 Visitor auth (anti-tampering, not real auth)

- `visitorId` and `sessionId` generated client-side. Anyone can fake them.
- Server issues a **signed visitor cookie** on first WS connect: HMAC-SHA256 over `{visitorId}{sessionId}{issuedAt}` using `VISITOR_COOKIE_SECRET`. Widget includes it on every subsequent connect. Server rejects on mismatch.
- Standard "anonymous-but-stable" pattern (Tidio/Intercom use the same).

### 8.3 Transport

- Caddy terminates TLS, enforces HTTPS, redirects HTTP → HTTPS. Modern cipher suites only.
- WSS only — no plain WS.
- CORS:
  - Visitor REST endpoints: `Origin: https://*.simple1031x.com` and `https://simple1031x.com`.
  - Operator REST endpoints: `Origin: https://chat.simple1031x.com` only.

### 8.4 Rate limiting & abuse

| Surface                           | Limit                                                               |
|-----------------------------------|---------------------------------------------------------------------|
| Visitor `[chat_message]`          | 30 / 5 min per visitorId; soft 60s cooldown on breach               |
| Visitor `[lead_signal]` `[presence]` | 1/sec sustained per IP, burst 20                                  |
| WS connections per IP             | Max 10 simultaneous                                                  |
| Operator login                    | 5 attempts / hour per IP, then 1-hour lockout                       |
| Message body                      | 4000 char max (server rejects oversize)                              |

### 8.5 Input validation

- All user-provided strings escaped at render time in the operator console (no `dangerouslySetInnerHTML`).
- Email validated by RFC 5322 light regex (no DNS lookup).
- `page` field validated as a URL with `simple1031x.com` host (drops spoofed page reports).

### 8.6 Secrets

`/etc/tidio-remake/env`, owned by `tidio` user, mode 600:

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:alex@simple1031x.com
VISITOR_COOKIE_SECRET=<32 bytes hex>
OPERATOR_BCRYPT_PEPPER=<32 bytes hex>
DATABASE_PATH=/var/lib/tidio-remake/chat.db
```

Loaded by `dotenv`. Never committed. README documents generation commands.

### 8.7 Threat model

Optimized for **conversion**, not paranoia. No CAPTCHA on chat-open (would deter legitimate users). Rate limits cover realistic abuse; if real abuse appears, we layer in CAPTCHA as a v2 follow-up.

---

## 9. Deployment & Infrastructure

### 9.1 Server file layout

```
/opt/tidio-remake/                   # code (git checkout)
├── server/dist/, node_modules/
├── widget/dist/chat-widget.js
├── console/dist/
└── infra/

/etc/tidio-remake/env                # secrets, mode 600
/var/lib/tidio-remake/chat.db        # SQLite DB
/var/lib/tidio-remake/backups/       # daily SQLite snapshots, 30-day rotation
/var/lib/tidio-remake/GeoLite2-City.mmdb
/var/log/tidio-remake/               # journald-managed, plus flat fallback
```

### 9.2 `infra/Caddyfile`

```caddyfile
chat.simple1031x.com {
    handle_path /console/* {
        root * /opt/tidio-remake/console/dist
        try_files {path} /index.html
        file_server
    }
    handle_path /widget/* {
        root * /opt/tidio-remake/widget/dist
        header Cache-Control "public, max-age=300"
        file_server
    }
    reverse_proxy localhost:8080
}
```

### 9.3 `infra/tidio-remake.service`

```ini
[Unit]
Description=Tidio Remake live chat
After=network.target

[Service]
Type=simple
User=tidio
Group=tidio
WorkingDirectory=/opt/tidio-remake/server
EnvironmentFile=/etc/tidio-remake/env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=3
StandardOutput=journal
StandardError=journal
ProtectSystem=strict
ReadWritePaths=/var/lib/tidio-remake /var/log/tidio-remake
NoNewPrivileges=true
MemoryMax=512M

[Install]
WantedBy=multi-user.target
```

### 9.4 Deployment workflow (v1)

```bash
# Dev:
git push origin tidio-remake

# Server (one-line via SSH; also wrapped as infra/deploy.sh):
cd /opt/tidio-remake && git pull && \
  cd server && npm ci && npm run build && \
  cd ../console && npm ci && npm run build && \
  cd ../widget && npm ci && npm run build && \
  sudo systemctl restart tidio-remake
```

GitHub Actions auto-deploy is deferred to v2.

### 9.5 Backup

`infra/backup.sh`, daily via cron at 03:00:

```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d)
sqlite3 /var/lib/tidio-remake/chat.db ".backup '/var/lib/tidio-remake/backups/chat-$DATE.db'"
gzip /var/lib/tidio-remake/backups/chat-$DATE.db
find /var/lib/tidio-remake/backups -name "*.db.gz" -mtime +30 -delete
```

SQLite's `.backup` is online-safe; no service interruption.

### 9.6 DNS

`chat.simple1031x.com` → CNAME → `server.mortalitygame.com` (or A record to server IP if registrar disallows CNAME on subdomain).

### 9.7 One-time bootstrap (`infra/bootstrap.sh`)

1. `apt install caddy nodejs sqlite3` (Node 20 LTS via NodeSource)
2. Create `tidio` user + directory tree (`/opt`, `/var/lib`, `/etc`)
3. Generate `.env` (VAPID keypair via `web-push generate-vapid-keys`, signing secrets via `openssl rand -hex 32`)
4. Download MaxMind GeoLite2 (free w/ account; auto-update via cron monthly)
5. `git clone`, build, `systemctl enable --now tidio-remake`, `systemctl reload caddy`
6. Browse `https://chat.simple1031x.com/console` to set operator password (first-run wizard)

### 9.8 Site integration (one-line change to Simple-1031)

In each `Simple-1031/*.html` page, replace:
```html
<link rel="stylesheet" href="/css/chatbot-widget.css">
<script src="/js/chatbot-widget.js" defer></script>
```
with:
```html
<script src="https://chat.simple1031x.com/widget/chat-widget.js" defer></script>
```

(CSS is bundled into the widget JS to keep it one tag. Old `chatbot-widget.js` remains in the repo, just unloaded.)

---

## 10. Error Handling & Operations

### 10.1 Connection failures

- **Visitor WS drops**: widget retries with exponential backoff (1s → 2s → 4s → 8s → 15s cap), forever. On reconnect, sends `[hello]` with same IDs; server replays missed messages.
- **Operator WS drops**: console retries same way. State refetched via `[state_snapshot]`.
- **Visitor closes browser mid-chat**: server keeps conversation in `live` for 5 min (grace for reload/return). After 5 min of no WS, status → `abandoned`; if last visitor message was unread, push: *"Visitor abandoned chat — final message: '...'."*
- **Operator goes offline mid-chat**: visitor sees system note: *"Alex stepped away. We'll be right back."* If no return within 3 min, falls into Phase-2 capture flow — **but** if `visitors.email` is already known (e.g., a returning visitor or operator already captured contact via `update_visitor`), Phase-2 is skipped and the visitor sees a friendlier *"We'll follow up at the email on file"* message instead of a duplicate form.

### 10.2 Push subscription failures

- Web Push endpoints expire (browser uninstalled, push service rotated). `web-push` returns 410 → server deletes that row from `push_subscriptions`, continues with the rest.
- If ALL subscriptions return 410 AND no live operator WS, conversation still queues normally — operator sees it next time they open the console. Logged as warning.

### 10.3 Server failures

| Failure              | Behavior                                                                                       |
|----------------------|------------------------------------------------------------------------------------------------|
| Process crash        | systemd `Restart=on-failure` brings it back in ≤3s. State rebuilds from clients + SQLite.      |
| DB locked/corrupted  | WAL + `synchronous=NORMAL` is robust; daily backup is safety net                               |
| Disk 80% full        | Cron check logs WARN                                                                           |
| Disk 95% full        | Service refuses NEW conversations to protect existing; pushes alert to operator                |
| OOM                  | Not realistic at expected load (10k WS = ~100MB). `MemoryMax=512M` cap; restart on breach.     |

### 10.4 Race conditions handled explicitly

- Two operator messages typed during 1s WS dropout: client buffers with monotonic local IDs, sends on reconnect, server preserves order via `sent_at`. No silent loss.
- Visitor + operator messages interleaved: both stored, both fan out, no conflict.
- Operator clicks "ping visitor" twice fast: `open_chat` is idempotent (60-sec window). Second click is no-op or appends to existing conversation.

### 10.5 Observability

- All logs to `journalctl` (`journalctl -u tidio-remake -f`).
- Structured JSON via `pino` — grep/jq friendly.
- `GET /health` → `{status, uptime, sqliteOK, liveVisitors, openConversations}` (public, for uptime monitors like UptimeRobot free tier).
- `GET /metrics` (operator-auth required) → JSON with conversation counts, message rates, push success rate, WS counts. Settings page renders these.

---

## 11. Out of Scope for v1

| Feature                                         | Why deferred                                | Likely v |
|-------------------------------------------------|---------------------------------------------|----------|
| Operator notes on visitors                      | Nice-to-have, not blocking                  | v2       |
| HubSpot contact sync (read + write)             | Real integration work                       | v2       |
| Multi-operator / team support                   | Solo team in v1                             | v2       |
| AI bot integration (handoff to existing chatbot)| Existing bot isn't live yet                 | v2       |
| File / image attachments in chat                | Adds storage + scanning concerns            | v2       |
| Rules-based auto-greet (auto-send to visitor)   | Operator-side prompts cover this for v1     | v2       |
| Native React Native Android app                 | PWA covers it                               | v3 only if PWA push proves unreliable |
| Chat transcripts emailed to visitor             | Phase-2 capture covers most of this need    | v2       |
| Conversation tagging / categorization           | Volume too low to justify                   | v2       |
| GitHub Actions auto-deploy                      | `infra/deploy.sh` is one command            | v2       |
| Multi-server / horizontal scale                 | One Linux box handles 10k+ live visitors    | v3       |
| 2FA / magic-link on operator login              | Single-user, low risk                       | v2 (with team) |

---

## 12. Open Questions

1. ~~**Repo placement.**~~ **Resolved 2026-05-03:** standalone repo at `github.com/a-banoub/tidio-remake`. Spec stays in `Simple-1031/docs/superpowers/specs/` for historical context; future spec edits move with the standalone repo. Site integration (§9.8) ships as a one-line PR to `Simple-1031` referencing `https://chat.simple1031x.com/widget/chat-widget.js`.
2. **DNS provider.** Confirm CNAME is supported for `chat.simple1031x.com` at your DNS registrar (most do; Cloudflare and Namecheap both fine). If A-record only, we need the public IP of `server.mortalitygame.com`.
3. **MaxMind license.** GeoLite2 requires a free MaxMind account for downloading the `.mmdb` file. Operator action item: register, generate a license key, set up the auto-update cron.
4. **Operator email.** What email address should the operator account use for `VAPID_SUBJECT` (used in push notifications) and the magic-link recovery in v2? Default proposed: `alex@simple1031x.com`.

---

## 13. Acceptance Criteria for v1

The project is "done" when:

- [ ] Visitor on any `simple1031x.com` page sees the new widget; existing rule-based bot is unloaded.
- [ ] Operator console at `https://chat.simple1031x.com/console` is installable as a PWA on PC and Android; operator can log in.
- [ ] Live visitor list updates in real time when a new visitor lands; updates patch on page change, lead score change, scroll change.
- [ ] Visitor opens chat → operator (online) gets sound + visual notification → reply lands in visitor's widget within 1s of send.
- [ ] Visitor opens chat → operator (offline/away/DND/quiet hours) → operator's PWA on phone receives Web Push within 5s.
- [ ] 3-min timeout fires: visitor's composer is replaced by Phase-2 capture form; submit stores name/email/phone; operator gets a "lead captured" push.
- [ ] Operator clicks a hot visitor → modal lets them type a greeting → visitor's widget pops open with that greeting.
- [ ] Right rail shows lead score with breakdown, journey timeline, source/UTMs, geo/device, engagement signals, editable contact fields.
- [ ] Operator quick-reply chips work; operator can CRUD them in settings.
- [ ] Status toggle (Online / Away / DND) and quiet hours window respected by push fan-out.
- [ ] Server restart: visitors and operator reconnect within 5s, conversations restored.
- [ ] Daily SQLite backup running; backup restore tested.
- [ ] Health endpoint responds; metrics endpoint shows live counts.
