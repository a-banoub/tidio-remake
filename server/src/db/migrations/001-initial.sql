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

-- 7. Operators (one in v1, structured for more) -- moved up because messages.quick_reply_id references quick_replies
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

-- quick_replies (must come before messages because messages.quick_reply_id REFERENCES quick_replies)
CREATE TABLE quick_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator_id INTEGER NOT NULL REFERENCES operators(id),
  label TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

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

-- bearer token table for operator auth
CREATE TABLE operator_tokens (
  token TEXT PRIMARY KEY,
  operator_id INTEGER NOT NULL REFERENCES operators(id),
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
