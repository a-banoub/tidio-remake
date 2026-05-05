# Warm-Visitor Alert (v1.4) — Design

**Status:** Approved
**Date:** 2026-05-04
**Branch:** `v1.4-warm-visitor-alert`

## Problem

Operator currently learns about a visitor in only three ways:

1. The visitor opens chat (visitor-initiated).
2. The visitor's lead score crosses 8 (`high_priority_alert`).
3. The operator manually scans the left rail.

This misses **warm but not hot** visitors — score 1–7, on site, browsing pricing or returning from an ad — who would convert if pinged but never trigger a notification. With a single operator running a side console, the warm middle is exactly where conversions get dropped.

## Solution

Server-side per-visitor timer. Fires a `warm_visitor_alert` 90 seconds after the visitor's lead score becomes positive, provided:

- Visitor is still connected
- Visitor has not opened chat
- No conversation exists for the visitor
- Alert has not already fired for this `sessionId`

Alert is delivered via the existing VAPID push pipeline (so it reaches phone even with the console closed) and via the existing `pendingAlerts` signal (so the existing `Toast` component renders it for free).

## Goals

- **G1.** Operator gets push notification for warm visitors after 90s dwell.
- **G2.** Tapping the notification deep-links the operator to the visitor's ping modal.
- **G3.** No spam: one alert per visitor per session.
- **G4.** Cancellation is correct: chat-open, disconnect, conversation creation all cancel a pending timer.
- **G5.** Threshold is a single named constant; env-var override deferred.

## Non-goals

- Multi-step alert ladder (30s + 60s + 90s).
- Per-page threshold variation.
- Cross-session dedup. Returning visitor with score > 0 = new alert (option A, approved).
- Per-operator enable/disable toggle. DND already covers "shut up".

## Architecture

### Server

**New module:** `server/src/timers/warmVisitor.ts`

```typescript
export const WARM_VISITOR_DWELL_MS = 90_000;

export class WarmVisitorTimers {
  private timers = new Map<string, NodeJS.Timeout>();   // visitorId -> handle
  private fired = new Set<string>();                    // sessionIds that already fired

  start(visitorId: string, sessionId: string, ms: number, onFire: () => void): void;
  cancel(visitorId: string): void;
  hasFired(sessionId: string): boolean;
  clearForSession(sessionId: string): void;             // visitor disconnect
  size(): number;                                        // for tests
}
```

`start` is a no-op when:
- A timer is already running for `visitorId`.
- `hasFired(sessionId)` is true.

`onFire` callback is responsible for: marking the session as fired, removing the timer entry, emitting the WS event, and calling `pushToOperator`. Timer module itself is dumb — it just schedules and tracks.

**Wire-up in `server/src/ws/visitor.ts`:**

| Hook | Action |
|---|---|
| `hello` (after lead score derived) | If `currentLeadScore > 0` AND no conversation for visitor: `start()` |
| `lead_signal` (after score recompute) | If score newly > 0 AND no timer running AND not fired: `start()` |
| `chat_open` | `cancel()` |
| `chat_message` (visitor's first → server creates conversation) | `cancel()` |
| WS close handler | `cancel()` + `clearForSession()` |
| Operator `open_chat` (creates conversation) | `cancel()` (in `server/src/ws/operator.ts`) |

**Server emits on fire (broadcast to operator):**

```ts
{
  type: 'warm_visitor_alert',
  visitorId: string,
  sessionId: string,
  leadScore: number,
  page: string,        // last known URL from presence/page_view, or landing_url
  dwellMs: number,     // ms since hello (effectively WARM_VISITOR_DWELL_MS)
  reason: 'warm_dwell_90s',
}
```

**Push payload:**

```ts
{
  title: 'Warm visitor on site',
  body: `${pathOf(page)} · score ${leadScore}, here ${Math.round(dwellMs/1000)}s`,
  url: `/console/?ping=${visitorId}`,
}
```

`pathOf()` strips host so the body fits the notification line. SW push handler is already generic; no SW change needed.

### Console

**Reducer (`console/src/state/reducers.ts`):** new case:

```ts
case 'warm_visitor_alert': {
  pendingAlerts.value = [
    ...pendingAlerts.value,
    {
      visitorId: msg.visitorId,
      reason: 'warm_visitor',           // distinct from 'lead_score_8'
      timestamp: Date.now(),
    },
  ];
  break;
}
```

**Toast UI (`console/src/components/Toast.tsx`):** today the component hardcodes `"Hot lead"`. Replace with a `reason`-driven label and tint:

| `reason` | Label | Background |
|---|---|---|
| `lead_score_8` (existing) | `Hot lead` | `bg-orange-500` |
| `warm_visitor` (new) | `Warm visitor` | `bg-blue-500` |
| anything else | `Alert` | `bg-slate-500` |

Click behavior unchanged: select the matching conversation if one exists; otherwise (no conversation yet — the warm-visitor case) trigger `pendingPing.value = visitorId` so the `PingModal` opens.

**Deep-link from notification (`console/src/main.tsx`):** on boot, parse `URLSearchParams`. If `ping=<visitorId>` present, set `pendingPing.value = visitorId` (after the `App` mounts, so the modal renders). Strip the param from the URL via `history.replaceState` to avoid re-triggering on reload.

### Tests

**Server unit (`server/tests/timers/warmVisitor.test.ts`):**
- `start` schedules a callback after `ms`.
- `start` is a no-op when a timer already runs for that visitorId.
- `start` is a no-op when `hasFired(sessionId)` is true.
- `cancel` clears a pending timer (callback never fires).
- `clearForSession` removes the fired entry so a future `start` for the same visitor (different session) is allowed.

**Server integration (`server/tests/ws/warmVisitorAlert.test.ts`):**
- Visitor connects with score 0 → no alert after 90s.
- Visitor connects with score > 0 → alert fires after 90s with correct payload.
- Visitor connects with score 0 → emits `lead_signal` raising score to 2 → alert fires 90s after the signal.
- Pending timer cancels on `chat_open`.
- Pending timer cancels on visitor's first `chat_message`.
- Pending timer cancels on visitor disconnect.
- Pending timer cancels on operator `open_chat`.
- Alert does not refire within the same session.
- Same visitorId, fresh sessionId → alert fires again (option A).
- Alert calls `pushToOperator` with the expected push payload.

**Console (`console/tests/state/reducers.test.ts`):** new cases:
- `warm_visitor_alert` event appends to `pendingAlerts` with `reason: 'warm_visitor'`.

**Console (`console/tests/components/Toast.test.tsx`, new file):**
- Renders "Hot lead" + orange for `lead_score_8`.
- Renders "Warm visitor" + blue for `warm_visitor`.
- Click on a `warm_visitor` toast (no conversation) sets `pendingPing.value`.
- Click on a `lead_score_8` toast with a conversation selects it.

**Console (`console/tests/main.test.tsx`, new file):**
- URL `?ping=v_abc123def456` triggers `pendingPing.value = 'v_abc123def456'` and removes the param from the URL.

## Migration / rollout

- No DB migration.
- Backward compatible: console reducer ignores unknown event types today; adding a case is purely additive.
- Deploy is the standard cycle (server + console build, restart). No env-var changes.
- After merge: operator should re-open the console once on each device so the new SW version activates and the notification deep-link works.

## Files

**Added:**
- `server/src/timers/warmVisitor.ts`
- `server/tests/timers/warmVisitor.test.ts`
- `server/tests/ws/warmVisitorAlert.test.ts`
- `console/tests/components/Toast.test.tsx`
- `console/tests/main.test.tsx`
- `docs/superpowers/specs/2026-05-04-warm-visitor-alert-design.md` (this file)

**Modified:**
- `server/src/server.ts` — instantiate `WarmVisitorTimers`, add to `ServerDeps`
- `server/src/ws/visitor.ts` — start/cancel timer; emit `warm_visitor_alert`; push
- `server/src/ws/operator.ts` — cancel timer when operator opens a chat
- `console/src/state/reducers.ts` — handle `warm_visitor_alert`
- `console/src/components/Toast.tsx` — reason-driven label + tint; warm-visitor click triggers ping
- `console/src/main.tsx` — read `?ping=` and seed `pendingPing`

## Risks

1. **Notification fatigue at scale.** Acceptable per user. Revisit at >50 unique daily visitors with score > 0.
2. **Visitor on multiple tabs.** `LiveSessions` is keyed by visitorId; the timer is per-visitor not per-socket. Correct behavior — one alert per real person.
3. **Page change resets dwell?** No. Dwell is from `hello`. Visitor moving between pages keeps the same timer running. (If we later want "30s on /pricing specifically", that's a separate feature.)
4. **Server restart during a pending timer.** Timer is in-memory; restart drops it. Acceptable — the visitor will likely have disconnected during the restart anyway, and on reconnect the `hello` handler re-evaluates and starts a fresh timer.
