# Warm-Visitor Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server fires a `warm_visitor_alert` 90s after a visitor's lead score becomes positive, surfaced via VAPID push + the existing `pendingAlerts` toast, deep-linking the operator to the PingModal on tap.

**Architecture:** A new `WarmVisitorTimers` module (mirroring `PhaseTransitionTimers`) tracks per-visitor timers and per-session "already fired" state. The visitor WS handler starts the timer on `hello` (when score is already > 0) and on `lead_signal` (when score crosses 0 → positive). Multiple cancel hooks (`chat_open`, `chat_message`, ws close, operator `open_chat`) clear pending timers. On fire, the server broadcasts `warm_visitor_alert` to operators and triggers a push notification. The console reducer appends the alert to the existing `pendingAlerts` signal; the `Toast` component is extended to render `reason: 'warm_visitor'` distinctly from the existing `lead_score_8` and to deep-link to the PingModal on click. `main.tsx` reads a `?ping=<visitorId>` URL param so the SW push notification can deep-link directly into the ping flow.

**Tech Stack:** TypeScript, Node 20, Express, `ws`, `better-sqlite3`, Vitest (server + console + jsdom + @testing-library/preact), Preact + `@preact/signals`, esbuild (server), Vite (console).

**Branch:** `v1.4-warm-visitor-alert` (already created, spec already committed at `9f5e83e`).

**Spec:** `docs/superpowers/specs/2026-05-04-warm-visitor-alert-design.md`

---

## File map

**Created:**
- `server/src/timers/warmVisitor.ts`
- `server/tests/timers/warmVisitor.test.ts`
- `server/tests/ws/warmVisitorAlert.test.ts`
- `console/tests/components/Toast.test.tsx`
- `console/tests/main.test.tsx`

**Modified:**
- `server/src/server.ts` — `ServerDeps` adds `warmTimers`; auto-instantiate when omitted
- `server/src/index.ts` — bootstrap a `WarmVisitorTimers`
- `server/src/ws/visitor.ts` — start/cancel hooks on hello, lead_signal, chat_open, chat_message, ws close; build `onFire` callback
- `server/src/ws/operator.ts` — cancel on `open_chat`
- `server/tests/server.smoke.test.ts` — verify auto-construct path
- `console/src/state/reducers.ts` — handle `warm_visitor_alert`
- `console/src/components/Toast.tsx` — reason-driven label/tint; warm click sets `pendingPing`
- `console/src/main.tsx` — read `?ping=` param into `pendingPing`
- `console/tests/state/reducers.test.ts` — case for `warm_visitor_alert`

---

## Task 1: WarmVisitorTimers module + unit tests

**Files:**
- Create: `server/src/timers/warmVisitor.ts`
- Test: `server/tests/timers/warmVisitor.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// server/tests/timers/warmVisitor.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WarmVisitorTimers, WARM_VISITOR_DWELL_MS } from '../../src/timers/warmVisitor.js';

describe('WarmVisitorTimers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('exports a 90-second default dwell constant', () => {
    expect(WARM_VISITOR_DWELL_MS).toBe(90_000);
  });

  it('fires onFire after the configured delay', () => {
    const t = new WarmVisitorTimers();
    const cb = vi.fn();
    t.start('v_a', 's_1', WARM_VISITOR_DWELL_MS, cb);
    vi.advanceTimersByTime(WARM_VISITOR_DWELL_MS - 1);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('marks session as fired after onFire runs', () => {
    const t = new WarmVisitorTimers();
    t.start('v_a', 's_1', 1000, () => {});
    expect(t.hasFired('s_1')).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(t.hasFired('s_1')).toBe(true);
  });

  it('start is a no-op when a timer is already running for the same visitor', () => {
    const t = new WarmVisitorTimers();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    t.start('v_a', 's_1', 1000, cb1);
    t.start('v_a', 's_1', 1000, cb2);
    vi.advanceTimersByTime(1000);
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();
  });

  it('start is a no-op when the session has already fired', () => {
    const t = new WarmVisitorTimers();
    const cb1 = vi.fn();
    t.start('v_a', 's_1', 1000, cb1);
    vi.advanceTimersByTime(1000);
    const cb2 = vi.fn();
    t.start('v_a', 's_1', 1000, cb2);
    vi.advanceTimersByTime(1000);
    expect(cb2).not.toHaveBeenCalled();
  });

  it('cancel prevents fire', () => {
    const t = new WarmVisitorTimers();
    const cb = vi.fn();
    t.start('v_a', 's_1', 1000, cb);
    t.cancel('v_a');
    vi.advanceTimersByTime(2000);
    expect(cb).not.toHaveBeenCalled();
  });

  it('cancel does not mark session as fired', () => {
    const t = new WarmVisitorTimers();
    t.start('v_a', 's_1', 1000, () => {});
    t.cancel('v_a');
    expect(t.hasFired('s_1')).toBe(false);
  });

  it('clearForSession allows a future start for the same visitor with a new sessionId', () => {
    const t = new WarmVisitorTimers();
    t.start('v_a', 's_1', 1000, () => {});
    vi.advanceTimersByTime(1000);
    expect(t.hasFired('s_1')).toBe(true);
    t.clearForSession('s_1');
    expect(t.hasFired('s_1')).toBe(false);
    const cb = vi.fn();
    t.start('v_a', 's_2', 1000, cb);
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('size reports active timer count', () => {
    const t = new WarmVisitorTimers();
    expect(t.size()).toBe(0);
    t.start('v_a', 's_1', 1000, () => {});
    t.start('v_b', 's_2', 1000, () => {});
    expect(t.size()).toBe(2);
    t.cancel('v_a');
    expect(t.size()).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npx vitest run tests/timers/warmVisitor.test.ts`
Expected: FAIL with "Cannot find module '../../src/timers/warmVisitor.js'"

- [ ] **Step 3: Write the module**

```typescript
// server/src/timers/warmVisitor.ts
export const WARM_VISITOR_DWELL_MS = 90_000;

/**
 * Per-visitor scheduling for the warm-visitor alert.
 *
 * `start` is a no-op when:
 *   - a timer is already pending for that visitorId, OR
 *   - the sessionId has already fired in this process lifetime.
 *
 * The fired set is keyed by sessionId (not visitorId) so a returning visitor
 * with a fresh session can fire again.
 */
export class WarmVisitorTimers {
  private timers = new Map<string, NodeJS.Timeout>();
  private fired = new Set<string>();

  start(visitorId: string, sessionId: string, ms: number, onFire: () => void): void {
    if (this.timers.has(visitorId)) return;
    if (this.fired.has(sessionId)) return;
    const handle = setTimeout(() => {
      this.timers.delete(visitorId);
      this.fired.add(sessionId);
      onFire();
    }, ms);
    this.timers.set(visitorId, handle);
  }

  cancel(visitorId: string): void {
    const handle = this.timers.get(visitorId);
    if (handle) {
      clearTimeout(handle);
      this.timers.delete(visitorId);
    }
  }

  hasFired(sessionId: string): boolean {
    return this.fired.has(sessionId);
  }

  clearForSession(sessionId: string): void {
    this.fired.delete(sessionId);
  }

  size(): number {
    return this.timers.size;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npx vitest run tests/timers/warmVisitor.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/alexa/code/tidio-remake
git add server/src/timers/warmVisitor.ts server/tests/timers/warmVisitor.test.ts
git commit -m "warm-alert: WarmVisitorTimers module + unit tests"
```

---

## Task 2: Wire WarmVisitorTimers into ServerDeps and bootstrap

**Files:**
- Modify: `server/src/server.ts` (around the `ServerDeps` type and `createServer` defaults)
- Modify: `server/src/index.ts` (bootstrap)
- Modify: `server/tests/server.smoke.test.ts` (verify auto-construct path)

- [ ] **Step 1: Write the failing smoke test**

Add this test to `server/tests/server.smoke.test.ts` inside the existing `describe('http server', ...)` block (after the existing tests):

```typescript
  it('createServer auto-constructs a WarmVisitorTimers when not provided', async () => {
    // The server smoke test already constructs the server without a warmTimers.
    // We verify it exposes one indirectly via behavior (no crash on hello path).
    // A direct way: import the deps shape — but the smoke test treats db/ls as opaque,
    // so we just confirm the server is up. Detailed wiring is exercised in Task 7.
    const res = await new Promise<any>((resolve) => {
      const req = request({ host: '127.0.0.1', port, path: '/health' }, resolve);
      req.end();
    });
    expect(res.statusCode).toBe(200);
  });
```

(This is a sanity check — the real value comes from the type-system requiring `warmTimers` in `ServerDeps`. Step 3 below adds the field as required-with-auto-default in the same `createServer` pattern as `timers` and `oc`, which the smoke test already exercises.)

- [ ] **Step 2: Run the smoke test to verify it still passes (baseline)**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npx vitest run tests/server.smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Modify `server/src/server.ts`**

Add `WarmVisitorTimers` to `ServerDeps` and auto-construct when not provided. Locate the existing `ServerDeps`/`ServerDepsInput` types and `createServer` (lines 25–34) and replace:

```typescript
import type { DB } from './db/client.js';
import type { LiveSessions } from './live/sessions.js';
import type { Env } from './env.js';
import { logger } from './logger.js';
import { handleVisitorConnection } from './ws/visitor.js';
import { authenticateOperatorUpgrade, handleOperatorConnection } from './ws/operator.js';
import { PhaseTransitionTimers } from './timers/phaseTransition.js';
import { WarmVisitorTimers } from './timers/warmVisitor.js';
import { OperatorClients } from './live/operatorClients.js';
```

(Add the `WarmVisitorTimers` import; keep all other imports.)

Then update the types:

```typescript
export type ServerDeps = {
  db: DB;
  ls: LiveSessions;
  env: Env;
  timers: PhaseTransitionTimers;
  oc: OperatorClients;
  warmTimers: WarmVisitorTimers;
};

export type ServerDepsInput = Omit<ServerDeps, 'timers' | 'oc' | 'warmTimers'> & {
  timers?: PhaseTransitionTimers;
  oc?: OperatorClients;
  warmTimers?: WarmVisitorTimers;
};
```

And update `createServer`'s default block:

```typescript
export function createServer(input: ServerDepsInput): Server {
  const deps: ServerDeps = {
    ...input,
    timers: input.timers ?? new PhaseTransitionTimers(),
    oc: input.oc ?? new OperatorClients(),
    warmTimers: input.warmTimers ?? new WarmVisitorTimers(),
  };
  // ... rest unchanged
```

- [ ] **Step 4: Modify `server/src/index.ts`**

Add the import and instantiate:

```typescript
import { loadEnv } from './env.js';
import { openDb } from './db/client.js';
import { migrate } from './db/migrate.js';
import { LiveSessions } from './live/sessions.js';
import { PhaseTransitionTimers } from './timers/phaseTransition.js';
import { WarmVisitorTimers } from './timers/warmVisitor.js';
import { createServer } from './server.js';
import { logger } from './logger.js';
import { loadGeoDb } from './geo/lookup.js';

const env = loadEnv();
await loadGeoDb(env.GEOIP_DB_PATH || null);
const db = openDb(env.DATABASE_PATH);
migrate(db);
const ls = new LiveSessions();
const timers = new PhaseTransitionTimers();
const warmTimers = new WarmVisitorTimers();
const server = createServer({ db, ls, timers, warmTimers, env });
server.listen(env.PORT, () => logger.info({ port: env.PORT }, 'tidio-remake server up'));
```

- [ ] **Step 5: Run all server tests to verify nothing broke**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npm test`
Expected: PASS — 136+ tests (existing 135 + the new 9 from Task 1 = 144). The new smoke-test assertion adds 1 = 145.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/alexa/code/tidio-remake
git add server/src/server.ts server/src/index.ts server/tests/server.smoke.test.ts
git commit -m "warm-alert: wire WarmVisitorTimers into ServerDeps + bootstrap"
```

---

## Task 3: Visitor `hello` hook — start timer when score > 0

**Files:**
- Modify: `server/src/ws/visitor.ts` (hello handler, after lead-score recompute and before the `welcome` send)
- Test: `server/tests/ws/warmVisitorAlert.test.ts` (new file)

- [ ] **Step 1: Write the failing integration test**

```typescript
// server/tests/ws/warmVisitorAlert.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { OperatorClients } from '../../src/live/operatorClients.js';
import { WarmVisitorTimers } from '../../src/timers/warmVisitor.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';

let server: any;
let port: number;
let db: any;
let ls: LiveSessions;
let oc: OperatorClients;
let warmTimers: WarmVisitorTimers;
let startSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  db = makeTestDb('warm-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  oc = new OperatorClients();
  warmTimers = new WarmVisitorTimers();
  startSpy = vi.spyOn(warmTimers, 'start');
  server = createServer({
    db, ls, oc, warmTimers,
    env: { VISITOR_COOKIE_SECRET: 'a'.repeat(64) } as any,
  });
  await new Promise<void>((r) => server.listen(0, () => r()));
  port = server.address().port;
});

afterEach(() => {
  startSpy.mockRestore();
  server.close();
});

async function helloAndWaitForWelcome(ws: WebSocket, payload: any): Promise<any> {
  ws.send(JSON.stringify(payload));
  return new Promise((r) => ws.on('message', (m) => r(JSON.parse(m.toString()))));
}

describe('warm-visitor alert: hello hook', () => {
  it('starts the timer on hello when initial lead score > 0 (gclid → google_ads_click +3)', async () => {
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWaitForWelcome(ws, {
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/index.html', title: 'Home' },
      utms: { gclid: 'abc' }, referrer: null, userAgent: 'Mozilla/5.0',
    });
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(startSpy).toHaveBeenCalledWith(visitorId, sessionId, 90_000, expect.any(Function));
    ws.close();
  });

  it('does NOT start the timer on hello when score = 0 (no auto signals)', async () => {
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWaitForWelcome(ws, {
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/about', title: 'About' },
      utms: {}, referrer: null, userAgent: 'Mozilla/5.0',
    });
    expect(startSpy).not.toHaveBeenCalled();
    ws.close();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npx vitest run tests/ws/warmVisitorAlert.test.ts`
Expected: FAIL — `expect(startSpy).toHaveBeenCalledTimes(1)` got 0.

- [ ] **Step 3: Modify `server/src/ws/visitor.ts` hello handler**

Add the import at the top of the file (alongside other imports):

```typescript
import { WARM_VISITOR_DWELL_MS } from '../timers/warmVisitor.js';
```

Inside the `case 'hello':` block, immediately AFTER the existing `if (totalDelta > 0) { ... }` block (around line 106) and BEFORE the `const op = operators.findById(1);` line, insert:

```typescript
        // Warm-visitor alert: start the dwell timer if this session is already
        // showing buying intent (score > 0) and there's no open conversation.
        const currentScore = sessions.findById(msg.sessionId)?.current_lead_score ?? 0;
        const cutoffWarm = now - 30 * 24 * 60 * 60 * 1000;
        const existingConvForWarm = conversations.findOpenForVisitor(msg.visitorId, cutoffWarm);
        if (currentScore > 0 && !existingConvForWarm) {
          deps.warmTimers.start(msg.visitorId, msg.sessionId, WARM_VISITOR_DWELL_MS, () => {
            // onFire body wired in Task 7
          });
        }
```

(Task 7 will fill in the onFire body. For now we only need the call to register.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npx vitest run tests/ws/warmVisitorAlert.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Run all server tests**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npm test`
Expected: PASS, all green.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/alexa/code/tidio-remake
git add server/src/ws/visitor.ts server/tests/ws/warmVisitorAlert.test.ts
git commit -m "warm-alert: start timer on hello when score > 0"
```

---

## Task 4: Visitor `lead_signal` hook — start timer when score crosses 0 → positive

**Files:**
- Modify: `server/src/ws/visitor.ts` (`lead_signal` case)
- Modify: `server/tests/ws/warmVisitorAlert.test.ts` (add test)

- [ ] **Step 1: Write the failing test**

Append to the existing `describe('warm-visitor alert: hello hook', ...)` block in `server/tests/ws/warmVisitorAlert.test.ts`, OR add a new describe — either is fine. Append:

```typescript
describe('warm-visitor alert: lead_signal hook', () => {
  it('starts the timer when a lead_signal pushes score from 0 to positive', async () => {
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWaitForWelcome(ws, {
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/about', title: 'About' },
      utms: {}, referrer: null, userAgent: 'Mozilla/5.0',
    });
    expect(startSpy).not.toHaveBeenCalled();
    // Send a lead signal whose kind has positive score in compute.ts:
    ws.send(JSON.stringify({ type: 'lead_signal', kind: 'pricing_page_view', payload: null }));
    // Allow event-loop turn for the message to be processed
    await new Promise((r) => setTimeout(r, 50));
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(startSpy).toHaveBeenCalledWith(visitorId, sessionId, 90_000, expect.any(Function));
    ws.close();
  });

  it('does NOT start the timer for a lead_signal with zero delta', async () => {
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWaitForWelcome(ws, {
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/about', title: 'About' },
      utms: {}, referrer: null, userAgent: 'Mozilla/5.0',
    });
    ws.send(JSON.stringify({ type: 'lead_signal', kind: 'unknown_signal', payload: null }));
    await new Promise((r) => setTimeout(r, 50));
    expect(startSpy).not.toHaveBeenCalled();
    ws.close();
  });
});
```

(Pick `pricing_page_view` because it's a known signal kind in `server/src/leadScore/compute.ts` with a positive delta. `unknown_signal` returns 0.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npx vitest run tests/ws/warmVisitorAlert.test.ts`
Expected: FAIL on the "starts the timer when a lead_signal" test — `expect(startSpy).toHaveBeenCalledTimes(1)` got 0.

- [ ] **Step 3: Modify `server/src/ws/visitor.ts` lead_signal handler**

In the `case 'lead_signal':` block, find the section where `prevScore` and `cur` are computed (currently around lines 162–164). After the `deps.oc.broadcastTo(...)` line that emits `visitor_updated`, but before the `if (prevScore < 8 && cur >= 8)` high-priority check, add:

```typescript
          // Warm-visitor alert: start dwell timer when score newly becomes positive.
          if (prevScore === 0 && cur > 0) {
            const cutoffWarm = Date.now() - 30 * 24 * 60 * 60 * 1000;
            const existingConvForWarm = conversations.findOpenForVisitor(state.visitorId, cutoffWarm);
            if (!existingConvForWarm) {
              deps.warmTimers.start(state.visitorId, state.sessionId, WARM_VISITOR_DWELL_MS, () => {
                // onFire body wired in Task 7
              });
            }
          }
```

(`state.visitorId` and `state.sessionId` are guaranteed defined here by the early `if (!state.sessionId || !state.visitorId) break;` guard at the top of the case.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npx vitest run tests/ws/warmVisitorAlert.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/alexa/code/tidio-remake
git add server/src/ws/visitor.ts server/tests/ws/warmVisitorAlert.test.ts
git commit -m "warm-alert: start timer when lead_signal raises score from 0"
```

---

## Task 5: Visitor cancel hooks — chat_open, chat_message, ws close

**Files:**
- Modify: `server/src/ws/visitor.ts` (`chat_open`, `chat_message`, ws close)
- Modify: `server/tests/ws/warmVisitorAlert.test.ts` (add three cancel tests)

- [ ] **Step 1: Write the failing tests**

Append to `server/tests/ws/warmVisitorAlert.test.ts`:

```typescript
describe('warm-visitor alert: cancel hooks', () => {
  let cancelSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    cancelSpy = vi.spyOn(warmTimers, 'cancel');
  });
  afterEach(() => cancelSpy.mockRestore());

  async function helloWithGclid(ws: WebSocket, visitorId: string, sessionId: string) {
    ws.send(JSON.stringify({
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/', title: 'Home' },
      utms: { gclid: 'x' }, referrer: null, userAgent: 'Mozilla/5.0',
    }));
    await new Promise((r) => ws.on('message', (m) => r(JSON.parse(m.toString()))));
  }

  it('cancels the timer on chat_open', async () => {
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloWithGclid(ws, visitorId, sessionId);
    expect(startSpy).toHaveBeenCalledTimes(1);
    ws.send(JSON.stringify({ type: 'chat_open' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(cancelSpy).toHaveBeenCalledWith(visitorId);
    ws.close();
  });

  it('cancels the timer on the visitor first chat_message', async () => {
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloWithGclid(ws, visitorId, sessionId);
    ws.send(JSON.stringify({ type: 'chat_message', body: 'Hi there' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(cancelSpy).toHaveBeenCalledWith(visitorId);
    ws.close();
  });

  it('cancels the timer on ws close', async () => {
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloWithGclid(ws, visitorId, sessionId);
    ws.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(cancelSpy).toHaveBeenCalledWith(visitorId);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npx vitest run tests/ws/warmVisitorAlert.test.ts`
Expected: FAIL — three new tests fail because `cancel` is never called yet.

- [ ] **Step 3: Modify `server/src/ws/visitor.ts`**

3a. **`case 'chat_open':`** — at the END of the handler (after the existing logic), add:

```typescript
        deps.warmTimers.cancel(state.visitorId);
```

3b. **`case 'chat_message':`** — at the very TOP of the case (right after the `if (!state.visitorId || !state.sessionId) break;` guard), add:

```typescript
        deps.warmTimers.cancel(state.visitorId);
```

3c. **`ws.on('close', ...)` block at the bottom** — extend it:

```typescript
  ws.on('close', () => {
    if (state.visitorId) {
      deps.warmTimers.cancel(state.visitorId);
      if (state.sessionId) deps.warmTimers.clearForSession(state.sessionId);
      deps.ls.remove(state.visitorId, ws);
      logger.debug({ visitorId: state.visitorId }, 'visitor ws closed');
      deps.oc.broadcastTo(1, { type: 'visitor_left', visitorId: state.visitorId });
    }
  });
```

(`clearForSession` resets the "fired" flag for this session — only relevant if the timer fired but we want a clean slate on disconnect. The cancel is the load-bearing part.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npx vitest run tests/ws/warmVisitorAlert.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/alexa/code/tidio-remake
git add server/src/ws/visitor.ts server/tests/ws/warmVisitorAlert.test.ts
git commit -m "warm-alert: cancel timer on chat_open, chat_message, ws close"
```

---

## Task 6: Operator `open_chat` cancel

**Files:**
- Modify: `server/src/ws/operator.ts` (`open_chat` case)
- Modify: `server/tests/ws/warmVisitorAlert.test.ts` (add test)

- [ ] **Step 1: Write the failing test**

Append to `server/tests/ws/warmVisitorAlert.test.ts`. This test needs an operator WS client; mirror the pattern from `tests/ws/operatorOpenChat.test.ts`:

```typescript
describe('warm-visitor alert: operator open_chat cancel', () => {
  it('cancels the timer when operator opens a chat with a warm visitor', async () => {
    // Seed the DB with operator id=1 + a token so we can connect as operator.
    const tokenRepo = new (await import('../../src/repositories/operatorTokens.js')).OperatorTokensRepo(db);
    const opsRepo = new (await import('../../src/repositories/operators.js')).OperatorsRepo(db);
    opsRepo.create({ id: 1, email: 'a@b', password_hash: 'x', display_name: 'A', status: 'online' } as any);
    const token = 'tok_' + Math.random().toString(36).slice(2);
    tokenRepo.insert(token, 1, Date.now() + 60_000);

    const cancelSpy = vi.spyOn(warmTimers, 'cancel');

    // Visitor connects + triggers warm timer
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const vws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => vws.on('open', () => r()));
    vws.send(JSON.stringify({
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/', title: 'H' },
      utms: { gclid: 'x' }, referrer: null, userAgent: 'Mozilla/5.0',
    }));
    await new Promise((r) => vws.on('message', (m) => r(JSON.parse(m.toString()))));

    // Operator connects and opens chat for this visitor
    const ows = new WebSocket(`ws://127.0.0.1:${port}/ws/operator?token=${token}`);
    await new Promise<void>((r) => ows.on('open', () => r()));
    ows.send(JSON.stringify({ type: 'subscribe' }));
    await new Promise((r) => setTimeout(r, 50));
    ows.send(JSON.stringify({ type: 'open_chat', visitorId }));
    await new Promise((r) => setTimeout(r, 100));

    expect(cancelSpy).toHaveBeenCalledWith(visitorId);
    cancelSpy.mockRestore();
    vws.close();
    ows.close();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npx vitest run tests/ws/warmVisitorAlert.test.ts`
Expected: FAIL on the new test.

- [ ] **Step 3: Modify `server/src/ws/operator.ts`**

In the `case 'open_chat':` block, after the existing logic (after a conversation has been ensured for the visitor and the operator is wired in), add:

```typescript
        deps.warmTimers.cancel(msg.visitorId);
```

(The exact position: at the end of the `case 'open_chat':` block, just before `break;`. If the block is small, add it as the last statement.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npx vitest run tests/ws/warmVisitorAlert.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/alexa/code/tidio-remake
git add server/src/ws/operator.ts server/tests/ws/warmVisitorAlert.test.ts
git commit -m "warm-alert: cancel timer when operator open_chat"
```

---

## Task 7: Fire callback — emit `warm_visitor_alert` + push notification

**Files:**
- Modify: `server/src/ws/visitor.ts` (replace the two empty `() => { /* onFire wired in Task 7 */ }` callbacks with the real one; add a helper)
- Modify: `server/tests/ws/warmVisitorAlert.test.ts` (add fake-timer end-to-end test)

- [ ] **Step 1: Write the failing test**

Real WebSocket sockets don't play nicely with `vi.useFakeTimers`, so we shorten the dwell via an env var. Append to `server/tests/ws/warmVisitorAlert.test.ts`:

```typescript
describe('warm-visitor alert: fire path', () => {
  beforeEach(() => {
    process.env.TEST_WARM_VISITOR_DWELL_MS = '50';
  });
  afterEach(() => {
    delete process.env.TEST_WARM_VISITOR_DWELL_MS;
  });

  it('emits warm_visitor_alert + calls pushToOperator after dwell elapses', async () => {
    const dispatcher = await import('../../src/push/dispatcher.js');
    const pushSpy = vi.spyOn(dispatcher, 'pushToOperator').mockResolvedValue(undefined);

    const opsRepo = new (await import('../../src/repositories/operators.js')).OperatorsRepo(db);
    opsRepo.create({ id: 1, email: 'a@b', password_hash: 'x', display_name: 'A', status: 'online' } as any);

    const tokenRepo = new (await import('../../src/repositories/operatorTokens.js')).OperatorTokensRepo(db);
    const token = 'tok_' + Math.random().toString(36).slice(2);
    tokenRepo.insert(token, 1, Date.now() + 60_000);

    const seenAlerts: any[] = [];
    const ows = new WebSocket(`ws://127.0.0.1:${port}/ws/operator?token=${token}`);
    await new Promise<void>((r) => ows.on('open', () => r()));
    ows.send(JSON.stringify({ type: 'subscribe' }));
    ows.on('message', (m) => {
      const parsed = JSON.parse(m.toString());
      if (parsed.type === 'warm_visitor_alert') seenAlerts.push(parsed);
    });
    await new Promise((r) => setTimeout(r, 50));

    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const vws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => vws.on('open', () => r()));
    vws.send(JSON.stringify({
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/lp/start-your-1031', title: 'Start' },
      utms: { gclid: 'x' }, referrer: null, userAgent: 'Mozilla/5.0',
    }));
    await new Promise((r) => vws.on('message', (m) => r(JSON.parse(m.toString()))));

    // Wait > 50ms for the timer to fire
    await new Promise((r) => setTimeout(r, 200));

    expect(seenAlerts).toHaveLength(1);
    expect(seenAlerts[0]).toMatchObject({
      type: 'warm_visitor_alert',
      visitorId,
      sessionId,
      reason: 'warm_dwell_90s',
    });
    expect(seenAlerts[0].leadScore).toBeGreaterThan(0);
    expect(seenAlerts[0].page).toContain('/lp/start-your-1031');

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0][1]).toBe(1); // operatorId
    expect(pushSpy.mock.calls[0][2]).toMatchObject({
      title: 'Warm visitor on site',
      url: `/console/?ping=${visitorId}`,
    });

    pushSpy.mockRestore();
    vws.close();
    ows.close();
  }, 5000);
});
```

The visitor handler reads `process.env.TEST_WARM_VISITOR_DWELL_MS` at hook-call time (Step 3), so this `beforeEach` set runs before any visitor connects in this `describe` block — no constructor ordering required.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npx vitest run tests/ws/warmVisitorAlert.test.ts -t "fire path"`
Expected: FAIL — `seenAlerts` is empty (no event emitted yet) and `pushSpy` not called.

- [ ] **Step 3: Modify `server/src/ws/visitor.ts`**

3a. Add a helper near the top of the file (after imports, before `handleVisitorConnection`):

```typescript
function dwellMsForEnv(): number {
  const override = process.env.TEST_WARM_VISITOR_DWELL_MS;
  if (override && /^\d+$/.test(override)) return Number(override);
  return WARM_VISITOR_DWELL_MS;
}

function pathOf(url: string): string {
  try { return new URL(url).pathname; } catch { return url; }
}
```

3b. Add a private function `buildWarmVisitorOnFire` near the top of the function body of `handleVisitorConnection` (or above it as a free function — free function is cleaner because we can access `deps` via closure capture):

Inside `handleVisitorConnection`, after the existing repo instances, add:

```typescript
  function fireWarmVisitorAlert(visitorId: string, sessionId: string, currentPageUrl: string): void {
    const session = sessions.findById(sessionId);
    const leadScore = session?.current_lead_score ?? 0;
    const dwellMs = dwellMsForEnv();
    const page = currentPageUrl;
    const alert = {
      type: 'warm_visitor_alert' as const,
      visitorId,
      sessionId,
      leadScore,
      page,
      dwellMs,
      reason: 'warm_dwell_90s' as const,
    };
    deps.oc.broadcastTo(1, alert);
    pushDispatcher
      .pushToOperator(deps, 1, {
        title: 'Warm visitor on site',
        body: `${pathOf(page)} · score ${leadScore}, here ${Math.round(dwellMs / 1000)}s`,
        url: `/console/?ping=${visitorId}`,
      })
      .catch((err) => logger.warn({ err }, 'warm-visitor push failed'));
  }
```

3c. Replace the two empty `() => { /* onFire wired in Task 7 */ }` callbacks (one in the `hello` handler, one in `lead_signal`) with calls to `fireWarmVisitorAlert`. The hello-side call passes the URL from `msg.page.url`; the lead_signal-side call reads the latest URL from `deps.ls.get(state.visitorId)?.currentPage.url`:

In `case 'hello':`, replace:
```typescript
          deps.warmTimers.start(msg.visitorId, msg.sessionId, WARM_VISITOR_DWELL_MS, () => {
            // onFire body wired in Task 7
          });
```
with:
```typescript
          deps.warmTimers.start(msg.visitorId, msg.sessionId, dwellMsForEnv(), () => {
            fireWarmVisitorAlert(msg.visitorId, msg.sessionId, msg.page.url);
          });
```

In `case 'lead_signal':`, replace:
```typescript
              deps.warmTimers.start(state.visitorId, state.sessionId, WARM_VISITOR_DWELL_MS, () => {
                // onFire body wired in Task 7
              });
```
with:
```typescript
              const currentUrlForWarm = deps.ls.get(state.visitorId)?.currentPage.url ?? '';
              const sId = state.sessionId;
              const vId = state.visitorId;
              deps.warmTimers.start(vId, sId, dwellMsForEnv(), () => {
                fireWarmVisitorAlert(vId, sId, currentUrlForWarm);
              });
```

(The locals capture the values at start-time so the closure isn't sensitive to later mutations of `state`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npx vitest run tests/ws/warmVisitorAlert.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Run all server tests**

Run: `cd C:\Users\alexa\code\tidio-remake\server && npm test`
Expected: PASS, all green.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/alexa/code/tidio-remake
git add server/src/ws/visitor.ts server/tests/ws/warmVisitorAlert.test.ts
git commit -m "warm-alert: fire emits warm_visitor_alert event + push payload"
```

---

## Task 8: Console reducer — handle `warm_visitor_alert`

**Files:**
- Modify: `console/src/state/reducers.ts` (add new case)
- Modify: `console/tests/state/reducers.test.ts` (add tests)

- [ ] **Step 1: Write the failing test**

Append to `console/tests/state/reducers.test.ts`, inside the existing `describe('reducers', ...)` block:

```typescript
  it('warm_visitor_alert appends an entry to pendingAlerts with reason "warm_visitor"', () => {
    pendingAlerts.value = [];
    applyWsMessage({
      type: 'warm_visitor_alert',
      visitorId: 'v_warm12345678',
      sessionId: 's_xyz123456789',
      leadScore: 4,
      page: 'https://simple1031x.com/pricing',
      dwellMs: 90_000,
      reason: 'warm_dwell_90s',
    });
    expect(pendingAlerts.value).toHaveLength(1);
    expect(pendingAlerts.value[0]).toMatchObject({
      visitorId: 'v_warm12345678',
      reason: 'warm_visitor',
    });
  });

  it('warm_visitor_alert does not clobber existing alerts', () => {
    pendingAlerts.value = [{ visitorId: 'v_old', reason: 'lead_score_8', timestamp: 1 }];
    applyWsMessage({
      type: 'warm_visitor_alert',
      visitorId: 'v_new12345678',
      sessionId: 's_z',
      leadScore: 3,
      page: '/x',
      dwellMs: 90_000,
      reason: 'warm_dwell_90s',
    });
    expect(pendingAlerts.value).toHaveLength(2);
    expect(pendingAlerts.value[0].visitorId).toBe('v_old');
    expect(pendingAlerts.value[1].visitorId).toBe('v_new12345678');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\Users\alexa\code\tidio-remake\console && npx vitest run tests/state/reducers.test.ts`
Expected: FAIL — `pendingAlerts.value` length is 0 because the reducer ignores unknown event types.

- [ ] **Step 3: Modify `console/src/state/reducers.ts`**

Add a new case alongside the existing `'high_priority_alert'` case (currently around line 90):

```typescript
    case 'warm_visitor_alert': {
      pendingAlerts.value = [
        ...pendingAlerts.value,
        { visitorId: msg.visitorId, reason: 'warm_visitor', timestamp: Date.now() },
      ];
      break;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\Users\alexa\code\tidio-remake\console && npx vitest run tests/state/reducers.test.ts`
Expected: PASS, all reducer tests green.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/alexa/code/tidio-remake
git add console/src/state/reducers.ts console/tests/state/reducers.test.ts
git commit -m "warm-alert: console reducer handles warm_visitor_alert"
```

---

## Task 9: Console Toast — reason-driven label/tint + ping click for warm

**Files:**
- Modify: `console/src/components/Toast.tsx`
- Create: `console/tests/components/Toast.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// console/tests/components/Toast.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { Toast } from '../../src/components/Toast.js';
import {
  pendingAlerts, pendingPing, liveVisitors, conversations, selectedConversationId,
} from '../../src/state/store.js';

beforeEach(() => {
  pendingAlerts.value = [];
  pendingPing.value = null;
  liveVisitors.value = {};
  conversations.value = {};
  selectedConversationId.value = null;
  cleanup();
});

function makeVisitor(id: string) {
  return {
    visitorId: id, activeSessionId: 's', lastSeenAt: 1,
    currentPage: { url: '/pricing', title: 'P', enteredAt: 1 },
    scrollPct: 0, leadScore: 4, isHot: false, isTyping: false, socketCount: 1,
  };
}

describe('Toast', () => {
  it('renders nothing when no alerts', () => {
    const { container } = render(<Toast />);
    expect(container.textContent).toBe('');
  });

  it('renders "Hot lead" with orange tint for lead_score_8', () => {
    liveVisitors.value = { v_a: makeVisitor('v_a') };
    pendingAlerts.value = [{ visitorId: 'v_a', reason: 'lead_score_8', timestamp: 1 }];
    const { container, getByRole } = render(<Toast />);
    expect(container.textContent).toContain('Hot lead');
    expect(getByRole('alert').className).toMatch(/bg-orange/);
  });

  it('renders "Warm visitor" with blue tint for warm_visitor', () => {
    liveVisitors.value = { v_a: makeVisitor('v_a') };
    pendingAlerts.value = [{ visitorId: 'v_a', reason: 'warm_visitor', timestamp: 1 }];
    const { container, getByRole } = render(<Toast />);
    expect(container.textContent).toContain('Warm visitor');
    expect(getByRole('alert').className).toMatch(/bg-blue/);
  });

  it('clicking a warm_visitor toast (no conversation) sets pendingPing', () => {
    liveVisitors.value = { v_a: makeVisitor('v_a') };
    pendingAlerts.value = [{ visitorId: 'v_a', reason: 'warm_visitor', timestamp: 1 }];
    const { getByRole } = render(<Toast />);
    fireEvent.click(getByRole('alert'));
    expect(pendingPing.value).toBe('v_a');
    expect(selectedConversationId.value).toBeNull();
  });

  it('clicking a lead_score_8 toast with an existing conversation selects it', () => {
    liveVisitors.value = { v_a: makeVisitor('v_a') };
    conversations.value = {
      c_1: {
        id: 'c_1', visitor_id: 'v_a', opened_session_id: null,
        status: 'live', opened_at: 1, closed_at: null, last_message_at: 1,
        initiated_by: 'visitor', timeout_capture: null, messages: [],
      },
    };
    pendingAlerts.value = [{ visitorId: 'v_a', reason: 'lead_score_8', timestamp: 1 }];
    const { getByRole } = render(<Toast />);
    fireEvent.click(getByRole('alert'));
    expect(selectedConversationId.value).toBe('c_1');
    expect(pendingPing.value).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\Users\alexa\code\tidio-remake\console && npx vitest run tests/components/Toast.test.tsx`
Expected: FAIL — current Toast hardcodes "Hot lead" and never sets pendingPing.

- [ ] **Step 3: Modify `console/src/components/Toast.tsx`**

Replace the entire file with:

```typescript
import { useEffect } from 'preact/hooks';
import { pendingAlerts, pendingPing, liveVisitors, conversations, selectedConversationId } from '../state/store.js';

type AlertStyle = { label: string; bg: string };

function styleFor(reason: string): AlertStyle {
  switch (reason) {
    case 'lead_score_8': return { label: 'Hot lead', bg: 'bg-orange-500 hover:bg-orange-600' };
    case 'warm_visitor': return { label: 'Warm visitor', bg: 'bg-blue-500 hover:bg-blue-600' };
    default: return { label: 'Alert', bg: 'bg-slate-500 hover:bg-slate-600' };
  }
}

export function Toast() {
  const alerts = pendingAlerts.value;

  useEffect(() => {
    if (alerts.length === 0) return;
    const t = setTimeout(() => {
      pendingAlerts.value = pendingAlerts.value.slice(1);
    }, 8000);
    return () => clearTimeout(t);
  }, [alerts.length]);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {alerts.map((a) => {
        const v = liveVisitors.value[a.visitorId];
        const { label, bg } = styleFor(a.reason);
        return (
          <div
            key={a.visitorId + a.timestamp}
            role="alert"
            className={`${bg} text-white p-4 rounded shadow-lg max-w-xs cursor-pointer`}
            onClick={() => {
              const conv = Object.values(conversations.value).find((c: any) => c.visitor_id === a.visitorId);
              if (conv) {
                selectedConversationId.value = (conv as any).id;
              } else {
                pendingPing.value = a.visitorId;
              }
              pendingAlerts.value = pendingAlerts.value.filter((x) => x !== a);
            }}
          >
            <div className="text-xs font-bold uppercase">{label}</div>
            <div className="text-sm mt-1">
              {v ? `${v.name ?? 'Anonymous'} on ${v.currentPage.url}` : a.visitorId}
            </div>
            <div className="text-xs opacity-80 mt-1">{a.reason}</div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\Users\alexa\code\tidio-remake\console && npx vitest run tests/components/Toast.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run all console tests**

Run: `cd C:\Users\alexa\code\tidio-remake\console && npm test`
Expected: PASS, all green.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/alexa/code/tidio-remake
git add console/src/components/Toast.tsx console/tests/components/Toast.test.tsx
git commit -m "warm-alert: Toast renders warm vs hot distinctly; ping click for warm"
```

---

## Task 10: Console `main.tsx` — `?ping=<visitorId>` URL deep-link

**Files:**
- Modify: `console/src/main.tsx`
- Create: `console/tests/main.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// console/tests/main.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { applyPingUrlParam } from '../src/main.js';
import { pendingPing } from '../src/state/store.js';

beforeEach(() => {
  pendingPing.value = null;
  // Reset history between tests
  history.replaceState(null, '', '/console/');
});

describe('applyPingUrlParam', () => {
  it('reads ?ping=<visitorId> and sets pendingPing', () => {
    history.replaceState(null, '', '/console/?ping=v_abcdef123456');
    applyPingUrlParam();
    expect(pendingPing.value).toBe('v_abcdef123456');
  });

  it('strips the ping param from the URL after reading', () => {
    history.replaceState(null, '', '/console/?ping=v_abcdef123456&other=keep');
    applyPingUrlParam();
    expect(window.location.search).not.toContain('ping=');
    expect(window.location.search).toContain('other=keep');
  });

  it('is a no-op when no ping param is present', () => {
    history.replaceState(null, '', '/console/');
    applyPingUrlParam();
    expect(pendingPing.value).toBeNull();
  });

  it('rejects malformed visitorIds', () => {
    history.replaceState(null, '', '/console/?ping=not-a-real-id');
    applyPingUrlParam();
    expect(pendingPing.value).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd C:\Users\alexa\code\tidio-remake\console && npx vitest run tests/main.test.tsx`
Expected: FAIL — `applyPingUrlParam` is not exported.

- [ ] **Step 3: Modify `console/src/main.tsx`**

Replace the file with:

```typescript
import { render } from 'preact';
import { App } from './App.js';
import { pendingPing } from './state/store.js';
import './styles.css';

export const CONSOLE_VERSION = '0.1.0';

const VISITOR_ID_RE = /^v_[0-9a-f]{12}$/;

/**
 * Read `?ping=<visitorId>` from the URL and seed `pendingPing` so the
 * PingModal opens. Service-worker push notifications use this URL form to
 * deep-link the operator to a specific visitor.
 *
 * Strips the param from the URL after consuming it so a manual reload
 * doesn't keep re-triggering the modal.
 *
 * Exported for tests.
 */
export function applyPingUrlParam(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const ping = url.searchParams.get('ping');
  if (!ping) return;
  if (VISITOR_ID_RE.test(ping)) {
    pendingPing.value = ping;
  }
  url.searchParams.delete('ping');
  history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/console/sw.js').catch(() => {});
  });
}

applyPingUrlParam();

const root = document.getElementById('app');
if (root) render(<App />, root);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\Users\alexa\code\tidio-remake\console && npx vitest run tests/main.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run all console tests**

Run: `cd C:\Users\alexa\code\tidio-remake\console && npm test`
Expected: PASS, all green.

- [ ] **Step 6: Build all packages to verify nothing is broken at the bundler level**

Run: `cd /c/Users/alexa/code/tidio-remake/server && npm run build && cd ../console && npm run build && cd ../widget && npm run build`
Expected: all three builds clean.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/alexa/code/tidio-remake
git add console/src/main.tsx console/tests/main.test.tsx
git commit -m "warm-alert: main.tsx reads ?ping= URL param to deep-link PingModal"
```

---

## Final integration checks (after all tasks)

After Task 10 completes:

- Run `cd /c/Users/alexa/code/tidio-remake/server && npm test` — expect ≥ 145 tests green
- Run `cd /c/Users/alexa/code/tidio-remake/console && npm test` — expect ≥ 109 tests green
- Run `cd /c/Users/alexa/code/tidio-remake/widget && npm test` — expect 14 tests green (unchanged)
- All three `npm run build` succeed
- Push the branch and open a PR

These are not numbered tasks because they're verification, not implementation work.
