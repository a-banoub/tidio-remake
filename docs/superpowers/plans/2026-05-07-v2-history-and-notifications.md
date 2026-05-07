# Tidio Remake v2 — History, Notifications, Quick Replies — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v2 of the Simple 1031 chat console — closed-conversation history view (A), every-visitor + every-message notifications with reliable desktop audio (B), and operator-managed quick-reply CRUD (C).

**Architecture:** Build on top of v1.6 WIP (currently uncommitted on `v1.5-mobile-widget`). Server adds visitor-arrival push fan-out + push-diagnostics columns + closed-conversation snapshot enrichment. Console adds a `closedConversations` signal + history view in MiddlePane + a Settings page wired to the existing `/api/operator/quick-replies` REST.

**Tech Stack:** Node 20 + Express + `ws` + `better-sqlite3` (server). Preact + Vite + Tailwind + `@preact/signals` (console). Vitest everywhere. esbuild for server bundling.

**Spec:** `docs/spec-v2-design.md`

---

## Task 1: Branch hygiene — checkpoint v1.6 WIP onto a fresh v2 branch

The current local checkout is on `v1.5-mobile-widget` with 35 modified files + 6 untracked, and that branch is behind origin/main by 1 (the merge commit). We need a clean v2 branch with the WIP committed before adding new work.

**Files:**
- No code changes; git plumbing only

- [ ] **Step 1: Confirm current state**

```bash
cd ~/code/tidio-remake
git status -sb
git log --oneline -3
git fetch origin main
git rev-list --left-right --count origin/main...HEAD
```

Expected: status shows ~35 modified + untracked, log shows v1.5 commits, count shows `1 0` (origin/main is 1 ahead, which is the v1.5 merge).

- [ ] **Step 2: Stash the WIP, switch to main, branch off**

```bash
git stash push -u -m "v1.6 wip 2026-05-07"
git checkout main
git pull origin main
git checkout -b v2-history-and-notifications
git stash pop
```

Expected: clean main checkout, new branch created, WIP files reapplied. Resolve any conflicts (none expected since nothing changed on main since branch).

- [ ] **Step 3: Verify all WIP tests still pass on the new branch**

```bash
cd server && npm ci && npm test
cd ../console && npm ci && npm test
cd ../widget && npm ci && npm test
```

Expected: all green. If any test fails, fix or revert the offending WIP hunk before proceeding.

- [ ] **Step 4: Commit the WIP as a single checkpoint**

```bash
git add server/src/api/closedConversations.ts \
        server/src/db/migrations/002-add-dwell-tracking.sql \
        server/src/repositories/conversations.ts \
        server/src/repositories/sessions.ts \
        server/src/server.ts \
        server/src/ws/operator.ts \
        server/src/ws/visitor.ts \
        server/tests/api/closedConversations.test.ts \
        server/tests/db/migrate.test.ts \
        server/tests/repositories/conversations.test.ts \
        server/tests/repositories/sessions.test.ts \
        server/tests/ws/googleLeadDwellPush.test.ts \
        server/tests/ws/operatorSubscribe.test.ts \
        console/index.html \
        console/src/App.tsx \
        console/src/auth/LoginPage.tsx \
        console/src/auth/SetupPage.tsx \
        console/src/components/ \
        console/src/panels/ \
        console/src/state/ \
        console/src/styles.css \
        console/tailwind.config.js \
        console/tests/components/Toast.test.tsx \
        docs/spec-v2-design.md \
        docs/superpowers/plans/2026-05-07-v2-history-and-notifications.md

git commit -m "v2: checkpoint v1.6 WIP — closed-conversation snapshot, Google-lead dwell push, console 4-tab layout"
```

Expected: one commit on `v2-history-and-notifications` containing all the WIP. `git status` clean.

- [ ] **Step 5: Push branch + verify CI**

```bash
git push -u origin v2-history-and-notifications
```

Expected: branch pushed; if CI is configured, watch it for green.

---

## Task 2 (A): Add `last_message_preview` to recentlyClosedConversations

The Left tab needs a one-liner preview without rendering the full thread.

**Files:**
- Modify: `server/src/ws/operator.ts` (the `subscribe` handler section that builds `recentlyClosed`)
- Modify: `server/tests/ws/operatorSubscribe.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `server/tests/ws/operatorSubscribe.test.ts` after the existing `recentlyClosedConversations` test (find it; it asserts `recentlyClosedConversations` is present with `lastMessages`):

```ts
it('includes last_message_preview on each recently closed conversation', async () => {
  // Arrange a closed conversation with two messages
  const visitorId = newVisitorId();
  const sessionId = newSessionId();
  new VisitorsRepo(db).upsert({ id: visitorId, first_seen_at: 1000, last_seen_at: 2000 });
  new SessionsRepo(db).create({
    id: sessionId, visitor_id: visitorId, started_at: 1000,
    landing_url: 'https://simple1031x.com/', utm_source: null, utm_medium: null,
    utm_campaign: null, utm_term: null, utm_content: null, gclid: null, fbclid: null,
    referrer: null, ip: null, city: null, region: null, country: null, timezone: null,
    device_type: null, browser: null, os: null,
  });
  const cid = 'c_test123';
  new ConversationsRepo(db).create({
    id: cid, visitor_id: visitorId, opened_session_id: sessionId,
    status: 'closed', opened_at: 1000, last_message_at: 2500,
    initiated_by: 'visitor', timeout_capture: null, closed_at: 2500,
  });
  const messagesRepo = new MessagesRepo(db);
  messagesRepo.insert({ conversation_id: cid, sender: 'visitor', body: 'first', sent_at: 2000 });
  messagesRepo.insert({ conversation_id: cid, sender: 'operator', body: 'second reply that is the most recent', sent_at: 2500 });

  // Act: subscribe and read snapshot
  const ws = await connectOperatorWs(token);  // helper from existing tests
  await sendAndWait(ws, { type: 'subscribe' }, 'state_snapshot');
  const snap = await getSnapshotMessage(ws);

  // Assert
  expect(snap.recentlyClosedConversations).toHaveLength(1);
  expect(snap.recentlyClosedConversations[0].last_message_preview).toBe('second reply that is the most recent');
});
```

If helpers `connectOperatorWs`, `sendAndWait`, `getSnapshotMessage` don't exist, inline the equivalent: open `WebSocket`, send `{type:'subscribe'}`, await `state_snapshot` message.

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd server && npm test -- operatorSubscribe
```

Expected: failure on `last_message_preview` undefined.

- [ ] **Step 3: Implement**

In `server/src/ws/operator.ts`, find the section that builds `recentlyClosed` (added in v1.6 WIP). Modify:

```ts
const sinceTs = Date.now() - 24 * 60 * 60 * 1000;
const recentlyClosed = conversations.listRecentlyClosed(sinceTs, 50).map(c => {
  const msgs = messagesRepo.listByConversation(c.id, 50);
  const last = msgs[msgs.length - 1];
  return {
    ...c,
    lastMessages: msgs,
    last_message_preview: last ? last.body.slice(0, 120) : null,
  };
});
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
npm test -- operatorSubscribe
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/ws/operator.ts server/tests/ws/operatorSubscribe.test.ts
git commit -m "(A): include last_message_preview in recentlyClosedConversations snapshot"
```

---

## Task 3 (A): Console state — `closedConversations` signal + reducer hydration

**Files:**
- Modify: `console/src/state/types.ts`
- Modify: `console/src/state/store.ts`
- Modify: `console/src/state/reducers.ts`
- Test: `console/tests/state/reducers.test.ts` (extend)

- [ ] **Step 1: Add the type**

In `console/src/state/types.ts`, add at the bottom:

```ts
export type ClosedConversation = {
  id: string;
  visitor_id: string;
  opened_session_id: string | null;
  status: 'closed' | 'abandoned' | 'closed_for_followup';
  opened_at: number;
  closed_at: number;
  last_message_at: number;
  initiated_by: 'visitor' | 'operator';
  timeout_capture: string | null;
  lastMessages: Message[];
  last_message_preview: string | null;
};
```

- [ ] **Step 2: Add the signal**

In `console/src/state/store.ts`, add after `conversations`:

```ts
import type { LiveVisitor, Conversation, ClosedConversation, OperatorStatus, QuickReply } from './types.js';

export const closedConversations = signal<Record<string, ClosedConversation>>({});
```

- [ ] **Step 3: Write the failing test**

In `console/tests/state/reducers.test.ts`, add:

```ts
import { closedConversations } from '../../src/state/store.js';
import { applyWsMessage } from '../../src/state/reducers.js';

describe('state_snapshot recentlyClosedConversations hydration', () => {
  beforeEach(() => { closedConversations.value = {}; });

  it('populates closedConversations signal from snapshot', () => {
    applyWsMessage({
      type: 'state_snapshot',
      liveVisitors: [], openConversations: [], queuedConversations: [],
      recentlyClosedConversations: [
        { id: 'c1', visitor_id: 'v1', opened_session_id: 's1', status: 'closed',
          opened_at: 1000, closed_at: 2000, last_message_at: 2000,
          initiated_by: 'visitor', timeout_capture: null,
          lastMessages: [{ id: 1, conversation_id: 'c1', sender: 'visitor', body: 'hi', sent_at: 1500, seen_at: null, quick_reply_id: null }],
          last_message_preview: 'hi' },
      ],
    });
    expect(Object.keys(closedConversations.value)).toEqual(['c1']);
    expect(closedConversations.value['c1'].last_message_preview).toBe('hi');
  });

  it('appends on conversation_closed event', () => {
    closedConversations.value = {};
    applyWsMessage({
      type: 'conversation_closed',
      conversation: {
        id: 'c2', visitor_id: 'v2', opened_session_id: 's2', status: 'closed',
        opened_at: 3000, closed_at: 4000, last_message_at: 4000,
        initiated_by: 'operator', timeout_capture: null,
        lastMessages: [], last_message_preview: null,
      },
    });
    expect(closedConversations.value['c2']).toBeDefined();
  });
});
```

- [ ] **Step 4: Run, confirm fail**

```bash
cd console && npm test -- reducers
```

Expected: failure — handler not implemented.

- [ ] **Step 5: Implement**

In `console/src/state/reducers.ts`, import `closedConversations` from `./store.js` and update the `state_snapshot` case + add `conversation_closed`:

```ts
import { liveVisitors, leftVisitors, conversations, closedConversations, operatorStatus, pendingAlerts, unreadByConversation, selectedConversationId } from './store.js';

// ... existing imports/types ...

export function applyWsMessage(msg: any): void {
  switch (msg.type) {
    case 'state_snapshot': {
      // ... existing live/open/queued hydration ...
      if (Array.isArray(msg.recentlyClosedConversations)) {
        const next: Record<string, ClosedConversation> = {};
        for (const c of msg.recentlyClosedConversations) next[c.id] = c;
        closedConversations.value = next;
      }
      break;
    }
    case 'conversation_closed': {
      if (msg.conversation) {
        closedConversations.value = { ...closedConversations.value, [msg.conversation.id]: msg.conversation };
      }
      // also remove from live conversations if present
      if (msg.conversation?.id) {
        const next = { ...conversations.value };
        delete next[msg.conversation.id];
        conversations.value = next;
      }
      break;
    }
    // ... existing cases ...
  }
}
```

(Keep all existing cases intact. Type-import `ClosedConversation` from `./types.js`.)

- [ ] **Step 6: Run tests, confirm pass**

```bash
npm test -- reducers
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add console/src/state/types.ts console/src/state/store.ts console/src/state/reducers.ts console/tests/state/reducers.test.ts
git commit -m "(A): closedConversations signal + reducer hydration from state_snapshot"
```

---

## Task 4 (A): MiddlePane history view for selected closed-conversation visitor

When `selectedVisitorId` is set and that visitor's most recent conversation is in `closedConversations`, MiddlePane should render the closed thread (read-only) with a "Start new chat" CTA. Otherwise (live visitor with no conv) show the existing v1.6 preview card.

**Files:**
- Modify: `console/src/panels/MiddlePane.tsx`
- Test: `console/tests/panels/MiddlePane.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `console/tests/panels/MiddlePane.test.tsx`:

```tsx
import { render, screen } from '@testing-library/preact';
import { MiddlePane } from '../../src/panels/MiddlePane.js';
import { selectedVisitorId, selectedConversationId, liveVisitors, leftVisitors, closedConversations } from '../../src/state/store.js';

describe('MiddlePane history view', () => {
  beforeEach(() => {
    selectedVisitorId.value = null;
    selectedConversationId.value = null;
    liveVisitors.value = {};
    leftVisitors.value = {};
    closedConversations.value = {};
  });

  it('renders prior messages when visitor has a closed conversation', () => {
    const visitorId = 'v_abc123def456';
    leftVisitors.value = {
      [visitorId]: {
        visitorId, name: 'Sam', leadScore: 5, isHot: false,
        currentPage: { url: 'https://simple1031x.com/', title: 'Home', enteredAt: 0 },
        scrollPct: 0, isTyping: false, leftAt: Date.now(),
      } as any,
    };
    closedConversations.value = {
      'c_xyz': {
        id: 'c_xyz', visitor_id: visitorId, opened_session_id: 's1', status: 'closed',
        opened_at: 1000, closed_at: 2000, last_message_at: 2000, initiated_by: 'visitor',
        timeout_capture: null,
        lastMessages: [
          { id: 1, conversation_id: 'c_xyz', sender: 'visitor', body: 'hello there', sent_at: 1500, seen_at: null, quick_reply_id: null },
          { id: 2, conversation_id: 'c_xyz', sender: 'operator', body: 'hi back', sent_at: 1800, seen_at: 2000, quick_reply_id: null },
        ],
        last_message_preview: 'hi back',
      } as any,
    };
    selectedVisitorId.value = visitorId;

    render(<MiddlePane />);
    expect(screen.getByText('hello there')).toBeInTheDocument();
    expect(screen.getByText('hi back')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start new chat/i })).toBeInTheDocument();
  });

  it('shows live preview card when visitor is live with no conversation', () => {
    const visitorId = 'v_live123def789';
    liveVisitors.value = {
      [visitorId]: {
        visitorId, name: null, leadScore: 7, isHot: false,
        currentPage: { url: 'https://simple1031x.com/tax-calculator', title: 'Calc', enteredAt: 0 },
        scrollPct: 60, isTyping: false,
      } as any,
    };
    selectedVisitorId.value = visitorId;

    render(<MiddlePane />);
    expect(screen.getByText(/Lead Score/i)).toBeInTheDocument();
    expect(screen.queryByText(/Closed at/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
cd console && npm test -- MiddlePane
```

Expected: failure — history branch not implemented.

- [ ] **Step 3: Implement**

In `console/src/panels/MiddlePane.tsx`, before the existing State A "visitor selected but no conversation" block, insert a new branch that checks `closedConversations` for a match on `visitor_id`:

```tsx
import { selectedConversation, selectedVisitorId, liveVisitors, leftVisitors, closedConversations, pendingPing } from '../state/store.js';
// ... existing imports ...

export function MiddlePane() {
  const conv = selectedConversation.value;
  if (conv) { /* existing live conversation render */ }

  const visitorId = selectedVisitorId.value;
  if (visitorId) {
    // Find most recent closed conversation for this visitor
    const allClosed = Object.values(closedConversations.value);
    const myClosed = allClosed
      .filter(c => c.visitor_id === visitorId)
      .sort((a, b) => b.closed_at - a.closed_at)[0];

    if (myClosed) {
      const visitor = liveVisitors.value[visitorId] ?? leftVisitors.value[visitorId];
      const displayName = visitor ? visitorDisplayName(visitor) : `Visitor #${visitorId.slice(-6)}`;
      const closedTs = new Date(myClosed.closed_at).toLocaleString();
      return (
        <main className="flex flex-col bg-white border-r border-slate-200">
          <header className="px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold">{displayName}</h3>
            <p className="text-xs text-slate-500">Closed at {closedTs}</p>
          </header>
          <div className="flex-1 overflow-y-auto opacity-90 px-4 py-3 space-y-2">
            {myClosed.lastMessages.map(m => (
              <div key={m.id} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.sender === 'visitor' ? 'bg-slate-100 text-slate-800 self-start' : 'bg-brand-emerald/10 text-brand-emerald-700 self-end ml-auto'}`}>
                {m.body}
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 p-3">
            <button
              onClick={() => { pendingPing.value = visitorId; }}
              className="w-full bg-brand-emerald hover:bg-brand-emerald-600 text-white text-sm font-semibold rounded-lg flex items-center justify-center"
              style={{ height: '44px' }}
            >
              Start new chat
            </button>
          </div>
        </main>
      );
    }

    // existing live preview card branch (no closed conv) — leave intact
    /* ... */
  }

  // existing nothing-selected branch
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- MiddlePane
```

Expected: PASS. Existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add console/src/panels/MiddlePane.tsx console/tests/panels/MiddlePane.test.tsx
git commit -m "(A): MiddlePane history view for selected closed-conv visitor"
```

---

## Task 5 (A): LeftPane "Left" tab — union of session-leavers + closed-conv visitors

The `Left` tab in WIP only renders `leftVisitors` (current session). Extend to include visitors derived from `closedConversations`.

**Files:**
- Modify: `console/src/panels/LeftPane.tsx`
- Test: `console/tests/panels/LeftPane.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `console/tests/panels/LeftPane.test.tsx`:

```tsx
import { render, screen } from '@testing-library/preact';
import { LeftPane } from '../../src/panels/LeftPane.js';
import { liveVisitors, leftVisitors, closedConversations, queuedConversations, liveConversations } from '../../src/state/store.js';

describe('LeftPane Left tab', () => {
  beforeEach(() => {
    liveVisitors.value = {}; leftVisitors.value = {}; closedConversations.value = {};
  });

  it('shows visitors from closedConversations even if not in leftVisitors session map', () => {
    closedConversations.value = {
      'c1': { id: 'c1', visitor_id: 'v_xyz', last_message_at: Date.now() - 1000, closed_at: Date.now(),
              status: 'closed', opened_at: 0, opened_session_id: null, initiated_by: 'visitor',
              timeout_capture: null, lastMessages: [], last_message_preview: 'see you' } as any,
    };
    render(<LeftPane />);
    // Click "Left" tab
    screen.getByText(/Left \(/i).click();
    expect(screen.getByText('see you')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
cd console && npm test -- LeftPane
```

Expected: failure — Left tab doesn't read closedConversations.

- [ ] **Step 3: Implement**

In `console/src/panels/LeftPane.tsx`, change the `leftList` computation:

```tsx
const closed = closedConversations.value;
const closedList = Object.values(closed).map(c => ({
  visitorId: c.visitor_id,
  conversationId: c.id,
  lastMessagePreview: c.last_message_preview,
  lastActivityAt: c.last_message_at,
  closedAt: c.closed_at,
  // Derive a minimal LiveVisitor-shaped object so VisitorRow renders consistently
  shadowVisitor: {
    visitorId: c.visitor_id,
    name: null, email: null, phone: null,
    leadScore: 0, isHot: false, isTyping: false,
    currentPage: { url: '', title: '', enteredAt: 0 }, scrollPct: 0,
  },
}));

const sessionLeftList = Object.values(left);

// Dedup by visitorId, prefer closed-conv (has more data)
const leftMerged = (() => {
  const byId = new Map<string, any>();
  for (const v of sessionLeftList) byId.set(v.visitorId, { kind: 'session', v });
  for (const c of closedList) {
    if (!byId.has(c.visitorId)) byId.set(c.visitorId, { kind: 'closed', c });
  }
  return Array.from(byId.values()).sort((a, b) => {
    const at = a.kind === 'session' ? a.v.leftAt : a.c.lastActivityAt;
    const bt = b.kind === 'session' ? b.v.leftAt : b.c.lastActivityAt;
    return bt - at;
  });
})();
```

Update the tabs counts to use `leftMerged.length`. Update the rendering:

```tsx
{activeTab === 'left' && (
  <>
    {leftMerged.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">No recent visitors</p>}
    {leftMerged.map(item => {
      if (item.kind === 'session') {
        const v = item.v;
        return (
          <VisitorRow key={v.visitorId} visitor={v} selected={selectedVisitorId.value === v.visitorId}
                      onClick={() => selectVisitor(v.visitorId)} variant="left" leftAt={v.leftAt} />
        );
      }
      const c = item.c;
      return (
        <VisitorRow key={c.visitorId} visitor={c.shadowVisitor as any} selected={selectedVisitorId.value === c.visitorId}
                    onClick={() => selectVisitor(c.visitorId)} variant="left"
                    leftAt={c.closedAt} previewText={c.lastMessagePreview ?? undefined} />
      );
    })}
  </>
)}
```

If `VisitorRow` doesn't accept a `previewText` prop yet, add it as an optional prop and render it as a small grey line under the name.

- [ ] **Step 4: Update `VisitorRow.tsx` to accept `previewText`**

In `console/src/components/VisitorRow.tsx`, add to the props type: `previewText?: string` and render it below the name when present:

```tsx
{previewText && <p className="text-xs text-slate-500 truncate">{previewText}</p>}
```

- [ ] **Step 5: Run, confirm pass**

```bash
npm test
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add console/src/panels/LeftPane.tsx console/src/components/VisitorRow.tsx console/tests/panels/LeftPane.test.tsx
git commit -m "(A): LeftPane 'Left' tab merges closedConversations + session-leavers"
```

---

## Task 6 (B1): Server — push every visitor arrival, deduped 5 min

**Files:**
- Create: `server/src/push/recentArrivalDedupe.ts`
- Modify: `server/src/ws/visitor.ts` (after the existing `visitor_appeared` broadcast)
- Test: `server/tests/ws/visitorArrivalPush.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `server/tests/ws/visitorArrivalPush.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import * as pushDispatcher from '../../src/push/dispatcher.js';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';

let server: any, port: number, db: any, ls: LiveSessions;

beforeEach(async () => {
  db = makeTestDb('arrival-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
  server = createServer({
    db, ls,
    env: { VAPID_PUBLIC_KEY: 'k_pub', VAPID_PRIVATE_KEY: 'k_priv', VAPID_SUBJECT: 'mailto:t@e.com' } as any,
  });
  await new Promise<void>((r) => server.listen(0, () => r()));
  port = server.address().port;
});
afterEach(() => { vi.restoreAllMocks(); server.close(); });

async function helloAndWait(ws: WebSocket, payload: any): Promise<any> {
  ws.send(JSON.stringify(payload));
  return new Promise((r) => ws.on('message', (m) => r(JSON.parse(m.toString()))));
}

describe('visitor arrival push', () => {
  it('pushes once per visitor on hello', async () => {
    const spy = vi.spyOn(pushDispatcher, 'pushToOperator').mockResolvedValue(undefined);
    const visitorId = newVisitorId(), sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWait(ws, { type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/', title: 'Home' },
      utms: {}, referrer: null, userAgent: 'Mozilla/5.0' });
    await new Promise(r => setTimeout(r, 50));
    const arrivalCalls = spy.mock.calls.filter(c => (c[2] as any).title === 'New visitor on site');
    expect(arrivalCalls).toHaveLength(1);
    expect((arrivalCalls[0][2] as any).body).toContain('/');
    ws.close();
  }, 5000);

  it('does NOT push if operator is in DND', async () => {
    new OperatorsRepo(db).setStatus(1, 'dnd');
    const spy = vi.spyOn(pushDispatcher, 'pushToOperator').mockResolvedValue(undefined);
    const visitorId = newVisitorId(), sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWait(ws, { type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/', title: 'Home' },
      utms: {}, referrer: null, userAgent: 'Mozilla/5.0' });
    await new Promise(r => setTimeout(r, 50));
    const arrivalCalls = spy.mock.calls.filter(c => (c[2] as any).title === 'New visitor on site');
    expect(arrivalCalls).toHaveLength(0);
    ws.close();
  }, 5000);

  it('dedupes pushes within 5 min for same visitor', async () => {
    const spy = vi.spyOn(pushDispatcher, 'pushToOperator').mockResolvedValue(undefined);
    const visitorId = newVisitorId();
    for (let i = 0; i < 3; i++) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
      await new Promise<void>((r) => ws.on('open', () => r()));
      await helloAndWait(ws, { type: 'hello', visitorId, sessionId: newSessionId(),
        page: { url: 'https://simple1031x.com/', title: 'Home' },
        utms: {}, referrer: null, userAgent: 'Mozilla/5.0' });
      ws.close();
      await new Promise(r => setTimeout(r, 30));
    }
    const arrivalCalls = spy.mock.calls.filter(c => (c[2] as any).title === 'New visitor on site');
    expect(arrivalCalls).toHaveLength(1);
  }, 5000);
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
cd server && npm test -- visitorArrivalPush
```

Expected: failure (no arrival push).

- [ ] **Step 3: Create the dedupe module**

```ts
// server/src/push/recentArrivalDedupe.ts
const recentlyPushed = new Map<string, number>();
const WINDOW_MS = 5 * 60 * 1000;

export function shouldPushArrival(visitorId: string, now = Date.now()): boolean {
  const last = recentlyPushed.get(visitorId);
  if (last && now - last < WINDOW_MS) return false;
  recentlyPushed.set(visitorId, now);
  return true;
}

// Periodic sweep — call from server boot
export function startArrivalDedupeSweep(intervalMs = 60_000): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();
    for (const [k, v] of recentlyPushed) {
      if (now - v > WINDOW_MS) recentlyPushed.delete(k);
    }
  }, intervalMs).unref();
}

export function _resetForTests() { recentlyPushed.clear(); }
```

- [ ] **Step 4: Wire it into visitor.ts**

In `server/src/ws/visitor.ts`, after the `deps.oc.broadcastTo(1, { type: 'visitor_appeared', ... })` line, add:

```ts
import { shouldPushArrival } from '../push/recentArrivalDedupe.js';
// ... within the hello handler, after the visitor_appeared broadcast:
const opForArrival = operators.findById(1);
if (shouldPushOperator(opForArrival ?? undefined, false) && shouldPushArrival(state.visitorId!)) {
  const label = visitor.name ?? `Visitor #${state.visitorId!.slice(-6)}`;
  pushDispatcher.pushToOperator(deps, 1, {
    title: 'New visitor on site',
    body: `${label} · ${pathOf(msg.page.url)}`,
    url: `/console/?ping=${state.visitorId}`,
    tag: `visitor-${state.visitorId}`,
    urgency: 'normal',
  }).catch((err) => logger.warn({ err }, 'arrival push failed'));
}
```

Make sure this runs **only** for new sessions, not reconnects (skip if `existingSession` is true — keep consistent with the gclid dwell logic).

- [ ] **Step 5: Run, confirm pass**

```bash
npm test -- visitorArrivalPush
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/push/recentArrivalDedupe.ts server/src/ws/visitor.ts server/tests/ws/visitorArrivalPush.test.ts
git commit -m "(B1): push operator on every new visitor arrival, deduped 5 min"
```

---

## Task 7 (B2): Console — desktop audio ping every message + every arrival

**Files:**
- Modify: `console/src/notifications.ts`
- Modify: `console/src/state/reducers.ts` (call notifyVisitorArrived on `visitor_appeared`)
- Test: `console/tests/notifications.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `console/tests/notifications.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notifyVisitorMessage, notifyVisitorArrived, _resetForTests, _setOperatorStatusForTests } from '../src/notifications.js';

describe('notifications', () => {
  beforeEach(() => { _resetForTests(); _setOperatorStatusForTests('online'); });

  it('plays ping on visitor message regardless of focus', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const playSpy = vi.fn().mockResolvedValue(undefined);
    (global as any).HTMLMediaElement = class { play = playSpy; volume = 0; currentTime = 0; };
    notifyVisitorMessage({ name: 'A', body: 'hi' });
    expect(playSpy).toHaveBeenCalled();
  });

  it('plays arrival ping (different sound) on new visitor', () => {
    const playSpy = vi.fn().mockResolvedValue(undefined);
    (global as any).HTMLMediaElement = class { play = playSpy; volume = 0; currentTime = 0; };
    notifyVisitorArrived({ name: 'B', page: '/' });
    expect(playSpy).toHaveBeenCalled();
  });

  it('does NOT play any ping when operator is in DND', () => {
    _setOperatorStatusForTests('dnd');
    const playSpy = vi.fn().mockResolvedValue(undefined);
    (global as any).HTMLMediaElement = class { play = playSpy; volume = 0; currentTime = 0; };
    notifyVisitorMessage({ name: 'A', body: 'hi' });
    notifyVisitorArrived({ name: 'B', page: '/' });
    expect(playSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
cd console && npm test -- notifications
```

Expected: failures — `notifyVisitorArrived` not exported, gate not present.

- [ ] **Step 3: Implement**

Replace `console/src/notifications.ts`:

```ts
const PING_MESSAGE_URL = '/console/sounds/ping-message.mp3';
const PING_ARRIVAL_URL = '/console/sounds/ping-arrival.mp3';

let messageAudio: HTMLAudioElement | null = null;
let arrivalAudio: HTMLAudioElement | null = null;
let originalTitle: string | null = null;
let unread = 0;
let operatorStatusLocal: 'online' | 'away' | 'dnd' = 'online';

export function _setOperatorStatusForTests(s: 'online' | 'away' | 'dnd') { operatorStatusLocal = s; }
export function setOperatorStatusForNotifications(s: 'online' | 'away' | 'dnd') { operatorStatusLocal = s; }

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export function unlockAudio() {
  // Call from a user gesture (login button) so subsequent .play() succeeds in autoplay-restricted browsers
  for (const url of [PING_MESSAGE_URL, PING_ARRIVAL_URL]) {
    try { const a = new Audio(url); a.volume = 0; void a.play().then(() => a.pause()).catch(() => {}); } catch {}
  }
}

export function notifyVisitorMessage(_opts: { name?: string | null; body: string }) {
  if (operatorStatusLocal === 'dnd') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    unread++;
    flashTitle();
  }
  playPing('message');
}

export function notifyVisitorArrived(_opts: { name?: string | null; page: string }) {
  if (operatorStatusLocal === 'dnd') return;
  playPing('arrival');
}

function playPing(kind: 'message' | 'arrival') {
  try {
    let el = kind === 'message' ? messageAudio : arrivalAudio;
    const url = kind === 'message' ? PING_MESSAGE_URL : PING_ARRIVAL_URL;
    if (!el) {
      el = new Audio(url);
      el.volume = kind === 'message' ? 0.4 : 0.25;
      if (kind === 'message') messageAudio = el; else arrivalAudio = el;
    }
    el.currentTime = 0;
    void el.play();
  } catch {}
}

function flashTitle() {
  if (typeof document === 'undefined') return;
  if (originalTitle === null) originalTitle = document.title;
  document.title = `(${unread}) ${originalTitle}`;
}

export function clearUnread() {
  unread = 0;
  if (originalTitle !== null && typeof document !== 'undefined') document.title = originalTitle;
}

export function _resetForTests() {
  messageAudio = null; arrivalAudio = null; originalTitle = null; unread = 0; operatorStatusLocal = 'online';
}
```

- [ ] **Step 4: Add the audio files**

Drop two short MP3 files (~3KB each) in `console/public/sounds/`:
- `ping-message.mp3` — a clear medium ding (~150ms)
- `ping-arrival.mp3` — a softer chime (~200ms)

If the user doesn't have files handy, generate them with a one-liner:

```bash
# Requires ffmpeg
ffmpeg -f lavfi -i "sine=frequency=880:duration=0.15" -ac 1 -ab 32k console/public/sounds/ping-message.mp3
ffmpeg -f lavfi -i "sine=frequency=523:duration=0.20" -ac 1 -ab 32k console/public/sounds/ping-arrival.mp3
```

- [ ] **Step 5: Wire arrival ping into reducer**

In `console/src/state/reducers.ts`, add to the `visitor_appeared` case:

```ts
import { notifyVisitorMessage, notifyVisitorArrived } from '../notifications.js';
// ...
case 'visitor_appeared': {
  // ... existing live-visitors map insert ...
  notifyVisitorArrived({ name: msg.visitor.name, page: msg.session?.landing_url ?? '' });
  break;
}
```

- [ ] **Step 6: Wire operatorStatus → notifications**

In `console/src/state/reducers.ts`, the `status_changed` case (find existing) should call `setOperatorStatusForNotifications(msg.status)` so the local DND gate stays current. Also call it on initial `state_snapshot` after operator status loads.

- [ ] **Step 7: Wire unlockAudio on login**

In `console/src/auth/LoginPage.tsx`, after a successful login (just before `window.location.reload()`), call `unlockAudio()`. Same for `SetupPage.tsx`.

- [ ] **Step 8: Run, confirm pass**

```bash
npm test
```

- [ ] **Step 9: Commit**

```bash
git add console/src/notifications.ts console/src/state/reducers.ts console/src/auth/ console/public/sounds/ console/tests/notifications.test.ts
git commit -m "(B2): desktop audio ping on every message and arrival, DND-gated"
```

---

## Task 8 (B3): VAPID urgency/TTL + push diagnostics columns

**Files:**
- Modify: `server/src/push/dispatcher.ts`
- Create: `server/src/db/migrations/003-push-diagnostics.sql`
- Modify: `server/src/repositories/pushSubscriptions.ts`
- Test: `server/tests/push/dispatcher.test.ts` (extend or create)

- [ ] **Step 1: Write the failing test**

In `server/tests/push/dispatcher.test.ts`:

```ts
it('sets urgency=high and TTL=60 on visitor-arrival and message payloads', async () => {
  const sendNotificationSpy = vi.fn().mockResolvedValue({ statusCode: 201 });
  vi.doMock('web-push', () => ({ default: { sendNotification: sendNotificationSpy }, sendNotification: sendNotificationSpy, setVapidDetails: vi.fn() }));
  // ... seed a push_subscription, call pushToOperator with title 'New visitor on site'
  // assert sendNotificationSpy.mock.calls[0][2] options has urgency:'high', TTL:60
});
```

- [ ] **Step 2: Run, confirm fail.**

- [ ] **Step 3: Implement**

In `server/src/push/dispatcher.ts`, modify `pushToOperator` to add an options object on `web-push.sendNotification`:

```ts
const HIGH_URGENCY_TITLES = new Set([
  'New visitor on site',
  'Google Ads lead on site',
  // visitor message titles — match prefix
]);

function isHighUrgency(title: string): boolean {
  if (HIGH_URGENCY_TITLES.has(title)) return true;
  if (title.startsWith('Visitor: ')) return true; // visitor messages
  return false;
}

// Inside the per-subscription send loop:
const options = isHighUrgency(payload.title)
  ? { TTL: 60, urgency: 'high' as const }
  : { TTL: 300, urgency: 'normal' as const };

await webpush.sendNotification(subscription, JSON.stringify(payload), options);
```

For 410 cleanup: confirm the catch-block deletes the row. If it doesn't, fix:

```ts
} catch (err: any) {
  if (err.statusCode === 410 || err.statusCode === 404) {
    pushSubsRepo.deleteByEndpoint(sub.endpoint);
    pushSubsRepo.recordFail(sub.id, `gone-${err.statusCode}`, Date.now());
  } else {
    logger.warn({ err, subId: sub.id }, 'push send failed');
    pushSubsRepo.recordFail(sub.id, String(err.message ?? err.statusCode ?? 'unknown'), Date.now());
  }
}
```

- [ ] **Step 4: Add migration 003**

```sql
-- server/src/db/migrations/003-push-diagnostics.sql
ALTER TABLE push_subscriptions ADD COLUMN last_push_ok_at INTEGER;
ALTER TABLE push_subscriptions ADD COLUMN last_push_fail_reason TEXT;
ALTER TABLE push_subscriptions ADD COLUMN last_push_fail_at INTEGER;
```

- [ ] **Step 5: Add repo methods**

In `server/src/repositories/pushSubscriptions.ts`:

```ts
recordOk(id: number, ts: number): void {
  this.db.prepare('UPDATE push_subscriptions SET last_push_ok_at = ?, last_used_at = ? WHERE id = ?').run(ts, ts, id);
}
recordFail(id: number, reason: string, ts: number): void {
  this.db.prepare('UPDATE push_subscriptions SET last_push_fail_reason = ?, last_push_fail_at = ? WHERE id = ?').run(reason, ts, id);
}
deleteByEndpoint(endpoint: string): void {
  this.db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}
```

- [ ] **Step 6: Run, confirm pass**

```bash
npm test -- dispatcher migrate
```

- [ ] **Step 7: Commit**

```bash
git add server/src/db/migrations/003-push-diagnostics.sql server/src/repositories/pushSubscriptions.ts server/src/push/dispatcher.ts server/tests/push/
git commit -m "(B3): VAPID urgency=high + TTL=60 on hot pushes; push diagnostics columns + 410 cleanup"
```

---

## Task 9 (C): Quick-replies CRUD settings page

**Files:**
- Create: `console/src/api/quickRepliesApi.ts`
- Create: `console/src/panels/SettingsPage.tsx`
- Modify: `console/src/App.tsx` (add `#/settings` route)
- Modify: `console/src/components/QuickRepliesChips.tsx` (link to settings)
- Modify: `server/src/api/setup.ts` (seed three on-brand defaults for new operators)
- Test: `console/tests/panels/SettingsPage.test.tsx` (new)

- [ ] **Step 1: Seed defaults on operator setup**

In `server/src/api/setup.ts`, after the `tokens.create(tok, opId, now)` line, add:

```ts
import { QuickRepliesRepo } from '../repositories/quickReplies.js';
// ...
const qr = new QuickRepliesRepo(deps.db);
qr.create(opId, "Hi! I'm Alex — how can I help with your 1031?", "Hi! I'm Alex from Simple 1031 — how can I help with your exchange?", 0);
qr.create(opId, "Timeline check (45/180-day rules)", "Happy to walk through your timeline (45/180-day rules) — what's the close date on your relinquished property?", 1);
qr.create(opId, "Send checklist via text", "Want me to text you a quick checklist? Drop your number and I'll send it over.", 2);
```

(Verify the `QuickRepliesRepo.create` signature accepts `(operatorId, label, body, sortOrder)` — adjust if different.)

- [ ] **Step 2: Build the API client**

```ts
// console/src/api/quickRepliesApi.ts
import { tokenStore } from '../auth/tokenStore.js';

const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStore.get()}` });

export async function listQuickReplies() {
  const res = await fetch('/api/operator/quick-replies', { headers: headers() });
  return res.json();
}
export async function createQuickReply(label: string, body: string) {
  const res = await fetch('/api/operator/quick-replies', { method: 'POST', headers: headers(), body: JSON.stringify({ label, body }) });
  return res.json();
}
export async function updateQuickReply(id: number, patch: { label?: string; body?: string; sort_order?: number }) {
  const res = await fetch(`/api/operator/quick-replies/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(patch) });
  return res.json();
}
export async function deleteQuickReply(id: number) {
  await fetch(`/api/operator/quick-replies/${id}`, { method: 'DELETE', headers: headers() });
}
```

- [ ] **Step 3: Build the SettingsPage**

```tsx
// console/src/panels/SettingsPage.tsx
import { useState, useEffect } from 'preact/hooks';
import { quickReplies } from '../state/store.js';
import { listQuickReplies, createQuickReply, updateQuickReply, deleteQuickReply } from '../api/quickRepliesApi.js';

export function SettingsPage() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftBody, setDraftBody] = useState('');

  useEffect(() => { listQuickReplies().then((list) => quickReplies.value = list); }, []);

  async function add() {
    if (!draftLabel.trim() || !draftBody.trim()) return;
    const created = await createQuickReply(draftLabel.trim(), draftBody.trim());
    quickReplies.value = [...quickReplies.value, created];
    setDraftLabel(''); setDraftBody('');
  }

  async function save(id: number, label: string, body: string) {
    const updated = await updateQuickReply(id, { label, body });
    quickReplies.value = quickReplies.value.map((q) => q.id === id ? updated : q);
    setEditingId(null);
  }

  async function remove(id: number) {
    await deleteQuickReply(id);
    quickReplies.value = quickReplies.value.filter((q) => q.id !== id);
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Quick replies</h1>
        <a href="#/" className="text-sm text-brand-emerald hover:underline">← Back</a>
      </div>

      <div className="space-y-3">
        {quickReplies.value.map((q) => (
          <QuickReplyRow key={q.id} q={q} editing={editingId === q.id}
            onEdit={() => setEditingId(q.id)} onSave={save} onCancel={() => setEditingId(null)} onDelete={() => remove(q.id)} />
        ))}
      </div>

      <div className="border-t border-slate-200 pt-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Add new</h2>
        <input value={draftLabel} onInput={(e) => setDraftLabel((e.target as HTMLInputElement).value)}
               placeholder="Chip label (≤40 chars)" maxLength={40}
               className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2" />
        <textarea value={draftBody} onInput={(e) => setDraftBody((e.target as HTMLTextAreaElement).value)}
                  placeholder="Message body" rows={3} maxLength={2000}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2" />
        <button onClick={add} className="bg-brand-emerald hover:bg-brand-emerald-600 text-white text-sm font-semibold rounded-lg px-4 py-2">Add reply</button>
      </div>
    </div>
  );
}

function QuickReplyRow({ q, editing, onEdit, onSave, onCancel, onDelete }: any) {
  const [l, setL] = useState(q.label);
  const [b, setB] = useState(q.body);
  if (!editing) {
    return (
      <div className="border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{q.label}</div>
          <div className="text-xs text-slate-600 mt-1 line-clamp-2">{q.body}</div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onEdit} className="text-xs text-slate-600 hover:text-slate-900 underline">Edit</button>
          <button onClick={onDelete} className="text-xs text-red-600 hover:text-red-800 underline">Delete</button>
        </div>
      </div>
    );
  }
  return (
    <div className="border-2 border-brand-emerald rounded-lg p-3 space-y-2">
      <input value={l} onInput={(e) => setL((e.target as HTMLInputElement).value)}
             className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      <textarea value={b} onInput={(e) => setB((e.target as HTMLTextAreaElement).value)} rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <button onClick={() => onSave(q.id, l, b)} className="bg-brand-emerald text-white text-xs font-semibold rounded-lg px-3 py-1.5">Save</button>
        <button onClick={onCancel} className="text-xs text-slate-600 underline">Cancel</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the route in App.tsx**

In `console/src/App.tsx`, add `#/settings` handling:

```tsx
import { SettingsPage } from './panels/SettingsPage.js';
// ...
const [route, setRoute] = useState(window.location.hash);
useEffect(() => {
  const handler = () => setRoute(window.location.hash);
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}, []);

if (route === '#/settings') return <SettingsPage />;
```

- [ ] **Step 5: Add a "Settings" link in QuickRepliesChips**

In `console/src/components/QuickRepliesChips.tsx`, after the chips render, add:

```tsx
<a href="#/settings" className="text-xs text-slate-500 hover:text-slate-700 underline ml-2">Edit replies</a>
```

- [ ] **Step 6: Test**

Create `console/tests/panels/SettingsPage.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/preact';
import { SettingsPage } from '../../src/panels/SettingsPage.js';
import { quickReplies } from '../../src/state/store.js';
import * as api from '../../src/api/quickRepliesApi.js';
import { vi } from 'vitest';

describe('SettingsPage', () => {
  beforeEach(() => {
    quickReplies.value = [{ id: 1, label: 'Hi', body: 'Hello there', sort_order: 0 }];
    vi.spyOn(api, 'listQuickReplies').mockResolvedValue([{ id: 1, label: 'Hi', body: 'Hello there', sort_order: 0 }]);
  });

  it('lists existing replies', async () => {
    render(<SettingsPage />);
    expect(await screen.findByText('Hi')).toBeInTheDocument();
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('adds a new reply', async () => {
    const createSpy = vi.spyOn(api, 'createQuickReply').mockResolvedValue({ id: 2, label: 'Bye', body: 'See ya', sort_order: 1 });
    render(<SettingsPage />);
    fireEvent.input(screen.getByPlaceholderText(/Chip label/i), { target: { value: 'Bye' } });
    fireEvent.input(screen.getByPlaceholderText(/Message body/i), { target: { value: 'See ya' } });
    fireEvent.click(screen.getByText('Add reply'));
    await screen.findByText('Bye');
    expect(createSpy).toHaveBeenCalledWith('Bye', 'See ya');
  });

  it('deletes a reply', async () => {
    const delSpy = vi.spyOn(api, 'deleteQuickReply').mockResolvedValue(undefined as any);
    render(<SettingsPage />);
    fireEvent.click(await screen.findByText('Delete'));
    expect(delSpy).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 7: Run all tests**

```bash
cd console && npm test
cd ../server && npm test
```

- [ ] **Step 8: Commit**

```bash
git add console/src/api/quickRepliesApi.ts console/src/panels/SettingsPage.tsx console/src/App.tsx console/src/components/QuickRepliesChips.tsx console/tests/panels/SettingsPage.test.tsx server/src/api/setup.ts
git commit -m "(C): quick-replies CRUD settings page + on-brand default seeds for new operators"
```

---

## Task 10: Build, deploy, smoke-test

- [ ] **Step 1: Final test sweep**

```bash
cd ~/code/tidio-remake
( cd server && npm test ) && ( cd console && npm test ) && ( cd widget && npm test )
```

Expected: 100% green across all three packages.

- [ ] **Step 2: Build all three packages**

```bash
( cd server && npm run build ) && ( cd console && npm run build ) && ( cd widget && npm run build )
```

Expected: builds succeed, no warnings about unresolved imports.

- [ ] **Step 3: Verify v2 strings landed in console bundle**

```bash
grep -c "Edit replies" console/dist/assets/*.js
grep -c "New visitor on site" server/dist/index.js
```

Expected: ≥ 1 for each.

- [ ] **Step 4: Push branch + open PR**

```bash
git push origin v2-history-and-notifications
gh pr create --title "v2: history view, every-event notifications, quick-replies CRUD" \
  --body "Closes the three operator asks. See docs/spec-v2-design.md."
```

- [ ] **Step 5: Once merged to main, deploy**

Following the tidio-remake skill's deploy workflow:

```bash
ssh root@server.mortalitygame.com
cd /opt/tidio-remake
sudo -u tidio git pull origin main
sudo -u tidio npm ci  # devDeps for vite build
( cd server && sudo -u tidio npm run build )
( cd console && sudo -u tidio npm run build )
( cd widget && sudo -u tidio npm run build )
systemctl restart tidio-remake
journalctl -u tidio-remake -n 20 --no-pager
```

- [ ] **Step 6: Smoke test on production**

1. Open `https://chat.simple1031x.com/console/` on desktop. Hard refresh.
2. Verify Settings link works → CRUD a quick reply → save → verify chip appears in active conversation.
3. Open `https://simple1031x.com/` in an incognito window. Confirm an OS-level desktop notification fires AND audio ping plays in the console even with the console tab focused.
4. On phone PWA: same test. Confirm notification arrives within 5 seconds.
5. Send a message from the visitor side; confirm operator audio ping fires every time, not just first.
6. Refresh console; click "Left" tab; confirm visitors with prior conversations show up with last_message_preview text.
7. Click a Left-tab visitor; confirm history view in MiddlePane with "Start new chat" button.

If any smoke test fails, file a follow-up issue and revert the deploy if blocking.
