# Tidio Remake — v2 Design Spec

**Date:** 2026-05-07
**Branch (target):** `v2-history-and-notifications`
**Status:** Drafted, building on existing v1.6 WIP

Three operator-facing improvements on top of v1.5 (mobile widget) and the v1.6 WIP currently sitting uncommitted on `v1.5-mobile-widget`.

---

## 1. The asks (verbatim from operator)

A. **Conversation history.** "There is no area for previous chats to live after user leaves site, there is also no right hand menu when I go to invoke. I need to be able to see their history before opening the chat."

B. **Reliable per-event notifications.** "I need this to notify me every time a visitor enters the website unless I am set to DnD and also every time there is a response. The web app notifying my phone is spotty. It needs to be every time with an audio ping on desktop as well."

C. **Operator-managed quick replies.** "I need to be able to create/edit/send/save templated responses. The default I don't like and I need others."

---

## 2. What already exists (v1.6 WIP, uncommitted)

The previous session built ~60% of (A). Inventory:

**Server (already in WIP)**
- `server/src/api/closedConversations.ts` — `GET /api/operator/conversations/closed?since=<ts>` returns last 100 closed/abandoned/closed_for_followup conversations + their last 50 messages. Auth-gated.
- `ConversationsRepo.listRecentlyClosed(sinceTs, limit)`.
- Operator `subscribe` handler now includes `recentlyClosedConversations` (last 24h, max 50, with messages) in the initial `state_snapshot`.
- `dwell_notified_at` column on `sessions`, migration `002-add-dwell-tracking.sql`.
- Google-Ads-only 30s dwell push (NEW push trigger, but it's *only* for `gclid` visitors — not every visitor).

**Console (already in WIP)**
- `LeftPane`: 4-tab layout — `Live` / `Waiting` / `On Site` / `Left`. `Left` tab is populated client-side from a new `leftVisitors` signal, which the reducer fills on `visitor_left`.
- `MiddlePane`: three render states — conversation selected (existing chat), visitor selected without conversation (preview card with lead score, scroll, geo, device, "Start Chat" button), nothing selected.
- `RightPane`: now also renders the visitor detail panel when `selectedVisitorId` is set, not just on conversation select.
- Brand tokens added to `console/src/styles.css` (Simple 1031 navy/emerald/gold).

**What's missing from the WIP for the asks**
- (A) Console reducer doesn't consume `recentlyClosedConversations` from the snapshot — `Left` tab is empty across reloads.
- (A) Selecting a left visitor shows the live preview card; it should show their **prior conversation messages** read-only.
- (B) No push fires on `visitor_appeared`. Only the gclid-30s case + visitor message replies.
- (B) `notifications.ts` audio ping only fires when `document.visibilityState === 'hidden'`. Operator wants it audible while focused too.
- (B) No follow-up on phone reliability — should validate VAPID `urgency`/`TTL` and push subscription cleanup.
- (C) Settings UI for quick-replies CRUD doesn't exist. The chips render from `quickReplies` signal, but no list/add/edit/delete surface.

---

## 3. Design

### 3.1 (A) Conversation history & visitor-first selection

#### Server side

Already done in WIP. No new endpoints. One small addition: include `last_message_preview` (the most recent visitor or operator message body, truncated to 120 chars) on each entry of `recentlyClosedConversations`, so the `Left` tab can show preview text without rendering the full thread.

Also add a `closed_count_24h` field to operator status on subscribe, useful for the tab badge.

#### Console state

Two new signals:

```ts
// New: durable history of visitors who had conversations in the last 24h
export const closedConversations = signal<Record<string, ClosedConversation>>({});

// closedVisitors derives from closedConversations + a snapshot copy of the visitor row
export const closedVisitors = computed(() => /* derived from closedConversations + cached visitor */);
```

`leftVisitors` (already in WIP) covers visitors who left during the *current* console session. `closedConversations` covers the persistent 24h tail from the server. The "Left" tab is the union of both, dedup'd by `visitorId`, sorted by most-recent activity.

The reducer handles a new `state_snapshot` field:

```ts
case 'state_snapshot': {
  // ... existing ...
  if (msg.recentlyClosedConversations) {
    const next: Record<string, ClosedConversation> = {};
    for (const c of msg.recentlyClosedConversations) {
      next[c.id] = c;  // includes lastMessages
    }
    closedConversations.value = next;
  }
  break;
}
```

A new event `conversation_closed` (already exists in v1 protocol per spec — verify) appends to `closedConversations` so the tab updates without a full reload.

#### MiddlePane behavior

When `selectedVisitorId` points to a visitor whose most recent conversation is closed:

1. Show a **History** view: read-only thread of the prior conversation, dimmed, with a "Closed at <time>" header. Above it: visitor display name + lead score + geo. Below it: a "Start new chat" button that opens the existing PingModal.
2. When `selectedVisitorId` points to a still-live visitor with no conversation, the existing v1.6 "preview card" remains.

#### RightPane behavior

Already wired in WIP for `selectedVisitorId`. No changes needed beyond rendering historical visitor data when the visitor is offline (read from `closedConversations` snapshot rather than `liveVisitors`).

#### LeftPane "Left" tab

Renders the union of `leftVisitors` + visitors derived from `closedConversations`, sorted by `last_message_at` (or `leftAt` for live-session leavers without a chat). Each row shows visitor name, last page they were on, last-message preview, time since departure. Tap → select that visitor → MiddlePane shows history.

---

### 3.2 (B) Reliable per-event notifications

#### B1. Push on every visitor arrival

In `server/src/ws/visitor.ts`, after the existing `visitor_appeared` broadcast, add:

```ts
const op = operators.findById(1);
if (shouldPushOperator(op ?? undefined, false)) {
  if (!recentlyPushedFor(visitorId)) {  // 5-min dedupe per visitorId
    pushToOperator(deps, 1, {
      title: 'New visitor on site',
      body: `${displayLabel(visitor)} · ${pathOf(msg.page.url)}`,
      url: `/console/?ping=${visitorId}`,
      tag: `visitor-${visitorId}`,   // SW collapses repeats
      urgency: 'normal',
    }).catch(...);
    markPushed(visitorId, Date.now());
  }
}
```

Dedupe is in-memory: a `Map<visitorId, lastPushAt>` cleared on a 5-min sweep. Reason: a visitor refreshing the page or hopping tabs creates a fresh `hello` each time; we don't want N pushes per visit. The Google-Ads dwell push remains independent — it's a *second* signal ("they stuck around"), not a duplicate of arrival.

Edge case the WIP misses: if the operator has the console focused on desktop, the SW already suppresses the OS notification (per v1.3 design). So this push is a no-op for the desktop case but unblocks the Android-background gap and unfocused-tab desktop case.

#### B2. Reliable desktop audio

Change `notifications.ts`:

- Remove the `document.visibilityState !== 'hidden'` early-return.
- Add `notifyVisitorArrived({ name, page })` — same audio ping, different sound (slightly quieter, 200ms instead of 150ms), title-bar increment is conditional on `hidden`.
- Both audio paths respect a per-tab DND flag: when operator status is `dnd`, no ping.

Audio file: bundle a real ping (`public/ping.mp3`, ~3KB), drop the silent base64 placeholder. Two variants: `ping-message.mp3` (medium ding) + `ping-arrival.mp3` (softer chime).

Browsers block autoplay until first user interaction. The console already has a login flow; trigger an unlock on login click via `audioEl.play().then(() => audioEl.pause()).catch(noop)`. Add a "Test sound" button in settings.

#### B3. Mobile push reliability

Audit + small fixes:

- VAPID payloads: set `urgency: 'high'` for visitor arrival + visitor message (currently default `normal`). High urgency makes Android Chrome wake the SW even in deep doze.
- TTL: set `60` seconds (down from default 4 weeks). Stale leads aren't worth waking the phone hours later.
- 410-cleanup: confirm `pushToOperator` deletes subscriptions on 410. WIP code path uses `web-push` library which surfaces 410 as a thrown error — verify the catch deletes the row.
- Add `lastPushOk` / `lastPushFailReason` columns to `push_subscriptions` for diagnostics. Surface in settings page so the user can see if a device's subscription is rotting.

---

### 3.3 (C) Quick-replies CRUD UI

#### Settings page

New route `/console/#/settings`. Single-page list with:

- "Quick replies" section (other settings live here too — quiet hours, status, devices — already in v1)
- For each reply: label (≤40 chars, shown on chip), body (≤2000 chars, sent as message). Inline edit. Drag to reorder (uses `sort_order`). Trash icon to delete.
- "Add new reply" button → modal with two text inputs.
- "Reset to defaults" button — explicit, *not* automatic. Defaults are seeded for new operators only.

#### New defaults

The v1 defaults the operator dislikes are seeded in the operator-creation path. For v2:

1. Replace the seed list with three short, on-brand defaults written for QI-stage conversations:
   - "👋 Hi! I'm Alex — how can I help with your 1031?"
   - "Happy to walk through your timeline (45/180-day rules) — what's the close date on your relinquished property?"
   - "Want me to text you a quick checklist? Drop your number and I'll send it over."
2. Existing operator (already-seeded with the disliked defaults) gets a one-time admin SQL note in the deploy notes — operator deletes via UI, no backend migration needed since the table is operator-owned.

#### Wire format

Endpoints already exist:
- `GET /api/operator/quick-replies` → `[{ id, label, body, sort_order }]`
- `POST /api/operator/quick-replies { label, body }` → 201 with new row
- `PUT /api/operator/quick-replies/:id { label?, body?, sort_order? }`
- `DELETE /api/operator/quick-replies/:id`

No protocol changes. Console settings page uses these directly.

#### Console state hookup

The existing `quickReplies` signal is the source of truth. After any CRUD call, optimistically update the signal then confirm on response. Compose chips read from this signal; the new settings page reads/writes it.

---

## 4. Out of scope for v2

- AI-suggested replies based on conversation context (v3+).
- Search/filter on `Left` tab (v2.1 if volume warrants).
- Conversation tagging.
- Multi-operator team — still solo.
- HubSpot push of left-visitor conversations.
- Native APK. PWA push fixes in B3 should close the gap; revisit if not.

---

## 5. Acceptance criteria

- [ ] On reload, the **Left** tab shows visitors from the last 24h whose conversations are closed/abandoned/closed_for_followup, populated via `state_snapshot.recentlyClosedConversations`.
- [ ] Selecting a Left-tab visitor shows their prior conversation messages in MiddlePane (read-only) with a "Start new chat" CTA.
- [ ] Right pane shows visitor detail (geo/device/score breakdown/UTMs) for the selected visitor whether they're live, on-site-not-chatting, or in the Left tab.
- [ ] Every new visitor connecting fires a Web Push to the operator (subject to DND/quiet hours), deduped per-visitor for 5 min.
- [ ] Operator on desktop hears an audio ping on every inbound visitor message AND every new-visitor arrival, regardless of whether the console window has focus, when status ≠ DND.
- [ ] Push payloads include `urgency:'high'` + `TTL:60` for visitor-arrival and visitor-message types.
- [ ] Settings page lists all quick replies; operator can add/edit/delete/reorder; CRUD calls hit the existing REST endpoints.
- [ ] New default replies replace the disliked v1 defaults for *new* operator accounts; existing operator can clear current defaults via the settings UI.
- [ ] All v1.5/v1.6 acceptance criteria still pass (regression).
- [ ] Server tests cover: visitor_appeared push fan-out, dedupe window, recentlyClosed snapshot inclusion. Console tests cover: Left-tab hydration, MiddlePane history view, settings CRUD.

---

## 6. Implementation order

1. Land the existing v1.6 WIP first (or rebase it onto a fresh `v2-` branch). Run all tests green, commit, do not deploy yet.
2. (A) Console reducer hydration of `closedConversations` + MiddlePane history view.
3. (B1) Server-side `visitor_appeared` push trigger + dedupe.
4. (B2) Console audio fix + arrival ping.
5. (B3) VAPID urgency/TTL + 410 cleanup audit + diagnostic columns.
6. (C) Settings page quick-replies UI + new defaults.
7. Full test suite, deploy, smoke-test on both desktop and Android PWA.
