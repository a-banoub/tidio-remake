# Tidio Remake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted live-chat console for `simple1031x.com` — visitor widget + Node WebSocket server + Preact PWA operator console — and deploy to `server.mortalitygame.com` behind Caddy.

**Architecture:** Standalone repo `tidio-remake` with three deployables in an npm workspace. Server is Node 20 + `ws` + `better-sqlite3`. Visitor widget is vanilla TS bundled to one IIFE. Operator console is Preact + Vite + Tailwind, served as a PWA with Web Push. All behind Caddy (auto-TLS) with systemd + cron.

**Tech Stack:** Node 20 LTS, TypeScript, `ws`, `better-sqlite3`, `web-push`, `maxmind`, `pino`, `@node-rs/argon2`, `dotenv`, Express, Preact, Vite, Tailwind, Vitest.

**Spec:** `Simple-1031/docs/superpowers/specs/2026-05-03-tidio-remake-design.md`

**Phases:**
1. Phase 0 — Repo scaffold + tooling (Tasks 0.1–0.4)
2. Phase 1 — Server core: DB + auth primitives (Tasks 1.1–1.11)
3. Phase 2 — Visitor WS protocol on the server (Tasks 2.1–2.8)
4. Phase 3 — Visitor widget MVP, end-to-end browser-to-server chat (Tasks 3.1–3.9)
5. Phase 4 — Operator WS protocol on the server (Tasks 4.1–4.8)
6. Phase 5 — Operator console MVP (Tasks 5.1–5.10)
7. Phase 6 — Proactive ping + status + quiet hours (Tasks 6.1–6.7)
8. Phase 7 — Lead score + journey + geo (Tasks 7.1–7.8)
9. Phase 8 — Web Push notifications (Tasks 8.1–8.5)
10. Phase 9 — PWA: service worker + manifest + offline (Tasks 9.1–9.5)
11. Phase 10 — Site integration + deploy infra + production launch (Tasks 10.1–10.9)
12. Phase 11 — Acceptance criteria validation (Task 11.1)

**Each phase ends in a working, demoable state.** Pause/resume between phases.

---

## Phase 0 — Repo Scaffold & Tooling

End-state: empty `tidio-remake` repo on GitHub with workspaces, TypeScript, Vitest, lint config, and a passing `npm test` (zero tests).

### Task 0.1: Create the standalone repo

**Files:**
- Create: `~/code/tidio-remake/.gitignore`
- Create: `~/code/tidio-remake/.nvmrc`
- Create: `~/code/tidio-remake/README.md`
- Create: `~/code/tidio-remake/LICENSE` (MIT)

- [ ] **Step 1: Create local repo directory and initialize git**

```bash
mkdir -p ~/code/tidio-remake
cd ~/code/tidio-remake
git init -b main
```

- [ ] **Step 2: Write `.nvmrc`**

```
20
```

- [ ] **Step 3: Write `.gitignore`**

```gitignore
node_modules/
dist/
build/
*.log
.env
.env.local
.DS_Store
coverage/
.vite/
*.db
*.db-shm
*.db-wal
.cache/
```

- [ ] **Step 4: Write minimal `README.md`**

```markdown
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
```

- [ ] **Step 5: Add MIT `LICENSE` file**

Standard MIT license text with `Copyright (c) 2026 Simple 1031 LLC` and `Alex Banoub`.

- [ ] **Step 6: Initial commit and create GitHub repo**

```bash
git add .
git commit -m "Initial scaffold: gitignore, nvmrc, README, license"
gh repo create a-banoub/tidio-remake --private --source=. --remote=origin --push
```

Verify: `gh repo view a-banoub/tidio-remake` returns repo info.

- [ ] **Step 7: Copy spec into the new repo**

```bash
mkdir -p docs
cp '/c/Users/alexa/OneDrive/Documents/Claude/Projects/Simple 1031/Simple-1031/docs/superpowers/specs/2026-05-03-tidio-remake-design.md' docs/spec.md
git add docs/spec.md
git commit -m "Copy design spec from Simple-1031 brainstorm"
git push
```

---

### Task 0.2: npm workspaces + TypeScript root config

**Files:**
- Create: `~/code/tidio-remake/package.json`
- Create: `~/code/tidio-remake/tsconfig.base.json`

- [ ] **Step 1: Write root `package.json`**

```json
{
  "name": "tidio-remake",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "server",
    "widget",
    "console"
  ],
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "dev": "npm run dev --workspaces --if-present",
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present"
  }
}
```

- [ ] **Step 2: Write shared `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json tsconfig.base.json
git commit -m "Add npm workspaces and shared tsconfig"
git push
```

---

### Task 0.3: Server workspace scaffold (TypeScript + Vitest + esbuild)

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/vitest.config.ts`
- Create: `server/src/index.ts` (placeholder)
- Create: `server/tests/sanity.test.ts`
- Create: `server/.eslintrc.cjs`

- [ ] **Step 1: Write `server/package.json`**

```json
{
  "name": "@tidio-remake/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "esbuild src/index.ts --bundle --platform=node --target=node20 --format=esm --outfile=dist/index.js --external:better-sqlite3 --external:@node-rs/argon2 --external:maxmind",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src tests --ext .ts"
  },
  "dependencies": {
    "@node-rs/argon2": "^1.8.0",
    "better-sqlite3": "^11.0.0",
    "dotenv": "^16.4.0",
    "express": "^4.19.0",
    "maxmind": "^4.3.0",
    "pino": "^9.0.0",
    "ua-parser-js": "^1.0.37",
    "web-push": "^3.6.0",
    "ws": "^8.16.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.11.0",
    "@types/ua-parser-js": "^0.7.39",
    "@types/web-push": "^3.6.0",
    "@types/ws": "^8.5.10",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "esbuild": "^0.20.0",
    "eslint": "^8.57.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 2: Write `server/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Write `server/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
});
```

- [ ] **Step 4: Write placeholder `server/src/index.ts`**

```typescript
export const VERSION = '0.1.0';

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Tidio Remake server v${VERSION} starting...`);
}
```

- [ ] **Step 5: Write sanity test `server/tests/sanity.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index.js';

describe('server sanity', () => {
  it('exports a version string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
```

- [ ] **Step 6: Write `server/.eslintrc.cjs`**

```javascript
module.exports = {
  root: false,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
```

- [ ] **Step 7: Install and verify**

```bash
cd ~/code/tidio-remake
npm install
cd server
npm test
```

Expected output: `1 passed (1)` from Vitest.

- [ ] **Step 8: Commit**

```bash
cd ~/code/tidio-remake
git add server/ package-lock.json
git commit -m "Server workspace: TypeScript + Vitest + esbuild scaffold"
git push
```

---

### Task 0.4: Widget and console workspaces (placeholders)

**Files:**
- Create: `widget/package.json`, `widget/tsconfig.json`, `widget/vite.config.ts`, `widget/src/index.ts`, `widget/tests/sanity.test.ts`
- Create: `console/package.json`, `console/tsconfig.json`, `console/vite.config.ts`, `console/index.html`, `console/src/main.tsx`, `console/tests/sanity.test.tsx`
- Create: `console/tailwind.config.js`, `console/postcss.config.js`, `console/src/styles.css`

- [ ] **Step 1: Write `widget/package.json`**

```json
{
  "name": "@tidio-remake/widget",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "test": "vitest run"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.3.0",
    "vite": "^5.2.0",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 2: Write `widget/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['iife'],
      name: 'TidioRemake',
      fileName: () => 'chat-widget.js',
    },
    rollupOptions: { output: { extend: true } },
    cssCodeSplit: false,
    minify: 'esbuild',
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Write `widget/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 4: Write `widget/src/index.ts` placeholder**

```typescript
export const WIDGET_VERSION = '0.1.0';
console.log(`[TidioRemake] widget v${WIDGET_VERSION}`);
```

- [ ] **Step 5: Write `widget/tests/sanity.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { WIDGET_VERSION } from '../src/index.js';

describe('widget sanity', () => {
  it('exports a version', () => {
    expect(WIDGET_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
```

- [ ] **Step 6: Write `console/package.json`**

```json
{
  "name": "@tidio-remake/console",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@preact/signals": "^1.2.0",
    "preact": "^10.20.0",
    "preact-router": "^4.1.0"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.8.0",
    "@testing-library/preact": "^3.2.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^24.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.2.0",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 7: Write `console/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  server: { port: 5173 },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: true },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.tsx'],
  },
});
```

- [ ] **Step 8: Write `console/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 9: Write `console/tailwind.config.js`**

```javascript
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 500: '#2563eb', 600: '#1d4ed8' },
      },
    },
  },
};
```

- [ ] **Step 10: Write `console/postcss.config.js`**

```javascript
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 11: Write `console/src/styles.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 12: Write `console/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tidio Remake Console</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 13: Write `console/src/main.tsx`**

```tsx
import { render } from 'preact';
import './styles.css';

export const CONSOLE_VERSION = '0.1.0';

function App() {
  return <div className="p-8 text-slate-900">Tidio Remake Console v{CONSOLE_VERSION}</div>;
}

render(<App />, document.getElementById('app')!);
```

- [ ] **Step 14: Write `console/tests/sanity.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { CONSOLE_VERSION } from '../src/main.js';

describe('console sanity', () => {
  it('exports a version', () => {
    expect(CONSOLE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
```

- [ ] **Step 15: Install all and run all tests**

```bash
cd ~/code/tidio-remake
npm install
npm test
```

Expected: 3 test files pass (server, widget, console sanity).

- [ ] **Step 16: Commit**

```bash
git add .
git commit -m "Widget and console workspaces with sanity tests"
git push
```

---

**Phase 0 done.** You can now `npm test` from repo root and 3 workspaces pass. No production code yet — this is the foundation.

---

## Phase 1 — Server Core: DB + Auth Primitives

End-state: server has SQLite with full schema, repository layer for every table, ID generation, visitor cookie HMAC, argon2 password hashing, operator token validation. All unit tests pass.

### Task 1.1: Environment loader

**Files:**
- Create: `server/src/env.ts`
- Create: `server/tests/env.test.ts`
- Create: `server/.env.example`

- [ ] **Step 1: Write failing test `server/tests/env.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { loadEnv } from '../src/env.js';

describe('loadEnv', () => {
  beforeEach(() => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';
    process.env.VISITOR_COOKIE_SECRET = 'a'.repeat(64);
    process.env.OPERATOR_PASSWORD_PEPPER = 'b'.repeat(64);
    process.env.DATABASE_PATH = '/tmp/test.db';
  });

  it('parses required env vars', () => {
    const env = loadEnv();
    expect(env.VAPID_SUBJECT).toBe('mailto:test@example.com');
  });

  it('throws on missing var', () => {
    delete process.env.VAPID_PUBLIC_KEY;
    expect(() => loadEnv()).toThrow(/VAPID_PUBLIC_KEY/);
  });

  it('rejects too-short secret', () => {
    process.env.VISITOR_COOKIE_SECRET = 'short';
    expect(() => loadEnv()).toThrow(/VISITOR_COOKIE_SECRET/);
  });
});
```

- [ ] **Step 2: Run, expect fail (`Cannot find module '../src/env.js'`)**

```bash
cd server && npm test -- env
```

- [ ] **Step 3: Implement `server/src/env.ts`**

```typescript
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().regex(/^mailto:.+/),
  VISITOR_COOKIE_SECRET: z.string().min(64, 'VISITOR_COOKIE_SECRET must be at least 64 hex chars'),
  OPERATOR_PASSWORD_PEPPER: z.string().min(64, 'OPERATOR_PASSWORD_PEPPER must be at least 64 hex chars'),
  DATABASE_PATH: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(8080),
  GEOIP_DB_PATH: z.string().default('/var/lib/tidio-remake/GeoLite2-City.mmdb'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const msg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid environment:\n${msg}`);
  }
  return result.data;
}
```

- [ ] **Step 4: Run test, expect pass.**

- [ ] **Step 5: Write `server/.env.example`**

```
# Generate with: openssl rand -hex 32
VISITOR_COOKIE_SECRET=
OPERATOR_PASSWORD_PEPPER=

# Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:alex@simple1031x.com

DATABASE_PATH=./dev.db
GEOIP_DB_PATH=./GeoLite2-City.mmdb
PORT=8080
LOG_LEVEL=info
NODE_ENV=development
```

- [ ] **Step 6: Commit**

```bash
git add server/src/env.ts server/tests/env.test.ts server/.env.example
git commit -m "Server: env loader with Zod validation"
git push
```

---

### Task 1.2: Logger setup

**Files:** `server/src/logger.ts`, `server/tests/logger.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { logger, createLogger } from '../src/logger.js';

describe('logger', () => {
  it('exports a default logger', () => {
    expect(typeof logger.info).toBe('function');
  });
  it('createLogger returns child', () => {
    const child = createLogger({ component: 'test' });
    expect(typeof child.info).toBe('function');
  });
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `server/src/logger.ts`**

```typescript
import pino from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';
const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level,
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } }
    : undefined,
});

export function createLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
```

- [ ] **Step 4: Add dev dep + run test + commit**

```bash
cd server && npm install -D pino-pretty
npm test -- logger
git add server/src/logger.ts server/tests/logger.test.ts server/package.json package-lock.json
git commit -m "Server: pino logger" && git push
```

---

### Task 1.3: ID generation utilities

**Files:** `server/src/ids.ts`, `server/tests/ids.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { newVisitorId, newSessionId, newConversationId, newToken } from '../src/ids.js';

describe('id generators', () => {
  it('newVisitorId starts with v_ and is unique', () => {
    const a = newVisitorId(), b = newVisitorId();
    expect(a).toMatch(/^v_[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
  it('newSessionId starts with s_', () => {
    expect(newSessionId()).toMatch(/^s_[0-9a-f]{12}$/);
  });
  it('newConversationId starts with c_', () => {
    expect(newConversationId()).toMatch(/^c_[0-9a-f]{16}$/);
  });
  it('newToken returns 64 hex chars', () => {
    expect(newToken()).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Implement `server/src/ids.ts`**

```typescript
import { randomBytes } from 'node:crypto';
const hex = (n: number) => randomBytes(n).toString('hex');
export const newVisitorId = () => `v_${hex(6)}`;
export const newSessionId = () => `s_${hex(6)}`;
export const newConversationId = () => `c_${hex(8)}`;
export const newToken = () => hex(32);
```

- [ ] **Step 3: Run test, commit**

```bash
git add server/src/ids.ts server/tests/ids.test.ts
git commit -m "Server: ID generation utilities" && git push
```

---

### Task 1.4: SQLite client + migration runner + initial schema

**Files:** `server/src/db/client.ts`, `server/src/db/migrate.ts`, `server/tests/db/migrate.test.ts`, `server/src/db/migrations/001-initial.sql`

- [ ] **Step 1: Write the full schema in `server/src/db/migrations/001-initial.sql`** (entire content from spec §5.1, copy verbatim — see spec for the SQL). Includes: `migrations` (bookkeeping), `visitors`, `sessions` (with `current_lead_score INTEGER NOT NULL DEFAULT 0`), `page_views`, `lead_signals`, `conversations`, `quick_replies`, `messages`, `operators`, `push_subscriptions`, `operator_tokens`. All indexes from spec.

- [ ] **Step 2: Implement `server/src/db/client.ts`**

```typescript
import Database from 'better-sqlite3';
import { logger } from '../logger.js';

export type DB = Database.Database;

export function openDb(path: string): DB {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  logger.info({ path }, 'database opened');
  return db;
}
```

- [ ] **Step 3: Implement `server/src/db/migrate.ts`**

```typescript
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from './client.js';
import { logger } from '../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

export function migrate(db: DB): void {
  db.exec('CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const applied = new Set(db.prepare('SELECT id FROM migrations').all().map((r: any) => r.id));
  const files = readdirSync(MIGRATIONS_DIR).filter(f => /^\d{3}-.*\.sql$/.test(f)).sort();
  for (const file of files) {
    const id = parseInt(file.slice(0, 3), 10);
    if (applied.has(id)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO migrations (id, applied_at) VALUES (?, ?)').run(id, Date.now());
    })();
    logger.info({ id, file }, 'migration applied');
  }
}
```

- [ ] **Step 4: Write `server/tests/db/migrate.test.ts`**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { openDb } from '../../src/db/client.js';
import { migrate } from '../../src/db/migrate.js';
import { unlinkSync } from 'node:fs';
const TEST_DB = '/tmp/tidio-test-migrate.db';
afterEach(() => { for (const ext of ['', '-wal', '-shm']) { try { unlinkSync(TEST_DB + ext); } catch {} } });

describe('migrate', () => {
  it('creates all tables on fresh db', () => {
    const db = openDb(TEST_DB);
    migrate(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    for (const t of ['visitors', 'sessions', 'messages', 'operators', 'conversations', 'page_views', 'lead_signals', 'push_subscriptions', 'operator_tokens', 'quick_replies']) {
      expect(tables).toContain(t);
    }
    db.close();
  });
  it('is idempotent', () => {
    const db = openDb(TEST_DB);
    migrate(db); migrate(db);
    expect((db.prepare('SELECT COUNT(*) as c FROM migrations').get() as any).c).toBe(1);
    db.close();
  });
});
```

- [ ] **Step 5: Update `server/package.json` `build` script to copy migrations to dist**

Replace the `build` script with:
```
"build": "esbuild src/index.ts --bundle --platform=node --target=node20 --format=esm --outfile=dist/index.js --external:better-sqlite3 --external:@node-rs/argon2 --external:maxmind && node -e \"require('fs').cpSync('src/db/migrations','dist/db/migrations',{recursive:true})\""
```

- [ ] **Step 6: Run test + commit**

```bash
cd server && npm test -- migrate
git add server/src/db server/tests/db server/package.json
git commit -m "Server: SQLite client + migration runner + 001-initial schema" && git push
```

---

### Task 1.5: Visitor cookie HMAC sign/verify

**Files:** `server/src/auth/visitorCookie.ts`, `server/tests/auth/visitorCookie.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { signVisitorCookie, verifyVisitorCookie } from '../../src/auth/visitorCookie.js';

const SECRET = 'a'.repeat(64);

describe('visitor cookie', () => {
  it('signs then verifies', () => {
    const t = signVisitorCookie('v_abc', 's_123', SECRET);
    expect(verifyVisitorCookie(t, SECRET)).toMatchObject({ visitorId: 'v_abc', sessionId: 's_123' });
  });
  it('rejects tampered token', () => {
    const t = signVisitorCookie('v_abc', 's_123', SECRET);
    expect(verifyVisitorCookie(t.slice(0, -2) + 'XX', SECRET)).toBeNull();
  });
  it('rejects wrong secret', () => {
    const t = signVisitorCookie('v_abc', 's_123', SECRET);
    expect(verifyVisitorCookie(t, 'b'.repeat(64))).toBeNull();
  });
});
```

- [ ] **Step 2: Implement `server/src/auth/visitorCookie.ts`**

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto';

export type VisitorCookiePayload = { visitorId: string; sessionId: string; issuedAt: number };

export function signVisitorCookie(visitorId: string, sessionId: string, secret: string): string {
  const issuedAt = Date.now();
  const payload = `${visitorId}.${sessionId}.${issuedAt}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyVisitorCookie(token: string, secret: string): VisitorCookiePayload | null {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [visitorId, sessionId, issuedAtStr, sig] = parts;
  const expected = createHmac('sha256', secret).update(`${visitorId}.${sessionId}.${issuedAtStr}`).digest('hex');
  const a = Buffer.from(sig, 'hex'), b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const issuedAt = parseInt(issuedAtStr, 10);
  if (!Number.isFinite(issuedAt)) return null;
  return { visitorId, sessionId, issuedAt };
}
```

- [ ] **Step 3: Run test + commit**

```bash
git add server/src/auth/visitorCookie.ts server/tests/auth/visitorCookie.test.ts
git commit -m "Server: visitor cookie HMAC sign/verify" && git push
```

---

### Task 1.6: Argon2 password hashing wrapper

**Files:** `server/src/auth/password.ts`, `server/tests/auth/password.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/auth/password.js';

const PEPPER = 'p'.repeat(64);

describe('password', () => {
  it('hashes and verifies', async () => {
    const h = await hashPassword('secret', PEPPER);
    expect(h).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword('secret', h, PEPPER)).toBe(true);
  });
  it('rejects wrong password', async () => {
    const h = await hashPassword('secret', PEPPER);
    expect(await verifyPassword('nope', h, PEPPER)).toBe(false);
  });
  it('rejects when pepper changes', async () => {
    const h = await hashPassword('secret', PEPPER);
    expect(await verifyPassword('secret', h, 'q'.repeat(64))).toBe(false);
  });
});
```

- [ ] **Step 2: Implement `server/src/auth/password.ts`**

```typescript
import { hash, verify, Algorithm } from '@node-rs/argon2';
const OPTIONS = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export async function hashPassword(password: string, pepper: string): Promise<string> {
  return hash(password + pepper, OPTIONS);
}
export async function verifyPassword(password: string, hashStr: string, pepper: string): Promise<boolean> {
  try { return await verify(hashStr, password + pepper); } catch { return false; }
}
```

- [ ] **Step 3: Run + commit**

```bash
git add server/src/auth/password.ts server/tests/auth/password.test.ts
git commit -m "Server: argon2id password hashing with pepper" && git push
```

---

### Task 1.7: Repository — visitors + shared test helper

**Files:** `server/tests/helpers/testDb.ts`, `server/src/repositories/visitors.ts`, `server/tests/repositories/visitors.test.ts`

- [ ] **Step 1: Write `server/tests/helpers/testDb.ts`**

```typescript
import { openDb, type DB } from '../../src/db/client.js';
import { migrate } from '../../src/db/migrate.js';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function makeTestDb(name: string): DB {
  const path = join(tmpdir(), `tidio-test-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  const db = openDb(path);
  migrate(db);
  return db;
}
```

- [ ] **Step 2: Failing test `server/tests/repositories/visitors.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';

describe('VisitorsRepo', () => {
  it('upsert + findById', () => {
    const db = makeTestDb('v1');
    const repo = new VisitorsRepo(db);
    repo.upsert('v_a', 1000);
    expect(repo.findById('v_a')).toMatchObject({ first_seen_at: 1000, last_seen_at: 1000 });
    repo.upsert('v_a', 2000);
    expect(repo.findById('v_a')).toMatchObject({ first_seen_at: 1000, last_seen_at: 2000 });
  });
  it('updateContact patches', () => {
    const db = makeTestDb('v2');
    const repo = new VisitorsRepo(db);
    repo.upsert('v_a', 1000);
    repo.updateContact('v_a', { name: 'Mike', email: 'm@e.com' });
    expect(repo.findById('v_a')).toMatchObject({ name: 'Mike', email: 'm@e.com', phone: null });
  });
});
```

- [ ] **Step 3: Implement `server/src/repositories/visitors.ts`**

```typescript
import type { DB } from '../db/client.js';

export type Visitor = {
  id: string; first_seen_at: number; last_seen_at: number;
  name: string | null; email: string | null; phone: string | null;
  hubspot_contact_id: string | null;
};

export class VisitorsRepo {
  constructor(private db: DB) {}

  upsert(id: string, ts: number): void {
    this.db.prepare(`
      INSERT INTO visitors (id, first_seen_at, last_seen_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at
    `).run(id, ts, ts);
  }

  findById(id: string): Visitor | undefined {
    return this.db.prepare('SELECT * FROM visitors WHERE id = ?').get(id) as Visitor | undefined;
  }

  updateContact(id: string, patch: { name?: string; email?: string; phone?: string }): void {
    const sets: string[] = []; const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v); }
    }
    if (!sets.length) return;
    vals.push(id);
    this.db.prepare(`UPDATE visitors SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }
}
```

- [ ] **Step 4: Run tests + commit**

```bash
cd server && npm test
git add server/tests/helpers server/src/repositories/visitors.ts server/tests/repositories/visitors.test.ts
git commit -m "Server: VisitorsRepo with shared testDb helper" && git push
```

---

### Task 1.8: Repository — sessions

**Files:** `server/src/repositories/sessions.ts`, `server/tests/repositories/sessions.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';
import { SessionsRepo } from '../../src/repositories/sessions.js';

describe('SessionsRepo', () => {
  it('create + findById + bumpLeadScore', () => {
    const db = makeTestDb('s1');
    new VisitorsRepo(db).upsert('v_a', 1000);
    const repo = new SessionsRepo(db);
    repo.create({ id: 's_1', visitor_id: 'v_a', started_at: 1000, landing_url: '/x', utm_source: 'g', utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, gclid: null, fbclid: null, referrer: null, ip: '1.1.1.1', city: 'LV', region: 'NV', country: 'US', timezone: 'America/Los_Angeles', device_type: 'desktop', browser: 'Chrome', os: 'macOS' });
    expect(repo.findById('s_1')?.utm_source).toBe('g');
    repo.bumpLeadScore('s_1', 3); repo.bumpLeadScore('s_1', 2);
    expect(repo.findById('s_1')?.current_lead_score).toBe(5);
  });
});
```

- [ ] **Step 2: Implement `server/src/repositories/sessions.ts`**

```typescript
import type { DB } from '../db/client.js';

export type Session = {
  id: string; visitor_id: string; started_at: number; ended_at: number | null;
  landing_url: string | null;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
  utm_term: string | null; utm_content: string | null;
  gclid: string | null; fbclid: string | null; referrer: string | null;
  ip: string | null; city: string | null; region: string | null; country: string | null; timezone: string | null;
  device_type: string | null; browser: string | null; os: string | null;
  current_lead_score: number;
};

export type CreateSessionInput = Omit<Session, 'ended_at' | 'current_lead_score'>;

export class SessionsRepo {
  constructor(private db: DB) {}

  create(i: CreateSessionInput): void {
    this.db.prepare(`
      INSERT INTO sessions (id, visitor_id, started_at, landing_url,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        gclid, fbclid, referrer, ip,
        city, region, country, timezone,
        device_type, browser, os)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(i.id, i.visitor_id, i.started_at, i.landing_url,
      i.utm_source, i.utm_medium, i.utm_campaign, i.utm_term, i.utm_content,
      i.gclid, i.fbclid, i.referrer, i.ip,
      i.city, i.region, i.country, i.timezone,
      i.device_type, i.browser, i.os);
  }

  findById(id: string): Session | undefined {
    return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
  }

  bumpLeadScore(id: string, delta: number): void {
    this.db.prepare('UPDATE sessions SET current_lead_score = current_lead_score + ? WHERE id = ?').run(delta, id);
  }

  end(id: string, ts: number): void {
    this.db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(ts, id);
  }
}
```

- [ ] **Step 3: Run tests + commit**

```bash
git add server/src/repositories/sessions.ts server/tests/repositories/sessions.test.ts
git commit -m "Server: SessionsRepo" && git push
```

---

### Task 1.9: Repositories — pageViews + leadSignals

**Files:** `server/src/repositories/pageViews.ts`, `server/src/repositories/leadSignals.ts`, plus their `.test.ts` files.

- [ ] **Step 1: Failing test for pageViews**

```typescript
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';
import { SessionsRepo } from '../../src/repositories/sessions.js';
import { PageViewsRepo } from '../../src/repositories/pageViews.js';

describe('PageViewsRepo', () => {
  it('enter + updateScroll + leave', () => {
    const db = makeTestDb('pv');
    new VisitorsRepo(db).upsert('v_a', 1000);
    new SessionsRepo(db).create({ id: 's_1', visitor_id: 'v_a', started_at: 1000, landing_url: null, utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, gclid: null, fbclid: null, referrer: null, ip: null, city: null, region: null, country: null, timezone: null, device_type: null, browser: null, os: null });
    const repo = new PageViewsRepo(db);
    const id = repo.enter('s_1', '/index.html', 'Home', 1000);
    repo.updateScroll(id, 50);
    repo.updateScroll(id, 30); // shouldn't lower
    repo.leave(id, 2000);
    const rows = repo.listForSession('s_1');
    expect(rows[0].max_scroll_pct).toBe(50);
    expect(rows[0].left_at).toBe(2000);
  });
});
```

- [ ] **Step 2: Implement `server/src/repositories/pageViews.ts`**

```typescript
import type { DB } from '../db/client.js';

export type PageView = {
  id: number; session_id: string; url: string; title: string | null;
  entered_at: number; left_at: number | null;
  max_scroll_pct: number; exit_intent: number;
};

export class PageViewsRepo {
  constructor(private db: DB) {}

  enter(sessionId: string, url: string, title: string | null, ts: number): number {
    return Number(this.db.prepare(
      'INSERT INTO page_views (session_id, url, title, entered_at) VALUES (?, ?, ?, ?)'
    ).run(sessionId, url, title, ts).lastInsertRowid);
  }
  leave(id: number, ts: number): void {
    this.db.prepare('UPDATE page_views SET left_at = ? WHERE id = ? AND left_at IS NULL').run(ts, id);
  }
  updateScroll(id: number, pct: number): void {
    this.db.prepare('UPDATE page_views SET max_scroll_pct = MAX(max_scroll_pct, ?) WHERE id = ?').run(pct, id);
  }
  markExitIntent(id: number): void {
    this.db.prepare('UPDATE page_views SET exit_intent = 1 WHERE id = ?').run(id);
  }
  listForSession(sessionId: string): PageView[] {
    return this.db.prepare('SELECT * FROM page_views WHERE session_id = ? ORDER BY entered_at').all(sessionId) as PageView[];
  }
}
```

- [ ] **Step 3: Failing test for leadSignals**

```typescript
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';
import { SessionsRepo } from '../../src/repositories/sessions.js';
import { LeadSignalsRepo } from '../../src/repositories/leadSignals.js';

describe('LeadSignalsRepo', () => {
  it('insert + list', () => {
    const db = makeTestDb('ls');
    new VisitorsRepo(db).upsert('v_a', 1000);
    new SessionsRepo(db).create({ id: 's_1', visitor_id: 'v_a', started_at: 1000, landing_url: null, utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, gclid: null, fbclid: null, referrer: null, ip: null, city: null, region: null, country: null, timezone: null, device_type: null, browser: null, os: null });
    const repo = new LeadSignalsRepo(db);
    repo.insert('s_1', 'calculator_used', { sale: 1200000 }, 3, 1500);
    const rows = repo.listForSession('s_1');
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].payload!).sale).toBe(1200000);
  });
});
```

- [ ] **Step 4: Implement `server/src/repositories/leadSignals.ts`**

```typescript
import type { DB } from '../db/client.js';

export type LeadSignal = {
  id: number; session_id: string; kind: string;
  payload: string | null; score_delta: number; created_at: number;
};

export class LeadSignalsRepo {
  constructor(private db: DB) {}

  insert(sessionId: string, kind: string, payload: unknown, scoreDelta: number, ts: number): number {
    return Number(this.db.prepare(
      'INSERT INTO lead_signals (session_id, kind, payload, score_delta, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(sessionId, kind, payload === undefined ? null : JSON.stringify(payload), scoreDelta, ts).lastInsertRowid);
  }

  listForSession(sessionId: string): LeadSignal[] {
    return this.db.prepare('SELECT * FROM lead_signals WHERE session_id = ? ORDER BY created_at').all(sessionId) as LeadSignal[];
  }
}
```

- [ ] **Step 5: Run + commit**

```bash
git add server/src/repositories/{pageViews,leadSignals}.ts server/tests/repositories/{pageViews,leadSignals}.test.ts
git commit -m "Server: PageViewsRepo + LeadSignalsRepo" && git push
```

---

### Task 1.10: Repositories — conversations + messages

**Files:** `server/src/repositories/{conversations,messages}.ts` + tests.

- [ ] **Step 1: Failing test for conversations**

```typescript
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';
import { ConversationsRepo } from '../../src/repositories/conversations.js';

describe('ConversationsRepo', () => {
  it('create + findById + setStatus + closed_at on close', () => {
    const db = makeTestDb('c1');
    new VisitorsRepo(db).upsert('v_a', 1000);
    const repo = new ConversationsRepo(db);
    repo.create({ id: 'c_1', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 1000, initiated_by: 'visitor' });
    expect(repo.findById('c_1')?.status).toBe('live');
    repo.setStatus('c_1', 'closed', 2000);
    const c = repo.findById('c_1');
    expect(c?.status).toBe('closed');
    expect(c?.closed_at).toBe(2000);
  });
  it('findOpenForVisitor returns most recent open', () => {
    const db = makeTestDb('c2');
    new VisitorsRepo(db).upsert('v_a', 1000);
    const repo = new ConversationsRepo(db);
    repo.create({ id: 'c_old', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 1000, initiated_by: 'visitor' });
    repo.create({ id: 'c_new', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 5000, initiated_by: 'visitor' });
    repo.bumpLastMessageAt('c_new', 5000);
    expect(repo.findOpenForVisitor('v_a', 0)?.id).toBe('c_new');
  });
});
```

- [ ] **Step 2: Implement `server/src/repositories/conversations.ts`**

```typescript
import type { DB } from '../db/client.js';

export type ConversationStatus = 'live' | 'queued' | 'closed' | 'abandoned' | 'closed_for_followup';
export type ConversationInitiator = 'visitor' | 'operator';

export type Conversation = {
  id: string; visitor_id: string; opened_session_id: string | null;
  status: ConversationStatus; opened_at: number; closed_at: number | null;
  last_message_at: number; initiated_by: ConversationInitiator;
  timeout_capture: string | null;
};

export class ConversationsRepo {
  constructor(private db: DB) {}

  create(i: { id: string; visitor_id: string; opened_session_id: string | null; status: ConversationStatus; opened_at: number; initiated_by: ConversationInitiator }): void {
    this.db.prepare(`
      INSERT INTO conversations (id, visitor_id, opened_session_id, status, opened_at, last_message_at, initiated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(i.id, i.visitor_id, i.opened_session_id, i.status, i.opened_at, i.opened_at, i.initiated_by);
  }

  findById(id: string): Conversation | undefined {
    return this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation | undefined;
  }

  setStatus(id: string, status: ConversationStatus, ts: number): void {
    if (['closed', 'abandoned', 'closed_for_followup'].includes(status)) {
      this.db.prepare('UPDATE conversations SET status = ?, closed_at = ? WHERE id = ?').run(status, ts, id);
    } else {
      this.db.prepare('UPDATE conversations SET status = ? WHERE id = ?').run(status, id);
    }
  }

  bumpLastMessageAt(id: string, ts: number): void {
    this.db.prepare('UPDATE conversations SET last_message_at = ? WHERE id = ?').run(ts, id);
  }

  setTimeoutCapture(id: string, capture: { name?: string; email?: string; phone?: string }): void {
    this.db.prepare('UPDATE conversations SET timeout_capture = ? WHERE id = ?').run(JSON.stringify(capture), id);
  }

  findOpenForVisitor(visitorId: string, sinceTs: number): Conversation | undefined {
    return this.db.prepare(`
      SELECT * FROM conversations
      WHERE visitor_id = ? AND status IN ('live','queued') AND last_message_at >= ?
      ORDER BY last_message_at DESC LIMIT 1
    `).get(visitorId, sinceTs) as Conversation | undefined;
  }

  listOpenAndQueued(): Conversation[] {
    return this.db.prepare("SELECT * FROM conversations WHERE status IN ('live','queued') ORDER BY last_message_at DESC").all() as Conversation[];
  }
}
```

- [ ] **Step 3: Failing test for messages**

```typescript
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';
import { ConversationsRepo } from '../../src/repositories/conversations.js';
import { MessagesRepo } from '../../src/repositories/messages.js';

describe('MessagesRepo', () => {
  it('insert + list + markSeen', () => {
    const db = makeTestDb('m1');
    new VisitorsRepo(db).upsert('v_a', 1000);
    new ConversationsRepo(db).create({ id: 'c_1', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 1000, initiated_by: 'visitor' });
    const repo = new MessagesRepo(db);
    const m1 = repo.insert({ conversation_id: 'c_1', sender: 'visitor', body: 'hi', sent_at: 1000 });
    repo.insert({ conversation_id: 'c_1', sender: 'operator', body: 'hello', sent_at: 1500 });
    expect(repo.listByConversation('c_1')).toHaveLength(2);
    repo.markSeen(m1.id, 2000);
    expect(repo.findById(m1.id)?.seen_at).toBe(2000);
  });
});
```

- [ ] **Step 4: Implement `server/src/repositories/messages.ts`**

```typescript
import type { DB } from '../db/client.js';

export type MessageSender = 'visitor' | 'operator' | 'system';

export type Message = {
  id: number; conversation_id: string; sender: MessageSender;
  body: string; sent_at: number; seen_at: number | null;
  quick_reply_id: number | null;
};

export class MessagesRepo {
  constructor(private db: DB) {}

  insert(i: { conversation_id: string; sender: MessageSender; body: string; sent_at: number; quick_reply_id?: number | null }): Message {
    const id = Number(this.db.prepare(`
      INSERT INTO messages (conversation_id, sender, body, sent_at, quick_reply_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(i.conversation_id, i.sender, i.body, i.sent_at, i.quick_reply_id ?? null).lastInsertRowid);
    return this.findById(id)!;
  }

  findById(id: number): Message | undefined {
    return this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Message | undefined;
  }

  listByConversation(conversationId: string, limit = 100): Message[] {
    return this.db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY sent_at LIMIT ?').all(conversationId, limit) as Message[];
  }

  markSeen(id: number, ts: number): void {
    this.db.prepare('UPDATE messages SET seen_at = ? WHERE id = ? AND seen_at IS NULL').run(ts, id);
  }

  markAllSeenInConversation(conversationId: string, upToId: number, ts: number): void {
    this.db.prepare(`
      UPDATE messages SET seen_at = ?
      WHERE conversation_id = ? AND id <= ? AND seen_at IS NULL AND sender = 'visitor'
    `).run(ts, conversationId, upToId);
  }
}
```

- [ ] **Step 5: Run all server tests + commit**

```bash
cd server && npm test
git add server/src/repositories/{conversations,messages}.ts server/tests/repositories/{conversations,messages}.test.ts
git commit -m "Server: ConversationsRepo + MessagesRepo" && git push
```

---

### Task 1.11: Repositories — operators + tokens + push subscriptions + quick replies

**Files:** `server/src/repositories/{operators,operatorTokens,pushSubscriptions,quickReplies}.ts` + a single combined test file `server/tests/repositories/operatorRelated.test.ts`.

- [ ] **Step 1: Implement `server/src/repositories/operators.ts`**

```typescript
import type { DB } from '../db/client.js';

export type OperatorStatus = 'online' | 'away' | 'dnd';

export type Operator = {
  id: number; email: string; password_hash: string; display_name: string;
  status: OperatorStatus; timezone: string;
  quiet_hours_start: string | null; quiet_hours_end: string | null;
  created_at: number;
};

export class OperatorsRepo {
  constructor(private db: DB) {}

  create(i: { email: string; password_hash: string; display_name: string; timezone?: string; created_at: number }): number {
    return Number(this.db.prepare(`
      INSERT INTO operators (email, password_hash, display_name, timezone, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(i.email, i.password_hash, i.display_name, i.timezone ?? 'America/Los_Angeles', i.created_at).lastInsertRowid);
  }

  findByEmail(email: string): Operator | undefined {
    return this.db.prepare('SELECT * FROM operators WHERE email = ?').get(email) as Operator | undefined;
  }
  findById(id: number): Operator | undefined {
    return this.db.prepare('SELECT * FROM operators WHERE id = ?').get(id) as Operator | undefined;
  }
  setStatus(id: number, status: OperatorStatus): void {
    this.db.prepare('UPDATE operators SET status = ? WHERE id = ?').run(status, id);
  }
  setQuietHours(id: number, start: string | null, end: string | null): void {
    this.db.prepare('UPDATE operators SET quiet_hours_start = ?, quiet_hours_end = ? WHERE id = ?').run(start, end, id);
  }
  countAll(): number {
    return (this.db.prepare('SELECT COUNT(*) as c FROM operators').get() as any).c;
  }
}
```

- [ ] **Step 2: Implement `server/src/repositories/operatorTokens.ts`**

```typescript
import type { DB } from '../db/client.js';

export class OperatorTokensRepo {
  constructor(private db: DB) {}

  create(token: string, operatorId: number, ts: number): void {
    this.db.prepare('INSERT INTO operator_tokens (token, operator_id, created_at) VALUES (?, ?, ?)').run(token, operatorId, ts);
  }

  findOperatorIdByToken(token: string, ts: number): number | undefined {
    const row = this.db.prepare('SELECT operator_id FROM operator_tokens WHERE token = ?').get(token) as any;
    if (!row) return undefined;
    this.db.prepare('UPDATE operator_tokens SET last_used_at = ? WHERE token = ?').run(ts, token);
    return row.operator_id;
  }

  revoke(token: string): void {
    this.db.prepare('DELETE FROM operator_tokens WHERE token = ?').run(token);
  }
}
```

- [ ] **Step 3: Implement `server/src/repositories/pushSubscriptions.ts`**

```typescript
import type { DB } from '../db/client.js';

export type PushSubscriptionRow = {
  id: number; operator_id: number; endpoint: string;
  p256dh: string; auth: string; device_label: string | null;
  created_at: number; last_used_at: number | null;
};

export class PushSubscriptionsRepo {
  constructor(private db: DB) {}

  upsert(i: { operator_id: number; endpoint: string; p256dh: string; auth: string; device_label?: string; created_at: number }): void {
    this.db.prepare(`
      INSERT INTO push_subscriptions (operator_id, endpoint, p256dh, auth, device_label, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, device_label = excluded.device_label
    `).run(i.operator_id, i.endpoint, i.p256dh, i.auth, i.device_label ?? null, i.created_at);
  }

  listForOperator(operatorId: number): PushSubscriptionRow[] {
    return this.db.prepare('SELECT * FROM push_subscriptions WHERE operator_id = ?').all(operatorId) as PushSubscriptionRow[];
  }

  deleteByEndpoint(endpoint: string): void {
    this.db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  }

  bumpLastUsed(id: number, ts: number): void {
    this.db.prepare('UPDATE push_subscriptions SET last_used_at = ? WHERE id = ?').run(ts, id);
  }
}
```

- [ ] **Step 4: Implement `server/src/repositories/quickReplies.ts`**

```typescript
import type { DB } from '../db/client.js';

export type QuickReply = { id: number; operator_id: number; label: string; body: string; sort_order: number };

export class QuickRepliesRepo {
  constructor(private db: DB) {}

  list(operatorId: number): QuickReply[] {
    return this.db.prepare('SELECT * FROM quick_replies WHERE operator_id = ? ORDER BY sort_order, id').all(operatorId) as QuickReply[];
  }

  create(operatorId: number, label: string, body: string, sortOrder: number): number {
    return Number(this.db.prepare('INSERT INTO quick_replies (operator_id, label, body, sort_order) VALUES (?, ?, ?, ?)').run(operatorId, label, body, sortOrder).lastInsertRowid);
  }

  update(id: number, patch: { label?: string; body?: string; sort_order?: number }): void {
    const sets: string[] = []; const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v); }
    }
    if (!sets.length) return;
    vals.push(id);
    this.db.prepare(`UPDATE quick_replies SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM quick_replies WHERE id = ?').run(id);
  }
}
```

- [ ] **Step 5: Combined smoke test `server/tests/repositories/operatorRelated.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { OperatorTokensRepo } from '../../src/repositories/operatorTokens.js';
import { PushSubscriptionsRepo } from '../../src/repositories/pushSubscriptions.js';
import { QuickRepliesRepo } from '../../src/repositories/quickReplies.js';

describe('operator-related repos', () => {
  it('roundtrip across all four', () => {
    const db = makeTestDb('opr');
    const ops = new OperatorsRepo(db);
    const id = ops.create({ email: 'a@b.com', password_hash: 'h', display_name: 'Alex', created_at: 1000 });
    expect(ops.findByEmail('a@b.com')?.id).toBe(id);
    ops.setStatus(id, 'away');
    expect(ops.findById(id)?.status).toBe('away');
    ops.setQuietHours(id, '21:00', '08:00');
    expect(ops.findById(id)?.quiet_hours_start).toBe('21:00');

    const tokens = new OperatorTokensRepo(db);
    tokens.create('tok1', id, 1000);
    expect(tokens.findOperatorIdByToken('tok1', 2000)).toBe(id);
    tokens.revoke('tok1');
    expect(tokens.findOperatorIdByToken('tok1', 3000)).toBeUndefined();

    const push = new PushSubscriptionsRepo(db);
    push.upsert({ operator_id: id, endpoint: 'https://e1', p256dh: 'p', auth: 'a', device_label: 'PC', created_at: 1000 });
    expect(push.listForOperator(id)).toHaveLength(1);
    push.deleteByEndpoint('https://e1');
    expect(push.listForOperator(id)).toHaveLength(0);

    const qr = new QuickRepliesRepo(db);
    const qid = qr.create(id, 'Send link', 'Here is the link', 0);
    qr.update(qid, { label: 'Send start link' });
    expect(qr.list(id)[0].label).toBe('Send start link');
    qr.remove(qid);
    expect(qr.list(id)).toHaveLength(0);
  });
});
```

- [ ] **Step 6: Run all server tests + commit**

```bash
cd server && npm test
git add server/src/repositories server/tests/repositories
git commit -m "Server: operators + tokens + push subs + quick replies repos" && git push
```

---

**Phase 1 done.** Server has full schema + 11 repository classes + auth primitives + ~25 unit tests passing. No HTTP server yet — that's Phase 2.

---

## Phase 2 — Server Visitor WS Protocol

End-state: server boots an HTTP + WebSocket process. A `wscat` connection to `/ws/visitor` can send `hello`, `presence`, `lead_signal`, `chat_open`, `chat_message`, `capture`, and `typing` messages and observe correct state changes in the database. Phase-2 timeout fires correctly.

### Task 2.1: LiveSessions in-memory map

**Files:** `server/src/live/sessions.ts`, `server/tests/live/sessions.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { LiveSessions } from '../../src/live/sessions.js';

describe('LiveSessions', () => {
  it('add socket creates entry', () => {
    const ls = new LiveSessions();
    const fakeSocket = {} as any;
    ls.add('v_a', 's_1', fakeSocket, { url: '/x', title: 'X', enteredAt: 100 });
    const live = ls.get('v_a');
    expect(live?.sockets.size).toBe(1);
    expect(live?.activeSessionId).toBe('s_1');
    expect(live?.currentPage.url).toBe('/x');
  });
  it('add second socket appends + updates active', () => {
    const ls = new LiveSessions();
    ls.add('v_a', 's_1', {} as any, { url: '/x', title: 'X', enteredAt: 100 });
    ls.add('v_a', 's_2', {} as any, { url: '/y', title: 'Y', enteredAt: 200 });
    const live = ls.get('v_a');
    expect(live?.sockets.size).toBe(2);
    expect(live?.activeSessionId).toBe('s_2');
    expect(live?.currentPage.url).toBe('/y');
  });
  it('remove socket cleans entry when last', () => {
    const ls = new LiveSessions();
    const sock = {} as any;
    ls.add('v_a', 's_1', sock, { url: '/x', title: 'X', enteredAt: 100 });
    ls.remove('v_a', sock);
    expect(ls.get('v_a')).toBeUndefined();
  });
  it('list returns all live visitors', () => {
    const ls = new LiveSessions();
    ls.add('v_a', 's_1', {} as any, { url: '/x', title: 'X', enteredAt: 100 });
    ls.add('v_b', 's_2', {} as any, { url: '/y', title: 'Y', enteredAt: 200 });
    expect(ls.list()).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Implement `server/src/live/sessions.ts`**

```typescript
import type { WebSocket } from 'ws';

export type LivePage = { url: string; title: string | null; enteredAt: number };

export type LiveSession = {
  visitorId: string;
  sockets: Set<WebSocket>;
  activeSessionId: string;
  lastSeenAt: number;
  currentPage: LivePage;
  scrollPct: number;
  leadScore: number;
  isHot: boolean;
  isTyping: boolean;
  conversationId?: string;
};

export class LiveSessions {
  private byVisitor = new Map<string, LiveSession>();

  add(visitorId: string, sessionId: string, socket: WebSocket, page: LivePage): LiveSession {
    let entry = this.byVisitor.get(visitorId);
    if (!entry) {
      entry = {
        visitorId,
        sockets: new Set(),
        activeSessionId: sessionId,
        lastSeenAt: Date.now(),
        currentPage: page,
        scrollPct: 0,
        leadScore: 0,
        isHot: false,
        isTyping: false,
      };
      this.byVisitor.set(visitorId, entry);
    }
    entry.sockets.add(socket);
    entry.activeSessionId = sessionId;
    entry.currentPage = page;
    entry.lastSeenAt = Date.now();
    return entry;
  }

  remove(visitorId: string, socket: WebSocket): void {
    const entry = this.byVisitor.get(visitorId);
    if (!entry) return;
    entry.sockets.delete(socket);
    if (entry.sockets.size === 0) {
      this.byVisitor.delete(visitorId);
    }
  }

  get(visitorId: string): LiveSession | undefined {
    return this.byVisitor.get(visitorId);
  }

  list(): LiveSession[] {
    return Array.from(this.byVisitor.values());
  }

  patch(visitorId: string, patch: Partial<LiveSession>): void {
    const entry = this.byVisitor.get(visitorId);
    if (!entry) return;
    Object.assign(entry, patch, { lastSeenAt: Date.now() });
    entry.isHot = entry.leadScore >= 8;
  }
}
```

- [ ] **Step 3: Run + commit**

```bash
git add server/src/live server/tests/live
git commit -m "Server: LiveSessions in-memory map" && git push
```

---

### Task 2.2: WebSocket message schemas (Zod)

**Files:** `server/src/ws/protocol.ts`, `server/tests/ws/protocol.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { VisitorMessage, parseVisitorMessage } from '../../src/ws/protocol.js';

describe('protocol', () => {
  it('parses valid hello', () => {
    const m = parseVisitorMessage('{"type":"hello","visitorId":"v_abcdef012345","sessionId":"s_abcdef012345","page":{"url":"https://simple1031x.com/x","title":"X"},"utms":{},"referrer":null,"userAgent":"Mozilla/5.0"}');
    expect(m?.type).toBe('hello');
  });
  it('rejects unknown type', () => {
    expect(parseVisitorMessage('{"type":"garbage"}')).toBeNull();
  });
  it('rejects malformed JSON', () => {
    expect(parseVisitorMessage('not json')).toBeNull();
  });
});
```

- [ ] **Step 2: Implement `server/src/ws/protocol.ts`** (Zod schemas covering both directions per spec §6)

```typescript
import { z } from 'zod';

const Page = z.object({ url: z.string().url(), title: z.string().nullable() });
const Utms = z.object({
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
  gclid: z.string().optional(),
  fbclid: z.string().optional(),
}).strict();

export const VisitorHelloMsg = z.object({
  type: z.literal('hello'),
  visitorId: z.string().regex(/^v_[0-9a-f]{12}$/),
  sessionId: z.string().regex(/^s_[0-9a-f]{12}$/),
  page: Page,
  utms: Utms,
  referrer: z.string().nullable(),
  userAgent: z.string(),
});

export const VisitorPresenceMsg = z.object({
  type: z.literal('presence'),
  page: Page.optional(),
  scrollPct: z.number().int().min(0).max(100).optional(),
  idle: z.boolean().optional(),
});

export const VisitorLeadSignalMsg = z.object({
  type: z.literal('lead_signal'),
  kind: z.string().min(1).max(64),
  payload: z.unknown().optional(),
});

export const VisitorChatOpenMsg = z.object({ type: z.literal('chat_open') });

export const VisitorChatMessageMsg = z.object({
  type: z.literal('chat_message'),
  body: z.string().min(1).max(4000),
});

export const VisitorTypingMsg = z.object({
  type: z.literal('typing'),
  isTyping: z.boolean(),
});

export const VisitorCaptureMsg = z.object({
  type: z.literal('capture'),
  name: z.string().max(200).optional(),
  email: z.string().email().max(254).optional(),
  phone: z.string().max(40).optional(),
});

export const VisitorMessage = z.discriminatedUnion('type', [
  VisitorHelloMsg, VisitorPresenceMsg, VisitorLeadSignalMsg,
  VisitorChatOpenMsg, VisitorChatMessageMsg, VisitorTypingMsg, VisitorCaptureMsg,
]);

export type VisitorMessageT = z.infer<typeof VisitorMessage>;

export function parseVisitorMessage(raw: string): VisitorMessageT | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  const result = VisitorMessage.safeParse(parsed);
  return result.success ? result.data : null;
}
```

- [ ] **Step 3: Run + commit**

```bash
git add server/src/ws/protocol.ts server/tests/ws/protocol.test.ts
git commit -m "Server: visitor WS message schemas with Zod" && git push
```

---

### Task 2.3: HTTP server with WebSocket upgrade routing

**Files:** `server/src/server.ts`, `server/tests/server.smoke.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../src/server.js';
import type { Server } from 'node:http';
import { request } from 'node:http';

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer({ db: {} as any, ls: {} as any, env: { PORT: 0 } as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = (server.address() as any).port;
});

afterAll(() => { server.close(); });

describe('http server', () => {
  it('GET /health returns 200', async () => {
    const res = await new Promise<any>((resolve) => {
      const req = request({ host: '127.0.0.1', port, path: '/health' }, resolve);
      req.end();
    });
    expect(res.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Implement `server/src/server.ts`**

```typescript
import express, { type Express } from 'express';
import { createServer as createHttpServer, type Server } from 'node:http';
import { WebSocketServer } from 'ws';
import type { DB } from './db/client.js';
import type { LiveSessions } from './live/sessions.js';
import type { Env } from './env.js';
import { logger } from './logger.js';
import { handleVisitorConnection } from './ws/visitor.js';

export type ServerDeps = { db: DB; ls: LiveSessions; env: Env };

export function createServer(deps: ServerDeps): Server {
  const app: Express = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  const server = createHttpServer(app);
  const wssVisitor = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/ws/visitor') {
      wssVisitor.handleUpgrade(req, socket, head, (ws) => handleVisitorConnection(ws, req, deps));
    } else {
      socket.destroy();
    }
  });

  server.on('listening', () => {
    const addr = server.address();
    logger.info({ addr }, 'server listening');
  });

  return server;
}
```

- [ ] **Step 3: Stub `server/src/ws/visitor.ts` (real impl in next task)**

```typescript
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { ServerDeps } from '../server.js';

export function handleVisitorConnection(ws: WebSocket, _req: IncomingMessage, _deps: ServerDeps): void {
  ws.on('message', () => { /* implemented in Task 2.4 */ });
  ws.on('close', () => { /* implemented in Task 2.4 */ });
}
```

- [ ] **Step 4: Run + commit**

```bash
cd server && npm test -- server.smoke
git add server/src/server.ts server/src/ws/visitor.ts server/tests/server.smoke.test.ts
git commit -m "Server: HTTP + WS scaffold with /health" && git push
```

---

### Task 2.4: Visitor WS — hello → welcome handler

**Files:** modify `server/src/ws/visitor.ts`, create `server/tests/ws/visitorHello.test.ts`

- [ ] **Step 1: Failing integration test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';

let server: any, port: number, db: any, ls: LiveSessions;

beforeEach(async () => {
  db = makeTestDb('visws-' + Math.random());
  ls = new LiveSessions();
  server = createServer({ db, ls, env: { VISITOR_COOKIE_SECRET: 'a'.repeat(64) } as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});

afterEach(() => server.close());

describe('visitor WS hello', () => {
  it('responds with welcome and creates visitor + session rows', async () => {
    const visitorId = newVisitorId(), sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>(r => ws.on('open', () => r()));
    ws.send(JSON.stringify({
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/index.html', title: 'Home' },
      utms: { utm_source: 'google_ads' }, referrer: null, userAgent: 'Mozilla/5.0',
    }));
    const welcome: any = await new Promise(r => ws.on('message', m => r(JSON.parse(m.toString()))));
    expect(welcome.type).toBe('welcome');
    expect(welcome.operatorOnline).toBeDefined();
    const v = db.prepare('SELECT * FROM visitors WHERE id = ?').get(visitorId);
    const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    expect(v).toBeDefined();
    expect(s.utm_source).toBe('google_ads');
    ws.close();
  });
});
```

- [ ] **Step 2: Implement `server/src/ws/visitor.ts` fully**

```typescript
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { ServerDeps } from '../server.js';
import { parseVisitorMessage } from './protocol.js';
import { VisitorsRepo } from '../repositories/visitors.js';
import { SessionsRepo } from '../repositories/sessions.js';
import { OperatorsRepo } from '../repositories/operators.js';
import { ConversationsRepo } from '../repositories/conversations.js';
import { MessagesRepo } from '../repositories/messages.js';
import { logger } from '../logger.js';

type ConnState = { visitorId?: string; sessionId?: string };

export function handleVisitorConnection(ws: WebSocket, req: IncomingMessage, deps: ServerDeps): void {
  const state: ConnState = {};
  const visitors = new VisitorsRepo(deps.db);
  const sessions = new SessionsRepo(deps.db);
  const operators = new OperatorsRepo(deps.db);
  const conversations = new ConversationsRepo(deps.db);
  const _messages = new MessagesRepo(deps.db);

  ws.on('message', (raw) => {
    const msg = parseVisitorMessage(raw.toString());
    if (!msg) {
      ws.send(JSON.stringify({ type: 'error', code: 'bad_message', message: 'Unrecognized message' }));
      return;
    }

    switch (msg.type) {
      case 'hello': {
        state.visitorId = msg.visitorId;
        state.sessionId = msg.sessionId;
        const now = Date.now();
        const ipRaw = (req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
        visitors.upsert(msg.visitorId, now);
        sessions.create({
          id: msg.sessionId, visitor_id: msg.visitorId, started_at: now,
          landing_url: msg.page.url,
          utm_source: msg.utms.utm_source ?? null,
          utm_medium: msg.utms.utm_medium ?? null,
          utm_campaign: msg.utms.utm_campaign ?? null,
          utm_term: msg.utms.utm_term ?? null,
          utm_content: msg.utms.utm_content ?? null,
          gclid: msg.utms.gclid ?? null,
          fbclid: msg.utms.fbclid ?? null,
          referrer: msg.referrer,
          ip: ipRaw || null,
          city: null, region: null, country: null, timezone: null,
          device_type: null, browser: null, os: null,
        });
        deps.ls.add(msg.visitorId, msg.sessionId, ws, { url: msg.page.url, title: msg.page.title, enteredAt: now });

        const op = operators.findById(1);
        const operatorOnline = op?.status === 'online';

        // Look up any open conversation in last 30 days
        const cutoff = now - 30 * 24 * 60 * 60 * 1000;
        const existing = conversations.findOpenForVisitor(msg.visitorId, cutoff);

        ws.send(JSON.stringify({
          type: 'welcome',
          operatorOnline,
          conversationId: existing?.id,
          history: existing ? new MessagesRepo(deps.db).listByConversation(existing.id) : [],
        }));
        break;
      }
      // Other handlers added in Task 2.5+
      default:
        // not yet handled in this task
        break;
    }
  });

  ws.on('close', () => {
    if (state.visitorId) {
      deps.ls.remove(state.visitorId, ws);
      logger.debug({ visitorId: state.visitorId }, 'visitor ws closed');
    }
  });
}
```

- [ ] **Step 3: Run integration test, expect pass**

```bash
cd server && npm test -- visitorHello
```

- [ ] **Step 4: Commit**

```bash
git add server/src/ws/visitor.ts server/tests/ws/visitorHello.test.ts
git commit -m "Server: visitor WS hello → welcome with DB writes" && git push
```

---

### Task 2.5: Visitor WS — presence + lead_signal handlers

**Files:** modify `server/src/ws/visitor.ts`, add page_views and lead_signals integration. Test: `server/tests/ws/visitorPresence.test.ts`.

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';

let server: any, port: number, db: any, ls: LiveSessions;

beforeEach(async () => {
  db = makeTestDb('vp-' + Math.random());
  ls = new LiveSessions();
  server = createServer({ db, ls, env: {} as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});
afterEach(() => server.close());

async function helloAndWait(ws: WebSocket, vid: string, sid: string) {
  await new Promise<void>(r => ws.on('open', () => r()));
  ws.send(JSON.stringify({ type: 'hello', visitorId: vid, sessionId: sid, page: { url: 'https://simple1031x.com/x', title: 'X' }, utms: {}, referrer: null, userAgent: 'M' }));
  await new Promise(r => ws.once('message', () => r(null)));
}

describe('visitor presence + lead_signal', () => {
  it('presence with new page creates a page_view row', async () => {
    const vid = newVisitorId(), sid = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await helloAndWait(ws, vid, sid);
    ws.send(JSON.stringify({ type: 'presence', page: { url: 'https://simple1031x.com/y', title: 'Y' }, scrollPct: 25 }));
    await new Promise(r => setTimeout(r, 50));
    const pvs = db.prepare('SELECT * FROM page_views WHERE session_id = ?').all(sid);
    expect(pvs.length).toBeGreaterThanOrEqual(1);
    expect(pvs.find((p: any) => p.url.endsWith('/y'))).toBeDefined();
    ws.close();
  });

  it('lead_signal inserts and bumps score', async () => {
    const vid = newVisitorId(), sid = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await helloAndWait(ws, vid, sid);
    ws.send(JSON.stringify({ type: 'lead_signal', kind: 'calculator_used', payload: { sale: 1200000 } }));
    await new Promise(r => setTimeout(r, 50));
    const sigs = db.prepare('SELECT * FROM lead_signals WHERE session_id = ?').all(sid);
    expect(sigs).toHaveLength(1);
    const session = db.prepare('SELECT current_lead_score FROM sessions WHERE id = ?').get(sid) as any;
    expect(session.current_lead_score).toBeGreaterThan(0);
    ws.close();
  });
});
```

- [ ] **Step 2: Add a `leadScore/compute.ts` module first**

`server/src/leadScore/compute.ts`:

```typescript
// Score deltas per signal kind. Tweak as needed; documented in spec §5.3.
const DELTAS: Record<string, number> = {
  calculator_used: 3,
  pricing_page_view: 2,
  returning_visitor: 2,
  google_ads_click: 2,
  exit_intent: 1,
  form_started: 2,
  scroll_70: 1,
  high_value_blog: 1,
};

export function scoreFor(kind: string): number {
  return DELTAS[kind] ?? 0;
}

export type ScoreReason = { kind: string; score_delta: number };

export function summarize(reasons: ScoreReason[]): { total: number; reasons: ScoreReason[] } {
  return { total: reasons.reduce((a, r) => a + r.score_delta, 0), reasons };
}
```

- [ ] **Step 3: Modify `server/src/ws/visitor.ts` to handle `presence` and `lead_signal`**

Add inside the `switch (msg.type)` block (and add the imports for `PageViewsRepo`, `LeadSignalsRepo`, and `scoreFor`):

```typescript
case 'presence': {
  if (!state.visitorId || !state.sessionId) break;
  if (msg.page) {
    const live = deps.ls.get(state.visitorId);
    const oldUrl = live?.currentPage.url;
    const now = Date.now();
    if (oldUrl !== msg.page.url) {
      // close previous page_view, create new one
      const pvRepo = new PageViewsRepo(deps.db);
      const prev = pvRepo.listForSession(state.sessionId).filter(p => !p.left_at).pop();
      if (prev) pvRepo.leave(prev.id, now);
      pvRepo.enter(state.sessionId, msg.page.url, msg.page.title, now);
      deps.ls.patch(state.visitorId, { currentPage: { url: msg.page.url, title: msg.page.title, enteredAt: now } });
    }
  }
  if (typeof msg.scrollPct === 'number' && state.visitorId) {
    deps.ls.patch(state.visitorId, { scrollPct: msg.scrollPct });
    const pvRepo = new PageViewsRepo(deps.db);
    const cur = pvRepo.listForSession(state.sessionId).filter(p => !p.left_at).pop();
    if (cur) pvRepo.updateScroll(cur.id, msg.scrollPct);
  }
  break;
}
case 'lead_signal': {
  if (!state.sessionId || !state.visitorId) break;
  const delta = scoreFor(msg.kind);
  const lsRepo = new LeadSignalsRepo(deps.db);
  lsRepo.insert(state.sessionId, msg.kind, msg.payload, delta, Date.now());
  if (delta > 0) {
    new SessionsRepo(deps.db).bumpLeadScore(state.sessionId, delta);
    const cur = (sessions.findById(state.sessionId)?.current_lead_score ?? 0);
    deps.ls.patch(state.visitorId, { leadScore: cur });
  }
  break;
}
```

Make sure to also add an `enter` page-view on initial `hello` if not already created (modify the hello handler):

```typescript
// In the hello handler, after sessions.create(...):
new PageViewsRepo(deps.db).enter(msg.sessionId, msg.page.url, msg.page.title, now);
```

- [ ] **Step 4: Run tests + commit**

```bash
cd server && npm test
git add server/src/leadScore server/src/ws/visitor.ts server/tests/ws/visitorPresence.test.ts
git commit -m "Server: visitor WS presence + lead_signal with page_views and score deltas" && git push
```

---

### Task 2.6: Visitor WS — chat_open + chat_message handlers

**Files:** modify `server/src/ws/visitor.ts`, add `server/tests/ws/visitorChat.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';

let server: any, port: number, db: any, ls: LiveSessions;

beforeEach(async () => {
  db = makeTestDb('vc-' + Math.random());
  ls = new LiveSessions();
  // seed an operator with status=online so conversation goes to 'live'
  new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
  server = createServer({ db, ls, env: {} as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});
afterEach(() => server.close());

async function helloAndWait(ws: WebSocket, vid: string, sid: string) {
  await new Promise<void>(r => ws.on('open', () => r()));
  ws.send(JSON.stringify({ type: 'hello', visitorId: vid, sessionId: sid, page: { url: 'https://simple1031x.com/x', title: 'X' }, utms: {}, referrer: null, userAgent: 'M' }));
  await new Promise(r => ws.once('message', () => r(null)));
}

describe('visitor chat lifecycle', () => {
  it('chat_open + chat_message creates conversation + message rows', async () => {
    const vid = newVisitorId(), sid = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await helloAndWait(ws, vid, sid);
    ws.send(JSON.stringify({ type: 'chat_open' }));
    ws.send(JSON.stringify({ type: 'chat_message', body: 'Is $799 the all-in?' }));
    await new Promise(r => setTimeout(r, 50));
    const conv = db.prepare('SELECT * FROM conversations WHERE visitor_id = ?').get(vid) as any;
    expect(conv).toBeDefined();
    expect(conv.status).toBe('live'); // operator is online
    const msgs = db.prepare('SELECT * FROM messages WHERE conversation_id = ?').all(conv.id);
    expect(msgs).toHaveLength(1);
    expect((msgs[0] as any).body).toBe('Is $799 the all-in?');
    ws.close();
  });
});
```

- [ ] **Step 2: Add `chat_open` and `chat_message` cases to `server/src/ws/visitor.ts`**

```typescript
case 'chat_open': {
  if (!state.visitorId) break;
  // Idempotent: only create if no open conversation exists
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const existing = conversations.findOpenForVisitor(state.visitorId, cutoff);
  if (existing) {
    deps.ls.patch(state.visitorId, { conversationId: existing.id });
  }
  break;
}

case 'chat_message': {
  if (!state.visitorId || !state.sessionId) break;
  const now = Date.now();
  const op = operators.findById(1);
  const initialStatus: 'live' | 'queued' = (op?.status === 'online') ? 'live' : 'queued';
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  let conv = conversations.findOpenForVisitor(state.visitorId, cutoff);
  if (!conv) {
    const cid = (await import('../ids.js')).newConversationId();
    conversations.create({
      id: cid, visitor_id: state.visitorId,
      opened_session_id: state.sessionId,
      status: initialStatus, opened_at: now, initiated_by: 'visitor',
    });
    conv = conversations.findById(cid)!;
    deps.ls.patch(state.visitorId, { conversationId: cid });
  }
  const messages = new MessagesRepo(deps.db);
  const msgRow = messages.insert({ conversation_id: conv.id, sender: 'visitor', body: msg.body, sent_at: now });
  conversations.bumpLastMessageAt(conv.id, now);
  // Echo back nothing to visitor (their UI already shows it locally).
  // Operator-side dispatch happens in Phase 4. Phase-2 timer is added in Task 2.7.
  logger.debug({ msgId: msgRow.id, conv: conv.id }, 'visitor chat_message stored');
  break;
}
```

(Note: the dynamic import of `ids.js` keeps the example self-contained; in real code import it at the top of the file.)

- [ ] **Step 3: Run tests + commit**

```bash
cd server && npm test
git add server/src/ws/visitor.ts server/tests/ws/visitorChat.test.ts
git commit -m "Server: visitor WS chat_open + chat_message create conversations" && git push
```

---

### Task 2.7: Phase-2 timer (3-min capture fallback)

**Files:** `server/src/timers/phaseTransition.ts`, `server/tests/timers/phaseTransition.test.ts`. Modify `server/src/ws/visitor.ts` to start the timer.

- [ ] **Step 1: Failing test (uses fake timers)**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhaseTransitionTimers } from '../../src/timers/phaseTransition.js';

describe('PhaseTransitionTimers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires after 3 minutes and calls onTimeout', () => {
    const timers = new PhaseTransitionTimers();
    const cb = vi.fn();
    timers.start('c_1', cb);
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('cancel prevents fire', () => {
    const timers = new PhaseTransitionTimers();
    const cb = vi.fn();
    timers.start('c_1', cb);
    timers.cancel('c_1');
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(cb).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement `server/src/timers/phaseTransition.ts`**

```typescript
const PHASE2_DELAY_MS = 3 * 60 * 1000;

export class PhaseTransitionTimers {
  private byConversation = new Map<string, NodeJS.Timeout>();

  start(conversationId: string, onTimeout: () => void): void {
    if (this.byConversation.has(conversationId)) return;
    const t = setTimeout(() => {
      this.byConversation.delete(conversationId);
      onTimeout();
    }, PHASE2_DELAY_MS);
    this.byConversation.set(conversationId, t);
  }

  cancel(conversationId: string): void {
    const t = this.byConversation.get(conversationId);
    if (t) {
      clearTimeout(t);
      this.byConversation.delete(conversationId);
    }
  }
}
```

- [ ] **Step 3: Wire timer into visitor WS**

Add `timers` to `ServerDeps`. In the `chat_message` case, after creating a queued conversation, start the timer that:

```typescript
deps.timers.start(conv.id, () => {
  // Fire phase_transition to all visitor sockets for this visitorId
  const live = deps.ls.get(state.visitorId!);
  if (!live) return;
  const v = visitors.findById(state.visitorId!);
  const skipForm = !!(v?.email && v.email.length > 0);
  const payload = JSON.stringify({
    type: 'phase_transition',
    phase: skipForm ? 'email_on_file' : 'capture',
    knownEmail: v?.email ?? null,
  });
  for (const sock of live.sockets) {
    try { sock.send(payload); } catch {}
  }
});
```

- [ ] **Step 4: Run tests + commit**

```bash
cd server && npm test
git add server/src/timers server/tests/timers server/src/ws/visitor.ts server/src/server.ts
git commit -m "Server: Phase-2 (3-min) capture timer with skip-if-email-known" && git push
```

---

### Task 2.8: Visitor WS — capture + typing handlers + entry point

**Files:** modify `server/src/ws/visitor.ts`, create `server/src/index.ts` boot, add `server/tests/ws/visitorCapture.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { PhaseTransitionTimers } from '../../src/timers/phaseTransition.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';

let server: any, port: number, db: any, ls: LiveSessions, timers: PhaseTransitionTimers;

beforeEach(async () => {
  db = makeTestDb('cap-' + Math.random());
  ls = new LiveSessions();
  timers = new PhaseTransitionTimers();
  server = createServer({ db, ls, timers, env: {} as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});
afterEach(() => server.close());

describe('visitor capture', () => {
  it('capture writes contact info to visitors row + timeout_capture', async () => {
    const vid = newVisitorId(), sid = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>(r => ws.on('open', () => r()));
    ws.send(JSON.stringify({ type: 'hello', visitorId: vid, sessionId: sid, page: { url: 'https://simple1031x.com/x', title: 'X' }, utms: {}, referrer: null, userAgent: 'M' }));
    await new Promise(r => ws.once('message', () => r(null)));
    ws.send(JSON.stringify({ type: 'chat_message', body: 'hello?' }));
    await new Promise(r => setTimeout(r, 50));
    ws.send(JSON.stringify({ type: 'capture', name: 'Mike H.', email: 'mike@example.com', phone: '555-1234' }));
    await new Promise(r => setTimeout(r, 50));
    const v = db.prepare('SELECT * FROM visitors WHERE id = ?').get(vid) as any;
    expect(v.name).toBe('Mike H.');
    expect(v.email).toBe('mike@example.com');
    const c = db.prepare('SELECT * FROM conversations WHERE visitor_id = ?').get(vid) as any;
    expect(c.timeout_capture).toContain('mike@example.com');
    expect(c.status).toBe('closed_for_followup');
    ws.close();
  });
});
```

- [ ] **Step 2: Add `capture` and `typing` handlers**

```typescript
case 'typing': {
  if (!state.visitorId) break;
  deps.ls.patch(state.visitorId, { isTyping: msg.isTyping });
  // Operator broadcast added in Phase 4
  break;
}

case 'capture': {
  if (!state.visitorId) break;
  visitors.updateContact(state.visitorId, { name: msg.name, email: msg.email, phone: msg.phone });
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const conv = conversations.findOpenForVisitor(state.visitorId, cutoff);
  if (conv) {
    conversations.setTimeoutCapture(conv.id, { name: msg.name, email: msg.email, phone: msg.phone });
    conversations.setStatus(conv.id, 'closed_for_followup', Date.now());
    deps.timers.cancel(conv.id);
  }
  break;
}
```

- [ ] **Step 3: Implement `server/src/index.ts` (real boot)**

```typescript
import { loadEnv } from './env.js';
import { openDb } from './db/client.js';
import { migrate } from './db/migrate.js';
import { LiveSessions } from './live/sessions.js';
import { PhaseTransitionTimers } from './timers/phaseTransition.js';
import { createServer } from './server.js';
import { logger } from './logger.js';

const env = loadEnv();
const db = openDb(env.DATABASE_PATH);
migrate(db);
const ls = new LiveSessions();
const timers = new PhaseTransitionTimers();
const server = createServer({ db, ls, timers, env });
server.listen(env.PORT, () => logger.info({ port: env.PORT }, 'tidio-remake server up'));
```

- [ ] **Step 4: Update `ServerDeps` to include `timers`**

In `server/src/server.ts`:

```typescript
export type ServerDeps = { db: DB; ls: LiveSessions; timers: PhaseTransitionTimers; env: Env };
```

- [ ] **Step 5: Run all tests + manual smoke**

```bash
cd server && npm test
# Manual smoke:
cp .env.example .env  # fill in random VISITOR_COOKIE_SECRET, OPERATOR_PASSWORD_PEPPER, dummy VAPID
node -e "const wp=require('web-push');const k=wp.generateVAPIDKeys();console.log('VAPID_PUBLIC_KEY='+k.publicKey+'\\nVAPID_PRIVATE_KEY='+k.privateKey)" >> .env
echo "VAPID_SUBJECT=mailto:dev@example.com" >> .env
npm run dev
# In another terminal:
npx wscat -c ws://127.0.0.1:8080/ws/visitor
> {"type":"hello","visitorId":"v_aaaaaaaaaaaa","sessionId":"s_bbbbbbbbbbbb","page":{"url":"https://simple1031x.com/x","title":"X"},"utms":{},"referrer":null,"userAgent":"manual"}
< {"type":"welcome",...}
```

- [ ] **Step 6: Commit**

```bash
git add server/src/index.ts server/src/ws/visitor.ts server/src/server.ts server/tests/ws/visitorCapture.test.ts
git commit -m "Server: visitor WS capture + typing + entry point" && git push
```

---

**Phase 2 done.** Server boots, accepts visitor WS connections, persists every event to SQLite, supports the full visitor-side wire protocol from spec §6.1 (hello, presence, lead_signal, chat_open, chat_message, typing, capture). Phase-2 capture timer fires after 3 min. Operator-side dispatch (broadcasting visitor messages to operator console) waits for Phase 4.

---

## Phase 3 — Visitor Widget MVP (End-to-End Browser ↔ Server Chat)

End-state: a built `chat-widget.js` IIFE bundle that you can drop into a `<script>` tag on any local HTML page. Bubble appears, opens a panel, exchanges messages with the local server, falls back to capture form after 3 min, and the operator console (built later) will see all of it.

### Task 3.1: Identity module (visitorId + sessionId)

**Files:** `widget/src/identity.ts`, `widget/tests/identity.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getOrCreateVisitorId, newSessionId } from '../src/identity.js';

describe('identity', () => {
  beforeEach(() => { localStorage.clear(); });

  it('creates and persists visitorId', () => {
    const id = getOrCreateVisitorId();
    expect(id).toMatch(/^v_[0-9a-f]{12}$/);
    expect(getOrCreateVisitorId()).toBe(id);
  });

  it('newSessionId is unique per call', () => {
    expect(newSessionId()).not.toBe(newSessionId());
  });
});
```

- [ ] **Step 2: Implement `widget/src/identity.ts`**

```typescript
const STORAGE_KEY = 's1031_visitor_id';

function hex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

export function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && /^v_[0-9a-f]{12}$/.test(existing)) return existing;
  } catch {}
  const fresh = `v_${hex(6)}`;
  try { localStorage.setItem(STORAGE_KEY, fresh); } catch {}
  return fresh;
}

export function newSessionId(): string {
  return `s_${hex(6)}`;
}
```

- [ ] **Step 3: Run + commit**

```bash
cd widget && npm test
git add widget/src/identity.ts widget/tests/identity.test.ts
git commit -m "Widget: identity module" && git push
```

---

### Task 3.2: UTM/referrer parser

**Files:** `widget/src/utms.ts`, `widget/tests/utms.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { parseUtms } from '../src/utms.js';

describe('parseUtms', () => {
  it('extracts utm_* + gclid + fbclid from a search string', () => {
    const u = parseUtms('?utm_source=google_ads&utm_campaign=cal&gclid=ABC');
    expect(u).toEqual({ utm_source: 'google_ads', utm_campaign: 'cal', gclid: 'ABC' });
  });
  it('returns empty object when no relevant params', () => {
    expect(parseUtms('?other=1')).toEqual({});
  });
});
```

- [ ] **Step 2: Implement `widget/src/utms.ts`**

```typescript
const KEYS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid'] as const;

export type Utms = Partial<Record<typeof KEYS[number], string>>;

export function parseUtms(search: string): Utms {
  const params = new URLSearchParams(search);
  const out: Utms = {};
  for (const k of KEYS) {
    const v = params.get(k);
    if (v) out[k] = v;
  }
  return out;
}
```

- [ ] **Step 3: Run + commit**

```bash
git add widget/src/utms.ts widget/tests/utms.test.ts
git commit -m "Widget: UTM/referrer parser" && git push
```

---

### Task 3.3: WebSocket client with reconnect backoff

**Files:** `widget/src/ws.ts`, `widget/tests/ws.test.ts`

- [ ] **Step 1: Failing test (mock WebSocket)**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatWS } from '../src/ws.js';

class MockSocket {
  static instances: MockSocket[] = [];
  onopen?: () => void; onmessage?: (e: { data: string }) => void; onclose?: () => void; onerror?: () => void;
  readyState = 0;
  sent: string[] = [];
  constructor(public url: string) { MockSocket.instances.push(this); setTimeout(() => { this.readyState = 1; this.onopen?.(); }, 0); }
  send(d: string) { this.sent.push(d); }
  close() { this.readyState = 3; this.onclose?.(); }
}

beforeEach(() => { MockSocket.instances = []; vi.stubGlobal('WebSocket', MockSocket); });

describe('ChatWS', () => {
  it('opens and calls onopen', async () => {
    const onOpen = vi.fn();
    new ChatWS('ws://x', { onOpen, onMessage: () => {}, onClose: () => {} });
    await new Promise(r => setTimeout(r, 5));
    expect(onOpen).toHaveBeenCalled();
  });

  it('queues sends before open and flushes after', async () => {
    const ws = new ChatWS('ws://x', { onOpen: () => {}, onMessage: () => {}, onClose: () => {} });
    ws.send({ type: 'hello' } as any);
    await new Promise(r => setTimeout(r, 5));
    expect(MockSocket.instances[0].sent).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement `widget/src/ws.ts`**

```typescript
type Handlers = {
  onOpen: () => void;
  onMessage: (msg: any) => void;
  onClose: () => void;
};

const BACKOFF = [1000, 2000, 4000, 8000, 15000];

export class ChatWS {
  private socket: WebSocket | null = null;
  private queue: string[] = [];
  private retries = 0;
  private closed = false;

  constructor(private url: string, private handlers: Handlers) { this.connect(); }

  private connect() {
    if (this.closed) return;
    this.socket = new WebSocket(this.url);
    this.socket.onopen = () => {
      this.retries = 0;
      for (const m of this.queue) this.socket!.send(m);
      this.queue = [];
      this.handlers.onOpen();
    };
    this.socket.onmessage = (e) => {
      try { this.handlers.onMessage(JSON.parse(e.data)); } catch {}
    };
    this.socket.onclose = () => {
      this.handlers.onClose();
      if (this.closed) return;
      const delay = BACKOFF[Math.min(this.retries, BACKOFF.length - 1)];
      this.retries++;
      setTimeout(() => this.connect(), delay);
    };
    this.socket.onerror = () => { try { this.socket?.close(); } catch {} };
  }

  send(msg: any) {
    const json = JSON.stringify(msg);
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(json);
    else this.queue.push(json);
  }

  close() { this.closed = true; try { this.socket?.close(); } catch {} }
}
```

- [ ] **Step 3: Run + commit**

```bash
git add widget/src/ws.ts widget/tests/ws.test.ts
git commit -m "Widget: WebSocket client with reconnect + queueing" && git push
```

---

### Task 3.4: Conversation persistence to localStorage

**Files:** `widget/src/storage.ts`, `widget/tests/storage.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ConvStore } from '../src/storage.js';

describe('ConvStore', () => {
  beforeEach(() => localStorage.clear());

  it('save + load roundtrip', () => {
    const store = new ConvStore();
    store.save({ messages: [{ id: 1, sender: 'visitor', body: 'hi', sent_at: 100 }], openedAt: 50 });
    const loaded = store.load();
    expect(loaded?.messages).toHaveLength(1);
  });

  it('clear removes', () => {
    const store = new ConvStore();
    store.save({ messages: [], openedAt: 0 });
    store.clear();
    expect(store.load()).toBeNull();
  });
});
```

- [ ] **Step 2: Implement `widget/src/storage.ts`**

```typescript
const KEY = 's1031_chat_v2';

export type StoredMsg = { id: number | string; sender: 'visitor' | 'operator' | 'system'; body: string; sent_at: number };

export type Stored = { messages: StoredMsg[]; openedAt: number; conversationId?: string };

export class ConvStore {
  load(): Stored | null {
    try { const raw = sessionStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
  save(s: Stored): void {
    try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }
  clear(): void { try { sessionStorage.removeItem(KEY); } catch {} }
}
```

- [ ] **Step 3: Run + commit**

```bash
git add widget/src/storage.ts widget/tests/storage.test.ts
git commit -m "Widget: conversation localStorage persistence" && git push
```

---

### Task 3.5: Inline CSS module

**Files:** `widget/src/styles.ts`

- [ ] **Step 1: Implement `widget/src/styles.ts`**

CSS as a string — injected into `<style>` at runtime so the widget is a single JS file with no separate CSS request.

```typescript
export const STYLES = `
.s1031-bubble {
  position: fixed; bottom: 16px; right: 16px;
  width: 56px; height: 56px;
  background: #2563eb; color: white; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; cursor: pointer; z-index: 2147483647;
  box-shadow: 0 6px 20px rgba(37,99,235,0.4);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.s1031-bubble.s1031-pulse { animation: s1031pulse 1s ease-out 3; }
@keyframes s1031pulse { 0% { box-shadow: 0 6px 20px rgba(37,99,235,0.4), 0 0 0 0 rgba(37,99,235,0.5); } 100% { box-shadow: 0 6px 20px rgba(37,99,235,0.4), 0 0 0 18px rgba(37,99,235,0); } }
.s1031-peek {
  position: fixed; bottom: 86px; right: 16px;
  background: white; color: #0f172a; padding: 10px 14px;
  border-radius: 12px; border-bottom-right-radius: 4px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1); width: 220px; line-height: 1.4;
  font-size: 13px; z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  cursor: pointer;
}
.s1031-panel {
  position: fixed; bottom: 16px; right: 16px;
  width: 360px; max-height: 560px; height: 560px;
  background: white; border-radius: 12px;
  box-shadow: 0 12px 36px rgba(0,0,0,0.18);
  display: flex; flex-direction: column; overflow: hidden;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.s1031-header { background: #2563eb; color: white; padding: 14px 16px; display: flex; align-items: center; gap: 10px; }
.s1031-header.away { background: #475569; }
.s1031-header.success { background: #16a34a; }
.s1031-avatar { width: 32px; height: 32px; background: white; color: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; }
.s1031-header h4 { margin: 0; font-size: 14px; font-weight: 600; }
.s1031-header p { margin: 0; font-size: 11px; opacity: 0.9; }
.s1031-close { margin-left: auto; cursor: pointer; font-size: 20px; opacity: 0.8; padding: 4px; }
.s1031-body { flex: 1; padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: #f8fafc; }
.s1031-system { text-align: center; font-size: 11px; color: #64748b; background: #f1f5f9; padding: 8px 12px; border-radius: 8px; line-height: 1.4; }
.s1031-msg { max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.4; }
.s1031-msg.visitor { align-self: flex-end; background: #2563eb; color: white; border-top-right-radius: 4px; }
.s1031-msg.operator { align-self: flex-start; background: white; border: 1px solid #e4e4e7; border-top-left-radius: 4px; }
.s1031-typing { align-self: flex-start; padding: 8px 12px; background: white; border: 1px solid #e4e4e7; border-radius: 12px; font-size: 11px; color: #94a3b8; font-style: italic; }
.s1031-composer { padding: 10px 12px; background: white; border-top: 1px solid #e4e4e7; display: flex; gap: 8px; align-items: center; }
.s1031-composer input { flex: 1; border: 1px solid #d4d4d8; border-radius: 999px; padding: 8px 14px; font-size: 13px; font-family: inherit; outline: none; }
.s1031-composer input:focus { border-color: #2563eb; }
.s1031-composer button { background: #2563eb; color: white; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-size: 14px; }
.s1031-capture { padding: 16px; background: white; flex: 1; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.s1031-capture .intro { font-size: 13px; color: #475569; line-height: 1.5; }
.s1031-capture label { font-size: 10px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 4px; }
.s1031-capture input { width: 100%; box-sizing: border-box; border: 1px solid #d4d4d8; border-radius: 6px; padding: 8px 10px; font-size: 13px; font-family: inherit; }
.s1031-capture button { background: #2563eb; color: white; border: none; border-radius: 6px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 8px; }
.s1031-success { padding: 24px 16px; text-align: center; background: white; flex: 1; }
.s1031-success-icon { width: 60px; height: 60px; background: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #16a34a; font-size: 30px; margin: 12px auto; }
@media (max-width: 480px) {
  .s1031-panel { width: calc(100vw - 16px); right: 8px; bottom: 8px; max-height: calc(100vh - 16px); height: calc(100vh - 16px); }
  .s1031-bubble { right: 12px; bottom: 12px; }
}
`;

export function injectStyles(): void {
  if (document.getElementById('s1031-widget-styles')) return;
  const el = document.createElement('style');
  el.id = 's1031-widget-styles';
  el.textContent = STYLES;
  document.head.appendChild(el);
}
```

- [ ] **Step 2: Commit**

```bash
git add widget/src/styles.ts
git commit -m "Widget: inline CSS as a string module" && git push
```

---

### Task 3.6: Widget UI controller

**Files:** `widget/src/ui.ts`

This file owns DOM creation and updates. No tests for the DOM rendering itself (visually verify via the local HTML demo in Task 3.8); behavior tests are at the integration level.

- [ ] **Step 1: Implement `widget/src/ui.ts`**

```typescript
type UIHandlers = {
  onOpen: () => void;
  onClose: () => void;
  onSend: (body: string) => void;
  onSubmitCapture: (data: { name: string; email: string; phone: string }) => void;
};

export type Phase = 'closed' | 'chat' | 'capture' | 'success';

export class WidgetUI {
  private bubble?: HTMLDivElement;
  private peek?: HTMLDivElement;
  private panel?: HTMLDivElement;
  private body?: HTMLDivElement;
  private phase: Phase = 'closed';
  private operatorOnline = true;
  private knownEmail: string | null = null;

  constructor(private handlers: UIHandlers) {}

  mount(operatorOnline: boolean) {
    this.operatorOnline = operatorOnline;
    this.bubble = document.createElement('div');
    this.bubble.className = 's1031-bubble s1031-pulse';
    this.bubble.textContent = '💬';
    this.bubble.onclick = () => this.open();
    document.body.appendChild(this.bubble);

    this.peek = document.createElement('div');
    this.peek.className = 's1031-peek';
    this.peek.textContent = '👋 Hi! Have a question about your 1031?';
    this.peek.onclick = () => this.open();
    document.body.appendChild(this.peek);
    setTimeout(() => this.peek?.remove(), 10000);
  }

  open() {
    if (this.phase !== 'closed') return;
    this.peek?.remove();
    this.bubble?.remove();
    this.phase = 'chat';
    this.handlers.onOpen();
    this.renderPanel();
  }

  close() {
    this.panel?.remove();
    this.phase = 'closed';
    this.mount(this.operatorOnline); // re-show bubble
    this.handlers.onClose();
  }

  setOperatorOnline(online: boolean) { this.operatorOnline = online; }
  setKnownEmail(email: string | null) { this.knownEmail = email; }

  showMessage(msg: { sender: 'visitor' | 'operator' | 'system'; body: string }) {
    if (!this.body) return;
    const el = document.createElement('div');
    if (msg.sender === 'system') {
      el.className = 's1031-system';
      el.textContent = msg.body;
    } else {
      el.className = `s1031-msg ${msg.sender}`;
      el.textContent = msg.body;
    }
    this.body.appendChild(el);
    this.body.scrollTop = this.body.scrollHeight;
  }

  showOperatorTyping(isTyping: boolean) {
    if (!this.body) return;
    const existing = this.body.querySelector('.s1031-typing');
    if (isTyping && !existing) {
      const el = document.createElement('div');
      el.className = 's1031-typing';
      el.textContent = 'Alex is typing…';
      this.body.appendChild(el);
      this.body.scrollTop = this.body.scrollHeight;
    } else if (!isTyping && existing) {
      existing.remove();
    }
  }

  enterCapturePhase(knownEmail: string | null) {
    this.knownEmail = knownEmail;
    if (this.phase === 'capture' || this.phase === 'success') return;
    this.phase = 'capture';
    if (knownEmail) {
      this.renderEmailOnFile(knownEmail);
    } else {
      this.renderCaptureForm();
    }
  }

  showSuccess(name: string, email: string) {
    this.phase = 'success';
    if (!this.panel) return;
    this.panel.innerHTML = `
      <div class="s1031-header success">
        <div class="s1031-avatar" style="color:#16a34a;">✓</div>
        <div><h4>Got it — thanks${name ? `, ${escapeHtml(name)}` : ''}!</h4><p>We'll be in touch soon</p></div>
        <span class="s1031-close">&times;</span>
      </div>
      <div class="s1031-success">
        <div class="s1031-success-icon">✓</div>
        <h4 style="margin:0;font-size:16px;">You're all set</h4>
        <p style="margin:8px 0;font-size:13px;color:#475569;">Alex will follow up at <strong>${escapeHtml(email)}</strong> within the next business hour.</p>
      </div>
    `;
    this.panel.querySelector('.s1031-close')!.addEventListener('click', () => this.close());
  }

  private renderPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 's1031-panel';
    this.panel.innerHTML = `
      <div class="s1031-header">
        <div class="s1031-avatar">A</div>
        <div><h4>Alex from Simple 1031</h4><p>${this.operatorOnline ? 'Active now' : 'Replies in a few minutes'}</p></div>
        <span class="s1031-close">&times;</span>
      </div>
      <div class="s1031-body"></div>
      <div class="s1031-composer">
        <input type="text" placeholder="Type a message..." />
        <button type="button" aria-label="Send">↑</button>
      </div>
    `;
    document.body.appendChild(this.panel);
    this.body = this.panel.querySelector('.s1031-body') as HTMLDivElement;

    this.panel.querySelector('.s1031-close')!.addEventListener('click', () => this.close());

    const input = this.panel.querySelector('input') as HTMLInputElement;
    const button = this.panel.querySelector('button') as HTMLButtonElement;
    const send = () => {
      const v = input.value.trim();
      if (!v) return;
      input.value = '';
      this.showMessage({ sender: 'visitor', body: v });
      this.handlers.onSend(v);
    };
    button.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    input.focus();

    if (this.body.childElementCount === 0) {
      const sys = document.createElement('div');
      sys.className = 's1031-system';
      sys.textContent = "We usually reply within a few minutes. What's on your mind?";
      this.body.appendChild(sys);
    }
  }

  private renderCaptureForm() {
    if (!this.panel) return;
    this.panel.innerHTML = `
      <div class="s1031-header away">
        <div class="s1031-avatar" style="color:#475569;">A</div>
        <div><h4>We're not available right now</h4><p>Leave your info, we'll follow up fast</p></div>
        <span class="s1031-close">&times;</span>
      </div>
      <div class="s1031-capture">
        <div class="intro">Sorry, no one's available to chat right this second. Drop your contact info and we'll get back to you within the hour during business hours.</div>
        <div><label>Name</label><input type="text" name="name" placeholder="Your name" /></div>
        <div><label>Email</label><input type="email" name="email" placeholder="you@example.com" required /></div>
        <div><label>Phone (optional)</label><input type="tel" name="phone" placeholder="(___) ___-____" /></div>
        <button type="button">Send & we'll follow up</button>
      </div>
    `;
    this.panel.querySelector('.s1031-close')!.addEventListener('click', () => this.close());
    const button = this.panel.querySelector('.s1031-capture button') as HTMLButtonElement;
    button.addEventListener('click', () => {
      const inputs = this.panel!.querySelectorAll<HTMLInputElement>('input');
      const name = (inputs[0].value || '').trim();
      const email = (inputs[1].value || '').trim();
      const phone = (inputs[2].value || '').trim();
      if (!email) { inputs[1].focus(); return; }
      this.handlers.onSubmitCapture({ name, email, phone });
      this.showSuccess(name, email);
    });
  }

  private renderEmailOnFile(email: string) {
    if (!this.panel) return;
    this.panel.innerHTML = `
      <div class="s1031-header away">
        <div class="s1031-avatar" style="color:#475569;">A</div>
        <div><h4>We'll be right back</h4><p>Stepped away for a moment</p></div>
        <span class="s1031-close">&times;</span>
      </div>
      <div class="s1031-success">
        <p style="font-size:13px;color:#475569;">No need to leave your info again — we'll follow up at <strong>${escapeHtml(email)}</strong> as soon as we're back.</p>
      </div>
    `;
    this.panel.querySelector('.s1031-close')!.addEventListener('click', () => this.close());
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
```

- [ ] **Step 2: Commit**

```bash
git add widget/src/ui.ts
git commit -m "Widget: UI controller (bubble, panel, capture form, success)" && git push
```

---

### Task 3.7: Wire it all together — `widget/src/index.ts`

**Files:** `widget/src/index.ts` (replace placeholder), `widget/tests/integration.test.ts`

- [ ] **Step 1: Implement `widget/src/index.ts`**

```typescript
import { getOrCreateVisitorId, newSessionId } from './identity.js';
import { parseUtms } from './utms.js';
import { ChatWS } from './ws.js';
import { ConvStore } from './storage.js';
import { injectStyles } from './styles.js';
import { WidgetUI } from './ui.js';

export const WIDGET_VERSION = '0.1.0';

declare global { interface Window { TidioRemakeConfig?: { wsUrl?: string }; } }

const DEFAULT_WS_URL = 'wss://chat.simple1031x.com/ws/visitor';

function init() {
  if ((window as any).__s1031WidgetMounted) return;
  (window as any).__s1031WidgetMounted = true;

  injectStyles();

  const visitorId = getOrCreateVisitorId();
  const sessionId = newSessionId();
  const store = new ConvStore();

  let conversationId: string | undefined;

  const ui = new WidgetUI({
    onOpen: () => ws.send({ type: 'chat_open' }),
    onClose: () => {},
    onSend: (body) => {
      ws.send({ type: 'chat_message', body });
      const stored = store.load() ?? { messages: [], openedAt: Date.now(), conversationId };
      stored.messages.push({ id: `local-${Date.now()}`, sender: 'visitor', body, sent_at: Date.now() });
      stored.conversationId = conversationId;
      store.save(stored);
    },
    onSubmitCapture: (data) => ws.send({ type: 'capture', ...data }),
  });

  const wsUrl = window.TidioRemakeConfig?.wsUrl ?? DEFAULT_WS_URL;

  const ws = new ChatWS(wsUrl, {
    onOpen: () => {
      ws.send({
        type: 'hello', visitorId, sessionId,
        page: { url: location.href, title: document.title },
        utms: parseUtms(location.search),
        referrer: document.referrer || null,
        userAgent: navigator.userAgent,
      });
    },
    onMessage: (m) => {
      switch (m.type) {
        case 'welcome':
          conversationId = m.conversationId;
          ui.mount(!!m.operatorOnline);
          if (Array.isArray(m.history)) {
            for (const h of m.history) ui.showMessage({ sender: h.sender, body: h.body });
          }
          break;
        case 'operator_message':
          ui.showMessage({ sender: 'operator', body: m.body });
          break;
        case 'operator_typing':
          ui.showOperatorTyping(!!m.isTyping);
          break;
        case 'operator_pinged_you':
          ui.open();
          ui.showMessage({ sender: 'system', body: '🔔 Alex jumped in to help' });
          ui.showMessage({ sender: 'operator', body: m.body });
          break;
        case 'phase_transition':
          ui.enterCapturePhase(m.phase === 'email_on_file' ? m.knownEmail : null);
          break;
        case 'seen':
          // Optional: render seen indicator on local message
          break;
      }
    },
    onClose: () => {},
  });

  // Presence beacon every 15s
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      ws.send({ type: 'presence', page: { url: location.href, title: document.title }, scrollPct: scrollPct() });
    }
  }, 15000);
}

function scrollPct(): number {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  if (total <= 0) return 100;
  return Math.min(100, Math.round((window.scrollY / total) * 100));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

- [ ] **Step 2: Build the widget**

```bash
cd widget && npm run build
ls dist/
# Expected: chat-widget.js, chat-widget.js.map
```

- [ ] **Step 3: Commit**

```bash
git add widget/src/index.ts
git commit -m "Widget: wire identity + WS + UI + UTM end-to-end" && git push
```

---

### Task 3.8: Local demo HTML page + manual end-to-end test

**Files:** `widget/demo/index.html`

- [ ] **Step 1: Write `widget/demo/index.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Tidio Remake — Widget Demo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; color: #1e293b; }
    h1 { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Tidio Remake — Widget Demo</h1>
  <p>This is a fake page on simple1031x.com. The chat widget should appear in the bottom-right corner.</p>
  <p>Open DevTools to see the WebSocket connection. The widget connects to <code>ws://127.0.0.1:8080/ws/visitor</code>.</p>
  <ol>
    <li>Open this file via the local server (<code>cd widget && npx http-server demo -p 9000</code>) — DON'T file://, that breaks WebSocket.</li>
    <li>Make sure the server is running (<code>cd server && npm run dev</code>).</li>
    <li>Click the bubble, send a message, watch it land in the server's SQLite DB.</li>
  </ol>
  <script>
    window.TidioRemakeConfig = { wsUrl: 'ws://127.0.0.1:8080/ws/visitor' };
  </script>
  <script src="../dist/chat-widget.js"></script>
</body>
</html>
```

- [ ] **Step 2: Manual end-to-end test**

In one terminal:
```bash
cd server && npm run dev
```

In another:
```bash
cd widget && npx http-server demo -p 9000
```

Open `http://127.0.0.1:9000`. Verify:
- Bubble appears bottom-right
- Click bubble → panel opens
- Type "hello" → shows your bubble
- In SQL: `sqlite3 server/dev.db 'SELECT * FROM messages'` — your message is there
- Wait 3 minutes (or temporarily lower `PHASE2_DELAY_MS` to 5000ms in `server/src/timers/phaseTransition.ts`) → capture form appears
- Submit form → success screen
- Check DB: `visitors` row has email, `conversations.timeout_capture` populated, status=`closed_for_followup`

- [ ] **Step 3: Commit demo page + screenshot**

```bash
git add widget/demo
git commit -m "Widget: local demo HTML page" && git push
```

---

### Task 3.9: Server serves the widget bundle

**Files:** modify `server/src/server.ts` to serve `widget/dist/`

- [ ] **Step 1: Add static-serve route in `server/src/server.ts`**

After the `/health` route, add:

```typescript
import { join } from 'node:path';
// ...
app.use('/widget', express.static(join(process.cwd(), '..', 'widget', 'dist'), {
  maxAge: '5m',
  setHeaders: (res) => { res.setHeader('Access-Control-Allow-Origin', '*'); },
}));
```

- [ ] **Step 2: Verify**

```bash
cd server && npm run dev
curl -s http://127.0.0.1:8080/widget/chat-widget.js | head -c 200
```

Expected: minified IIFE JavaScript output.

- [ ] **Step 3: Commit**

```bash
git add server/src/server.ts
git commit -m "Server: serve widget bundle at /widget/*" && git push
```

---

**Phase 3 done.** End-to-end browser ↔ server chat works locally. Visitor sees bubble, opens panel, types message, message lands in SQLite. Phase-2 capture flow works (manually tested by lowering the delay temporarily). No operator console yet — you can verify everything via `sqlite3` queries against `server/dev.db`.

---

## Phase 4 — Operator WS Protocol (Server Side)

End-state: server accepts authenticated operator WS connections, broadcasts visitor events, and routes operator messages back to visitor sockets. Verified via `wscat`.

> Apply the TDD pattern from Phases 0–3 to each task: write failing test → run → implement → run → commit. The code shown is the canonical implementation; tests should exercise the externally-observable behavior described in each task's "verifies" line.

### Task 4.1: Operator login REST endpoint

**Files:** `server/src/api/login.ts`, `server/tests/api/login.test.ts`

Verifies: `POST /api/operator/login` with correct email+password returns `{token}`; wrong password returns 401; rate-limit after 5 attempts in 1 hr from same IP.

Code (excerpt — handler):

```typescript
import { Router } from 'express';
import { OperatorsRepo } from '../repositories/operators.js';
import { OperatorTokensRepo } from '../repositories/operatorTokens.js';
import { verifyPassword } from '../auth/password.js';
import { newToken } from '../ids.js';
import type { ServerDeps } from '../server.js';

export function loginRouter(deps: ServerDeps) {
  const router = Router();
  const ops = new OperatorsRepo(deps.db);
  const tokens = new OperatorTokensRepo(deps.db);
  const attempts = new Map<string, { count: number; firstAt: number }>();

  router.post('/login', async (req, res) => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    const a = attempts.get(ip);
    if (a && now - a.firstAt < 3600_000 && a.count >= 5) return res.status(429).json({ error: 'rate_limited' });

    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'bad_request' });
    const op = ops.findByEmail(email);
    const ok = op && await verifyPassword(password, op.password_hash, deps.env.OPERATOR_PASSWORD_PEPPER);
    if (!ok) {
      const cur = a && now - a.firstAt < 3600_000 ? { count: a.count + 1, firstAt: a.firstAt } : { count: 1, firstAt: now };
      attempts.set(ip, cur);
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const tok = newToken();
    tokens.create(tok, op.id, now);
    return res.json({ token: tok, displayName: op.display_name });
  });
  return router;
}
```

Mount in `server/src/server.ts`: `app.use('/api/operator', loginRouter(deps));`

Commit: `Server: POST /api/operator/login`.

### Task 4.2: Operator WS auth + connection handler scaffold

**Files:** `server/src/ws/operator.ts`, `server/tests/ws/operatorAuth.test.ts`

Verifies: WS upgrade without `Authorization: Bearer <valid token>` is closed with 1008; valid token connects.

Implementation pattern:

```typescript
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { ServerDeps } from '../server.js';
import { OperatorTokensRepo } from '../repositories/operatorTokens.js';

export function authenticateOperatorUpgrade(req: IncomingMessage, deps: ServerDeps): number | null {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  return new OperatorTokensRepo(deps.db).findOperatorIdByToken(token, Date.now()) ?? null;
}

export function handleOperatorConnection(ws: WebSocket, _req: IncomingMessage, _deps: ServerDeps, _operatorId: number): void {
  ws.on('message', () => { /* implemented in 4.3 */ });
  ws.on('close', () => { /* cleanup in 4.5 */ });
}
```

Update `server/src/server.ts` upgrade handler:

```typescript
} else if (url.pathname === '/ws/operator') {
  const opId = authenticateOperatorUpgrade(req, deps);
  if (opId == null) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
  wssOperator.handleUpgrade(req, socket, head, (ws) => handleOperatorConnection(ws, req, deps, opId));
}
```

Commit: `Server: operator WS auth via bearer token`.

### Task 4.3: Operator message protocol (Zod schemas)

**Files:** `server/src/ws/operatorProtocol.ts`, `server/tests/ws/operatorProtocol.test.ts`

Schemas for every C→S type from spec §6.2: `subscribe`, `set_status`, `open_chat`, `send_message`, `typing`, `mark_seen`, `update_visitor`, `end_chat`. Same Zod discriminated-union pattern as `protocol.ts`. Export `parseOperatorMessage(raw): OperatorMessageT | null`.

Commit: `Server: operator WS message schemas`.

### Task 4.4: Subscribe + state_snapshot

**Files:** modify `server/src/ws/operator.ts`, `server/src/live/operatorClients.ts`

Add `OperatorClients` registry (single operator in v1, but designed for multi):

```typescript
import type { WebSocket } from 'ws';
export class OperatorClients {
  private byOperator = new Map<number, Set<WebSocket>>();
  add(operatorId: number, ws: WebSocket) {
    let s = this.byOperator.get(operatorId);
    if (!s) { s = new Set(); this.byOperator.set(operatorId, s); }
    s.add(ws);
  }
  remove(operatorId: number, ws: WebSocket) {
    this.byOperator.get(operatorId)?.delete(ws);
    if (this.byOperator.get(operatorId)?.size === 0) this.byOperator.delete(operatorId);
  }
  broadcastTo(operatorId: number, msg: unknown): number {
    const s = this.byOperator.get(operatorId);
    if (!s) return 0;
    const json = JSON.stringify(msg);
    let n = 0;
    for (const ws of s) { try { ws.send(json); n++; } catch {} }
    return n;
  }
  hasAnyConnection(operatorId: number): boolean { return (this.byOperator.get(operatorId)?.size ?? 0) > 0; }
}
```

Add `oc: OperatorClients` to `ServerDeps`.

In operator WS handler, on `subscribe`:

```typescript
case 'subscribe': {
  deps.oc.add(operatorId, ws);
  // Build state snapshot from LiveSessions + ConversationsRepo
  const liveVisitors = deps.ls.list().map(serializeLive);
  const open = new ConversationsRepo(deps.db).listOpenAndQueued().map(c => ({ ...c, lastMessages: new MessagesRepo(deps.db).listByConversation(c.id, 50) }));
  ws.send(JSON.stringify({ type: 'state_snapshot', liveVisitors, openConversations: open.filter(c => c.status === 'live'), queuedConversations: open.filter(c => c.status === 'queued') }));
  break;
}
```

`serializeLive` produces a JSON-safe view of a `LiveSession` (omits the `sockets` Set).

Commit: `Server: operator subscribe + state_snapshot`.

### Task 4.5: visitor → operator broadcast hooks

**Files:** modify `server/src/ws/visitor.ts`

In every visitor handler that creates/changes state, also broadcast to the operator:

- After `hello` → `{type:'visitor_appeared', visitor, session}`
- After `presence` page change → `{type:'visitor_updated', visitorId, patch:{currentPage}}`
- After `lead_signal` score bump → `{type:'visitor_updated', visitorId, patch:{leadScore}}`
- After `chat_message` insert → `{type:'new_message', conversationId, message}` AND `{type:'conversation_queued', conversation}` if status='queued'
- After `typing` → `{type:'visitor_typing', conversationId, isTyping}`
- On WS close (after grace period of 30s) → `{type:'visitor_left', visitorId}`

Use `deps.oc.broadcastTo(1, msg)` (single operator id=1 in v1).

Add a "high priority alert" check: if `leadScore` crosses 8, broadcast `{type:'high_priority_alert', visitorId, reason:'lead_score_8'}`.

Commit: `Server: visitor events broadcast to operator WS`.

### Task 4.6: Operator → visitor — send_message + typing + mark_seen

**Files:** modify `server/src/ws/operator.ts`

```typescript
case 'send_message': {
  const conv = new ConversationsRepo(deps.db).findById(msg.conversationId);
  if (!conv) return;
  const now = Date.now();
  const m = new MessagesRepo(deps.db).insert({
    conversation_id: msg.conversationId, sender: 'operator',
    body: msg.body, sent_at: now, quick_reply_id: msg.quickReplyId ?? null,
  });
  new ConversationsRepo(deps.db).bumpLastMessageAt(msg.conversationId, now);
  if (conv.status === 'queued') {
    new ConversationsRepo(deps.db).setStatus(msg.conversationId, 'live', now);
    deps.timers.cancel(msg.conversationId);
  }
  // Fan out to visitor's sockets
  const live = deps.ls.get(conv.visitor_id);
  const payload = JSON.stringify({ type: 'operator_message', messageId: m.id, body: m.body, operatorName: 'Alex', sentAt: now });
  if (live) for (const sock of live.sockets) try { sock.send(payload); } catch {}
  // Echo back to operator (so other operator tabs see it)
  deps.oc.broadcastTo(operatorId, { type: 'new_message', conversationId: conv.id, message: m });
  break;
}

case 'typing': {
  const conv = new ConversationsRepo(deps.db).findById(msg.conversationId);
  if (!conv) return;
  const live = deps.ls.get(conv.visitor_id);
  const payload = JSON.stringify({ type: 'operator_typing', isTyping: msg.isTyping });
  if (live) for (const sock of live.sockets) try { sock.send(payload); } catch {}
  break;
}

case 'mark_seen': {
  new MessagesRepo(deps.db).markAllSeenInConversation(msg.conversationId, msg.lastMessageId, Date.now());
  // Notify visitor
  const conv = new ConversationsRepo(deps.db).findById(msg.conversationId);
  if (!conv) return;
  const live = deps.ls.get(conv.visitor_id);
  const payload = JSON.stringify({ type: 'seen', messageId: msg.lastMessageId, seenAt: Date.now() });
  if (live) for (const sock of live.sockets) try { sock.send(payload); } catch {}
  break;
}
```

Tests: integration test connects two WS clients (one as visitor, one as operator), exercises round-trip.

Commit: `Server: operator send_message + typing + mark_seen`.

### Task 4.7: update_visitor + end_chat handlers

**Files:** modify `server/src/ws/operator.ts`

```typescript
case 'update_visitor': {
  new VisitorsRepo(deps.db).updateContact(msg.visitorId, { name: msg.name, email: msg.email, phone: msg.phone });
  deps.oc.broadcastTo(operatorId, { type: 'visitor_updated', visitorId: msg.visitorId, patch: { name: msg.name, email: msg.email, phone: msg.phone } });
  break;
}
case 'end_chat': {
  new ConversationsRepo(deps.db).setStatus(msg.conversationId, 'closed', Date.now());
  deps.timers.cancel(msg.conversationId);
  // Notify visitor with system message
  const conv = new ConversationsRepo(deps.db).findById(msg.conversationId);
  if (conv) {
    const live = deps.ls.get(conv.visitor_id);
    if (live) for (const sock of live.sockets) try { sock.send(JSON.stringify({ type: 'system', body: 'This conversation has ended. Thanks for chatting!' })); } catch {}
  }
  deps.oc.broadcastTo(operatorId, { type: 'conversation_closed', conversationId: msg.conversationId });
  break;
}
```

Commit: `Server: operator update_visitor + end_chat`.

### Task 4.8: Manual end-to-end smoke

In three terminals:

1. `cd server && npm run dev`
2. `wscat -c ws://127.0.0.1:8080/ws/visitor` (send hello, chat_open, chat_message)
3. Get an operator token first: create operator via SQL (`INSERT INTO operators ...`), then `curl -X POST http://127.0.0.1:8080/api/operator/login -H 'Content-Type: application/json' -d '{"email":"a@b.com","password":"..."}'`. Then `wscat -c ws://127.0.0.1:8080/ws/operator -H "Authorization: Bearer <token>"`. Send `subscribe`. Watch visitor messages arrive.

Commit (if changes made during smoke): `Server: phase 4 smoke fixes`.

---

**Phase 4 done.** Server's full bidirectional protocol works end-to-end. Visitor messages reach a wscat-simulated operator. Operator messages reach the browser widget.

---

## Phase 5 — Operator Console MVP

End-state: a working PWA at `http://localhost:5173` with login, three-pane layout, real-time presence panel, send-receive messages, editable contact fields, quick replies CRUD.

### Task 5.1: Login page + token store

**Files:** `console/src/auth/tokenStore.ts`, `console/src/auth/LoginPage.tsx`, `console/tests/auth/tokenStore.test.ts`

```typescript
// tokenStore.ts
const KEY = 's1031_op_token';
export const tokenStore = {
  get: () => localStorage.getItem(KEY),
  set: (t: string) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY),
};
```

LoginPage: form with email/password → POST `/api/operator/login` → on success, store token, navigate to `/`. On failure, show error.

Commit: `Console: login + token store`.

### Task 5.2: Operator WS client

**Files:** `console/src/ws/operatorClient.ts`

Same shape as `widget/src/ws.ts` but with `Authorization: Bearer` (browsers don't allow custom headers on WebSocket — use a query string `?token=...` instead and modify `server/src/ws/operator.ts` to accept token from either header or query). Update `authenticateOperatorUpgrade` to also check `new URL(req.url, 'http://x').searchParams.get('token')`.

Commit: `Console: operator WS client (token via query string)`.

### Task 5.3: Global state with Preact signals

**Files:** `console/src/state/store.ts`

```typescript
import { signal, computed } from '@preact/signals';
import type { /* serialized types */ } from '...';

export const liveVisitors = signal<Record<string, LiveVisitor>>({});
export const conversations = signal<Record<string, ConversationWithMessages>>({});
export const selectedConversationId = signal<string | null>(null);
export const operatorStatus = signal<'online' | 'away' | 'dnd'>('online');
export const quickReplies = signal<QuickReply[]>([]);

export const queuedConversations = computed(() => Object.values(conversations.value).filter(c => c.status === 'queued'));
export const liveConversations = computed(() => Object.values(conversations.value).filter(c => c.status === 'live'));
```

WS message handlers update these signals (e.g., `visitor_appeared` → add to liveVisitors; `new_message` → push into the conversation; `visitor_left` → delete).

Commit: `Console: signal-based global state + WS reducers`.

### Task 5.4: Three-pane layout shell

**Files:** `console/src/App.tsx`, `console/src/panels/{Left,Middle,Right}.tsx`

App.tsx: Tailwind `grid grid-cols-[280px_1fr_360px] h-screen`. Routes for `/login` and `/` and `/settings`. If no token → redirect to login.

Each panel is a Preact component subscribing to the relevant signals.

Commit: `Console: three-pane layout shell`.

### Task 5.5: LeftPane — visitor row list

**Files:** `console/src/panels/LeftPane.tsx`, `console/src/components/VisitorRow.tsx`

Renders three sections from the mockup: "In conversation" (selected conversation's visitor), "Waiting (queued)", "Live now (not chatting)". Hot-lead highlight (`leadScore >= 8`). Click a row → set `selectedConversationId.value = ...` (or open ping modal if not yet in conversation — that's Phase 6).

Visual matches mockup operator-console-v1.html.

Commit: `Console: left pane with visitor rows`.

### Task 5.6: MiddlePane — chat thread + composer

**Files:** `console/src/panels/MiddlePane.tsx`, `console/src/components/{ChatThread,Composer,QuickReplies}.tsx`

Renders messages from `conversations.value[selectedId].messages`. Composer with textarea + Send button. Cmd/Ctrl+Enter sends. Quick-reply chips below — click inserts text into the composer (does NOT auto-send). Editable list of chips; "+ Edit chips" button opens settings page.

`Composer.onSend` → `ws.send({type:'send_message', conversationId, body})`.

Commit: `Console: chat thread + composer + quick reply chips`.

### Task 5.7: RightPane — visitor detail with editable contact

**Files:** `console/src/panels/RightPane.tsx`, `console/src/components/{EditableContact,LeadScoreBox,JourneyTimeline}.tsx`

`EditableContact`: name/email/phone inputs that fire `ws.send({type:'update_visitor', visitorId, ...})` on blur or 1.5s debounce.

`LeadScoreBox`: gradient orange box with score + reasons.

`JourneyTimeline`: vertical list of pages from `liveVisitor.journey`.

Source/UTMs section, Geo & Device section, Engagement signals. Static for now — data comes from `liveVisitors` map and from a new `GET /api/visitor/:id/detail` REST endpoint.

Commit: `Console: right pane visitor detail (editable contact + lead score + journey)`.

### Task 5.8: Quick replies CRUD

**Files:** `console/src/settings/QuickReplyEditor.tsx`, `server/src/api/quickReplies.ts`

REST endpoints (operator-auth required via bearer header):
- `GET /api/operator/quick-replies` → list
- `POST /api/operator/quick-replies` `{label, body}` → create
- `PUT /api/operator/quick-replies/:id` `{label?, body?, sort_order?}` → update
- `DELETE /api/operator/quick-replies/:id`

Console settings page: list of chips with drag-to-reorder, edit, delete.

Commit: `Console + server: quick replies CRUD`.

### Task 5.9: REST: GET visitor detail

**Files:** `server/src/api/visitorDetail.ts`

`GET /api/operator/visitor/:id` → JSON with visitor row + most recent session row + page_views[] + lead_signals[] + recent conversations.

Commit: `Server: GET /api/operator/visitor/:id`.

### Task 5.10: Manual end-to-end with widget

In four terminals: server, widget watch, widget demo http-server, console dev. Open both `http://127.0.0.1:9000` (widget) and `http://localhost:5173/console` (operator). Verify:
- Visitor in widget → appears live in operator console left pane
- Visitor types message → appears in operator middle pane
- Operator types reply → appears in visitor widget
- Operator edits name in right rail → DB row updates
- Operator clicks "End chat" → visitor sees system message, widget resets

Fix any issues found.

Commit (if needed): `Phase 5 e2e fixes`.

---

**Phase 5 done.** Console MVP works end-to-end with the widget. Three-pane layout, real-time presence, full chat exchange, contact editing, quick replies. No proactive ping yet, no status toggle, no PWA.

---

## Phase 6 — Proactive Ping + Status Toggle + Quiet Hours

End-state: operator can click any "Live now" visitor and pop a Ping modal that opens chat on their widget. Operator status toggle controls Web Push fan-out (push lives in Phase 8 — for now status just controls whether new conversations land in `queued` vs `live`).

### Task 6.1: Server — open_chat handler

**Files:** modify `server/src/ws/operator.ts`

```typescript
case 'open_chat': {
  const visitorId = msg.visitorId;
  const live = deps.ls.get(visitorId);
  if (!live) {
    deps.oc.broadcastTo(operatorId, { type: 'error', code: 'visitor_offline', visitorId });
    return;
  }
  // Idempotency: if conversation in last 60s, reuse it
  const cutoff = Date.now() - 60_000;
  const existing = new ConversationsRepo(deps.db).findOpenForVisitor(visitorId, cutoff);
  if (existing) {
    deps.oc.broadcastTo(operatorId, { type: 'conversation_opened', conversationId: existing.id });
    return;
  }
  const cid = newConversationId();
  new ConversationsRepo(deps.db).create({
    id: cid, visitor_id: visitorId, opened_session_id: live.activeSessionId,
    status: 'live', opened_at: Date.now(), initiated_by: 'operator',
  });
  deps.ls.patch(visitorId, { conversationId: cid });
  deps.oc.broadcastTo(operatorId, { type: 'conversation_opened', conversationId: cid });
}
```

When the operator next sends a `send_message` to that conversation, the existing handler from 4.6 fans out to the visitor — but on the *first* operator message, the visitor's widget needs the special "operator pinged you" treatment. So in `send_message`, check if conversation was just opened with `initiated_by='operator'` AND has zero prior messages → emit `operator_pinged_you` instead of `operator_message`.

Commit: `Server: open_chat + operator_pinged_you on first message`.

### Task 6.2: Console — Ping modal

**Files:** `console/src/components/PingModal.tsx`, modify `LeftPane.tsx`

Click on a "Live now" row (one without a `conversationId`) → open modal with a textarea preview ("Hi! Saw you reading our forward exchange flow…") and Send button. On Send: `ws.send({type:'open_chat', visitorId})` then `ws.send({type:'send_message', conversationId, body})` (using the `conversationId` from `conversation_opened` reply).

Commit: `Console: Ping modal for proactive chat`.

### Task 6.3: Server — set_status handler

**Files:** modify `server/src/ws/operator.ts`

```typescript
case 'set_status': {
  new OperatorsRepo(deps.db).setStatus(operatorId, msg.status);
  deps.oc.broadcastTo(operatorId, { type: 'status_changed', status: msg.status });
  break;
}
```

Commit: `Server: set_status handler`.

### Task 6.4: Console — status dropdown UI

**Files:** modify `console/src/panels/LeftPane.tsx`

Status select in left header (Online / Away / DND). On change → `ws.send({type:'set_status', status})`. The pill color/animation reflects the current `operatorStatus.value` signal.

Commit: `Console: status dropdown UI`.

### Task 6.5: Quiet hours config

**Files:** `server/src/api/settings.ts`, `console/src/settings/QuietHoursEditor.tsx`

Server: `PUT /api/operator/settings` `{quiet_hours_start?, quiet_hours_end?, timezone?}` → update operator row.

Console: settings page with two time inputs ("Start" / "End"). Default 9:00 PM / 8:00 AM. Store in operator's timezone.

Commit: `Server + Console: quiet hours editor`.

### Task 6.6: Quiet hours computation

**Files:** `server/src/quietHours.ts`, `server/tests/quietHours.test.ts`

```typescript
export function isInQuietHours(start: string | null, end: string | null, timezone: string, now = new Date()): boolean {
  if (!start || !end) return false;
  const localTime = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  // localTime like "21:30"
  return overlapsInterval(localTime, start, end);
}
function overlapsInterval(time: string, start: string, end: string): boolean {
  const [t, s, e] = [time, start, end].map(toMinutes);
  if (s <= e) return t >= s && t < e;          // same-day window e.g. 09:00-17:00
  return t >= s || t < e;                       // wraps midnight e.g. 21:00-08:00
}
function toMinutes(s: string): number { const [h, m] = s.split(':').map(Number); return h * 60 + m; }
```

Used by Phase 8 push fan-out logic.

Commit: `Server: quiet hours computation`.

### Task 6.7: high_priority_alert UX

**Files:** modify `console/src/state/store.ts`, `console/src/components/Toast.tsx`

When `high_priority_alert` arrives over WS, play a sound (`new Audio('/console/alert.mp3').play()`) and show a Toast: "🔥 Hot lead on /tax-calculator — score 9". Click toast → select that visitor.

Add `console/public/alert.mp3` (any short notification sound, e.g., download from freesound.org).

Commit: `Console: high-priority lead alert (sound + toast)`.

---

**Phase 6 done.** Operator can proactively ping any live visitor; visitor's widget pops open with the operator's message. Status toggle works. Quiet hours stored. Hot-lead alerts.

---

## Phase 7 — Lead Score, Journey Panel, Geo, Device

End-state: right rail in operator console renders the score breakdown, journey timeline, source/UTMs, geo (city/state/timezone), and device parsed from UA. Visitor widget fires the right `lead_signal` events from the existing `analytics-engine.js` pattern.

### Task 7.1: Widget — emit lead_signal events from existing analytics hooks

**Files:** `widget/src/analytics.ts`, modify `widget/src/index.ts`

```typescript
export function setupAnalyticsBridge(send: (msg: any) => void): void {
  // Calculator usage (custom event from tax-calculator.html)
  window.addEventListener('simple1031:calculator_used', (e: any) => {
    send({ type: 'lead_signal', kind: 'calculator_used', payload: e.detail ?? null });
  });
  window.addEventListener('simple1031:exit_intent', () => {
    send({ type: 'lead_signal', kind: 'exit_intent' });
  });
  window.addEventListener('simple1031:form_started', () => {
    send({ type: 'lead_signal', kind: 'form_started' });
  });
  window.addEventListener('simple1031:high_intent', (e: any) => {
    send({ type: 'lead_signal', kind: 'high_intent', payload: e.detail ?? null });
  });
  // Detect returning visitor on first hello (handled server-side via first_seen_at vs now)
}
```

Wire into `index.ts`: `setupAnalyticsBridge((m) => ws.send(m));` after WS construction.

Commit: `Widget: bridge analytics events to lead_signal`.

### Task 7.2: Server — derive returning_visitor on hello

**Files:** modify `server/src/ws/visitor.ts`

After `visitors.upsert` in the hello handler, check the visitor row: if `first_seen_at < now - 24h`, fire a `returning_visitor` lead signal automatically. Also detect `google_ads_click` (`utms.gclid` present) and `pricing_page_view` (`page.url` matches `/pricing` or `/lp/start-your-1031`).

Commit: `Server: derive automatic lead signals on hello`.

### Task 7.3: Right rail — Lead Score Box with breakdown

**Files:** `console/src/components/LeadScoreBox.tsx` (already created in 5.7, enhance)

Renders the gradient orange box with `score` and a list of reasons. Reasons come from `GET /api/operator/visitor/:id` response (which lists `lead_signals` rows).

Commit: `Console: lead score breakdown render`.

### Task 7.4: Right rail — Journey Timeline

**Files:** `console/src/components/JourneyTimeline.tsx` (enhance)

Vertical list of `page_views`, current page highlighted. Use the same blue-dot-with-ring style as the mockup.

Commit: `Console: journey timeline render`.

### Task 7.5: Server — GeoIP lookup

**Files:** `server/src/geo/lookup.ts`, modify `server/src/ws/visitor.ts`

```typescript
import { open as openMmdb, type Reader, type CityResponse } from 'maxmind';

let reader: Reader<CityResponse> | null = null;

export async function loadGeoDb(path: string): Promise<void> {
  try { reader = await openMmdb(path); } catch { reader = null; }
}

export type GeoResult = { city: string | null; region: string | null; country: string | null; timezone: string | null };

export function lookup(ip: string | null): GeoResult {
  if (!reader || !ip) return { city: null, region: null, country: null, timezone: null };
  try {
    const r = reader.get(ip);
    return {
      city: r?.city?.names?.en ?? null,
      region: r?.subdivisions?.[0]?.names?.en ?? null,
      country: r?.country?.iso_code ?? null,
      timezone: r?.location?.time_zone ?? null,
    };
  } catch { return { city: null, region: null, country: null, timezone: null }; }
}
```

Boot: `await loadGeoDb(env.GEOIP_DB_PATH);` in `server/src/index.ts`. In `hello` handler, call `lookup(ip)` and update `sessions.create` payload with city/region/country/timezone.

Note: bootstrap.sh (Phase 10) downloads GeoLite2-City.mmdb. For local dev, set `GEOIP_DB_PATH=` to a non-existent path → lookup gracefully returns nulls.

Commit: `Server: GeoIP lookup via MaxMind GeoLite2`.

### Task 7.6: Server — UA parsing

**Files:** modify `server/src/ws/visitor.ts`

```typescript
import { UAParser } from 'ua-parser-js';
// In hello handler:
const ua = new UAParser(msg.userAgent);
const device_type = ua.getDevice().type ?? 'desktop';
const browser = ua.getBrowser().name ?? null;
const os = ua.getOS().name ?? null;
// pass to sessions.create
```

Commit: `Server: parse UA into device_type/browser/os`.

### Task 7.7: Right rail — Source + Geo + Device + Engagement

**Files:** modify `console/src/panels/RightPane.tsx`

Render Source (channel from utm_source, campaign, term, gclid), Geo (city, region, timezone), Device (device_type · browser · os), Engagement (calculator_used flag with payload, exit_intent, form_started, scroll depth bar). Pull from the visitor detail endpoint and from the live `LiveSession` for current scroll.

Commit: `Console: source + geo + device + engagement render`.

### Task 7.8: Returning visitor badge

**Files:** modify `console/src/panels/RightPane.tsx`

If the visitor's session count > 1, show "RETURNING · Nth visit" purple badge next to display name. Server adds `visitCount` to the visitor detail response.

Commit: `Console: returning visitor badge`.

---

**Phase 7 done.** Right rail matches the mockup. Lead score updates live as the visitor triggers events. Journey, source, geo, device all populate.

---

## Phase 8 — Web Push Notifications

End-state: operator's PWA receives Web Push notifications when offline/away/DND/quiet-hours and a visitor opens a chat.

### Task 8.1: VAPID key generation script

**Files:** `infra/scripts/gen-vapid.sh`

```bash
#!/bin/bash
set -euo pipefail
echo "Add the following to /etc/tidio-remake/env:"
node -e "const wp=require('web-push');const k=wp.generateVAPIDKeys();console.log('VAPID_PUBLIC_KEY='+k.publicKey+'\\nVAPID_PRIVATE_KEY='+k.privateKey);"
echo "VAPID_SUBJECT=mailto:alex@simple1031x.com"
```

Commit: `Infra: VAPID key generation script`.

### Task 8.2: Push subscribe REST endpoint

**Files:** `server/src/api/pushSubscribe.ts`

```typescript
router.post('/push-subscribe', operatorAuth, (req, res) => {
  const { endpoint, keys, deviceLabel } = req.body;
  new PushSubscriptionsRepo(deps.db).upsert({
    operator_id: req.operatorId, endpoint, p256dh: keys.p256dh, auth: keys.auth,
    device_label: deviceLabel, created_at: Date.now(),
  });
  res.json({ ok: true });
});
router.get('/push-public-key', (_req, res) => res.json({ key: deps.env.VAPID_PUBLIC_KEY }));
router.delete('/push-subscribe', operatorAuth, (req, res) => {
  new PushSubscriptionsRepo(deps.db).deleteByEndpoint(req.body.endpoint);
  res.json({ ok: true });
});
```

`operatorAuth` middleware: parse bearer, look up token, attach `req.operatorId`.

Commit: `Server: push subscribe REST endpoints`.

### Task 8.3: Push dispatcher module

**Files:** `server/src/push/dispatcher.ts`

```typescript
import webpush from 'web-push';
import { PushSubscriptionsRepo } from '../repositories/pushSubscriptions.js';
import type { ServerDeps } from '../server.js';

export async function pushToOperator(deps: ServerDeps, operatorId: number, payload: { title: string; body: string; url?: string }): Promise<void> {
  webpush.setVapidDetails(deps.env.VAPID_SUBJECT, deps.env.VAPID_PUBLIC_KEY, deps.env.VAPID_PRIVATE_KEY);
  const repo = new PushSubscriptionsRepo(deps.db);
  const subs = repo.listForOperator(operatorId);
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
      repo.bumpLastUsed(s.id, Date.now());
    } catch (e: any) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        repo.deleteByEndpoint(s.endpoint);
      }
    }
  }
}
```

Commit: `Server: Web Push dispatcher with 410 cleanup`.

### Task 8.4: Trigger push on visitor message when operator unavailable

**Files:** modify `server/src/ws/visitor.ts`

In `chat_message` handler, after inserting the message:

```typescript
const op = operators.findById(1);
const inQuietHours = isInQuietHours(op?.quiet_hours_start ?? null, op?.quiet_hours_end ?? null, op?.timezone ?? 'America/Los_Angeles');
const hasLiveOperatorWS = deps.oc.hasAnyConnection(1);
const opOffline = !op || op.status !== 'online' || !hasLiveOperatorWS || inQuietHours;
if (opOffline) {
  pushToOperator(deps, 1, {
    title: `Visitor on ${state.currentPage?.url ?? '?'}`,
    body: msg.body.slice(0, 100),
    url: `https://chat.simple1031x.com/console#/chat/${conv.id}`,
  }).catch(err => logger.warn({ err }, 'push failed'));
}
```

Commit: `Server: push notify operator on visitor message when unavailable`.

### Task 8.5: Console — register push subscription

**Files:** `console/src/push/subscribe.ts`, modify `console/src/App.tsx`

```typescript
export async function registerPush(token: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const reg = await navigator.serviceWorker.register('/console/sw.js');
  const { key } = await fetch('/api/operator/push-public-key').then(r => r.json());
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  await fetch('/api/operator/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: sub.toJSON().keys,
      deviceLabel: detectDeviceLabel(),
    }),
  });
}
function urlBase64ToUint8Array(b64: string): Uint8Array { /* standard helper */ }
function detectDeviceLabel(): string { /* "PC Chrome" / "Pixel 8" from UA */ }
```

Wire into `App.tsx`: after successful login, call `registerPush(token)`.

Commit: `Console: Web Push subscription registration`.

---

**Phase 8 done.** Operator's devices receive push notifications when they're not actively at the console.

---

## Phase 9 — PWA: Service Worker + Manifest + Offline Shell

End-state: console installable on PC and Android via "Add to Home Screen". Service worker handles push events when console is closed.

### Task 9.1: manifest.webmanifest + icons

**Files:** `console/public/manifest.webmanifest`, `console/public/icons/icon-{192,512}.png`

```json
{
  "name": "Simple 1031 Console",
  "short_name": "S1031 Console",
  "start_url": "/console/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    { "src": "/console/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/console/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Generate icons: Use any online generator from a 512×512 source PNG. Drop into `console/public/icons/`.

In `console/index.html` `<head>`:
```html
<link rel="manifest" href="/console/manifest.webmanifest">
<meta name="theme-color" content="#2563eb">
<link rel="apple-touch-icon" href="/console/icons/icon-192.png">
```

Commit: `Console: manifest + icons`.

### Task 9.2: Service worker

**Files:** `console/src/sw.ts`, modify `console/vite.config.ts` to build it as a separate entry to `dist/sw.js`.

```typescript
self.addEventListener('install', () => (self as any).skipWaiting());
self.addEventListener('activate', (e: any) => e.waitUntil((self as any).clients.claim()));

self.addEventListener('push', (event: any) => {
  let data: any = {};
  try { data = event.data?.json() ?? {}; } catch {}
  const title = data.title ?? 'New chat';
  const options = {
    body: data.body ?? '',
    data: { url: data.url ?? '/console/' },
    icon: '/console/icons/icon-192.png',
    badge: '/console/icons/icon-192.png',
  };
  event.waitUntil((self as any).registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/console/';
  event.waitUntil((self as any).clients.matchAll({ type: 'window' }).then((clients: any[]) => {
    for (const c of clients) { if (c.url.includes('/console') && 'focus' in c) { c.navigate(targetUrl); return c.focus(); } }
    return (self as any).clients.openWindow(targetUrl);
  }));
});
```

Vite config addition:
```typescript
build: {
  rollupOptions: {
    input: {
      main: 'index.html',
      sw: 'src/sw.ts',
    },
    output: {
      entryFileNames: (info) => info.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js',
    },
  },
},
```

Commit: `Console: service worker + push event handler`.

### Task 9.3: Offline shell

**Files:** modify `console/src/sw.ts`

Add a basic cache-first strategy for `/console/index.html` and the bundled JS/CSS. Doesn't need to be sophisticated — operator usually has internet; this is just so the PWA opens on Android even without WS connection.

```typescript
const CACHE = 'tidio-console-v1';
const PRECACHE = ['/console/', '/console/index.html'];
self.addEventListener('install', (e: any) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  (self as any).skipWaiting();
});
self.addEventListener('fetch', (e: any) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r ?? fetch(e.request)));
});
```

Commit: `Console: offline shell caching`.

### Task 9.4: Add to Home Screen prompt

**Files:** `console/src/components/InstallPrompt.tsx`

Listen for `beforeinstallprompt` event, store the prompt, show a small "Install app" button in the header. On click, call `prompt.prompt()`. Hide on Android Chrome standalone (already installed).

Commit: `Console: A2HS install prompt`.

### Task 9.5: PWA verification

In Android Chrome, navigate to `https://chat.simple1031x.com/console` (after Phase 10 deploy). Tap menu → "Install app". Verify:
- App icon on home screen
- Opens in standalone window
- Push notification arrives even when app is closed

(Local PWA testing: Chrome DevTools → Application → Manifest, verify everything.)

Commit (if any tweaks): `Console: PWA verification fixes`.

---

**Phase 9 done.** Console is a fully installable PWA with background push.

---

## Phase 10 — Deploy Infrastructure + Site Integration + Production Launch

End-state: tidio-remake live at `chat.simple1031x.com`, integrated into `simple1031x.com` (widget tag swapped on production HTML).

### Task 10.1: Caddyfile

**Files:** `infra/Caddyfile`

(Copy from spec §9.2.) Place `/etc/caddy/Caddyfile` on server.

Commit: `Infra: Caddyfile for chat.simple1031x.com`.

### Task 10.2: systemd unit

**Files:** `infra/tidio-remake.service`

(Copy from spec §9.3.) Install at `/etc/systemd/system/tidio-remake.service`.

Commit: `Infra: systemd service unit`.

### Task 10.3: bootstrap.sh

**Files:** `infra/bootstrap.sh`

```bash
#!/bin/bash
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
  echo "VISITOR_COOKIE_SECRET=$(openssl rand -hex 32)" > /etc/tidio-remake/env
  echo "OPERATOR_PASSWORD_PEPPER=$(openssl rand -hex 32)" >> /etc/tidio-remake/env
  echo "DATABASE_PATH=/var/lib/tidio-remake/chat.db" >> /etc/tidio-remake/env
  echo "GEOIP_DB_PATH=/var/lib/tidio-remake/GeoLite2-City.mmdb" >> /etc/tidio-remake/env
  echo "PORT=8080" >> /etc/tidio-remake/env
  echo "NODE_ENV=production" >> /etc/tidio-remake/env
  echo "LOG_LEVEL=info" >> /etc/tidio-remake/env
  # VAPID — generate after Node install
  node -e "const wp=require('web-push');const k=wp.generateVAPIDKeys();console.log('VAPID_PUBLIC_KEY='+k.publicKey+'\\nVAPID_PRIVATE_KEY='+k.privateKey);" >> /etc/tidio-remake/env
  echo "VAPID_SUBJECT=mailto:alex@simple1031x.com" >> /etc/tidio-remake/env
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
```

Commit: `Infra: bootstrap.sh`.

### Task 10.4: deploy.sh

**Files:** `infra/deploy.sh`

```bash
#!/bin/bash
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
```

Commit: `Infra: deploy.sh`.

### Task 10.5: backup.sh + cron

**Files:** `infra/backup.sh`, `infra/cron.d/tidio-remake-backup`

backup.sh from spec §9.5. Cron entry:
```
0 3 * * * tidio /opt/tidio-remake/infra/backup.sh
```

Install: `cp infra/cron.d/tidio-remake-backup /etc/cron.d/`.

Commit: `Infra: backup.sh + cron entry`.

### Task 10.6: First-run setup wizard

**Files:** `console/src/auth/SetupPage.tsx`, `server/src/api/setup.ts`

If `OperatorsRepo.countAll() === 0`, console redirects `/login` → `/setup`. Setup form: email, display name, password, password confirm. POSTs to `/api/operator/setup` (only works when no operator exists). Server creates the operator + first token.

Commit: `Console + server: first-run setup wizard`.

### Task 10.7: First production deploy

Manually on the server:

```bash
ssh root@server.mortalitygame.com
git clone https://github.com/a-banoub/tidio-remake.git /opt/tidio-remake
chown -R tidio:tidio /opt/tidio-remake
cd /opt/tidio-remake/infra
bash bootstrap.sh
# Review /etc/tidio-remake/env
# Download MaxMind GeoLite2-City.mmdb to /var/lib/tidio-remake/
systemctl restart tidio-remake
```

Verify:
- `systemctl status tidio-remake` → active (running)
- `curl -s https://chat.simple1031x.com/health` → JSON status
- Browse `https://chat.simple1031x.com/console` → setup wizard
- Complete setup → operator console loads
- Open a second browser, hit `https://chat.simple1031x.com/widget/chat-widget.js` → 200 with JS

Commit: `Infra: production deploy verification` (only if any fixes were needed).

### Task 10.8: DNS + Caddy + TLS verification

```bash
# At your DNS registrar:
# Add CNAME chat.simple1031x.com → server.mortalitygame.com

# After DNS propagates (~5 min):
dig chat.simple1031x.com +short  # should show server's IP

# Caddy auto-fetches TLS:
journalctl -u caddy -f  # watch for "certificate obtained successfully"

# Verify:
curl -I https://chat.simple1031x.com/health  # 200, TLS valid
```

Commit (none, this is operational).

### Task 10.9: Site integration PR to Simple-1031

**Files:** modify all `simple1031x.com` HTML pages (see Simple-1031 repo)

In a separate PR on the `Simple-1031` repo, replace in each HTML page:

```html
<link rel="stylesheet" href="/css/chatbot-widget.css">
<script src="/js/chatbot-widget.js" defer></script>
```

with:

```html
<script src="https://chat.simple1031x.com/widget/chat-widget.js" defer></script>
```

Old `chatbot-widget.js` and `.css` stay in the repo, just unloaded.

Use a script to do the swap across all ~98 HTML files:

```bash
cd /path/to/Simple-1031
find . -name "*.html" -exec sed -i.bak \
  -e 's|<link rel="stylesheet" href="/css/chatbot-widget.css">||g' \
  -e 's|<script src="/js/chatbot-widget.js" defer></script>|<script src="https://chat.simple1031x.com/widget/chat-widget.js" defer></script>|g' \
  {} \;
find . -name "*.html.bak" -delete
git checkout -b swap-to-tidio-remake-widget
git add -A
git commit -m "Swap to self-hosted Tidio Remake chat widget"
git push -u origin swap-to-tidio-remake-widget
gh pr create --title "Swap chatbot widget to chat.simple1031x.com" --body "Replaces the JS-rule chatbot with the new live-chat widget. Backend at chat.simple1031x.com (tidio-remake repo)."
```

Manual verification on Netlify staging deploy: bubble appears, opens, sends a message that lands in `chat.simple1031x.com` operator console.

Merge to `main`. Netlify auto-deploys. Live.

---

**Phase 10 done.** Production live. simple1031x.com pages now load the new widget. Operator console is at `https://chat.simple1031x.com/console`.

---

## Phase 11 — Acceptance Criteria Validation

### Task 11.1: Run through every checklist item from spec §13

Manually verify each acceptance criterion. For each item, write down "verified on YYYY-MM-DD" or note the issue.

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
- [ ] Daily SQLite backup running; backup restore tested (`sqlite3 chat.db ".restore '/var/lib/tidio-remake/backups/chat-YYYY-MM-DD.db'"`).
- [ ] Health endpoint responds; metrics endpoint shows live counts.

For any failures: file an issue in the tidio-remake repo, add a follow-up task, fix, re-verify.

Commit: `Docs: acceptance criteria signoff (YYYY-MM-DD)`.

---

**Phase 11 done. v1 shipped.**

---

## Open Operator Action Items (don't block plan execution)

- [ ] DNS: add CNAME `chat.simple1031x.com` → `server.mortalitygame.com` at registrar (do before Task 10.8).
- [ ] MaxMind: register at maxmind.com/en/geolite2/signup, download `GeoLite2-City.mmdb` to `/var/lib/tidio-remake/` (do before Task 10.7).
- [ ] Confirm `VAPID_SUBJECT` email — default `mailto:alex@simple1031x.com`.

## Spec Coverage Self-Check

Each spec section maps to plan tasks:
- Spec §1 Goals → entire plan; §13 acceptance criteria validates.
- Spec §2 Architecture → Phase 0 + Phase 10 deploy.
- Spec §3 Components → Phase 0.3, 0.4, 3.1–3.9, 5.1–5.10.
- Spec §4 Repo layout → Phase 0.1, 0.2.
- Spec §5 Data model → Phase 1.4 (migration), 1.7–1.11 (repos), 5.2 (LiveSessions).
- Spec §6 Wire protocol → Phase 2.2 (visitor schemas), 4.3 (operator schemas), 2.4–2.8 + 4.4–4.7 (handlers).
- Spec §7 Flows → Phase 3 + 4 + 5 + 6 (each flow exercised by integration tests + manual smokes).
- Spec §8 Auth + security → Phase 1.5 (cookie), 1.6 (password), 4.1 (login), 4.2 (operator WS auth), 8.5 (push subscribe auth), 8.4 (rate limit applied via login route).
- Spec §9 Deploy → Phase 10.
- Spec §10 Error handling → Reconnect logic in 3.3 (widget) and 5.2 (console); push 410 cleanup in 8.3; restart resilience verified in 11.1.
- Spec §11 Out of scope → not implemented.
- Spec §12 Open questions — repo placement resolved before plan; DNS/MaxMind/email tracked in operator action items above.

No gaps found.

---

## Execution Handoff

Plan complete and saved to `Simple-1031/docs/superpowers/plans/2026-05-03-tidio-remake.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
