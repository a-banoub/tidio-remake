# Mobile Widget UX (v1.5) — Design

**Status:** Approved
**Date:** 2026-05-04
**Branch:** `v1.5-mobile-widget`

## Problem

The visitor-side chat widget on `chat.simple1031x.com` is functional on desktop but hostile on mobile:

1. **Takeover layout.** The open panel is `calc(100vw - 16px)` wide and `calc(100vh - 16px)` tall — effectively full-screen — with only a small "X" in the header to dismiss. No backdrop, no drag-down, no obvious escape.
2. **Force-open on operator ping.** When the operator initiates a chat (`operator_pinged_you` WS event), the widget calls `ui.open()` and shoves the full panel in front of the visitor. On mobile this is the entire screen, unsolicited. This is a rage trigger.
3. **Auto-peek nag.** Ten seconds after every page load, the widget pops a "👋 Hi! Have a question about your 1031?" peek beside the bubble. On mobile that bubble can overlap a primary CTA.
4. **No safe-area handling.** The bubble sits at `bottom: 16px` regardless of the iPhone home-indicator, which can leave it visually colliding with the system gesture bar.

These issues compound: a mobile visitor sees an unsolicited peek, then if the operator pings them, gets a screen takeover with one tiny escape hatch.

## Solution

Three coordinated changes, gated by a single `isMobile()` check:

1. **Auto-peek removed on mobile.** The bubble alone is the only entry point. Visitor decides when to engage.
2. **Operator pings become notifications, not takeovers.** On mobile the widget no longer calls `ui.open()` for `operator_pinged_you`. Instead it adds a red badge to the bubble and renders a peek with a preview of the operator's message. Visitor taps to expand. Desktop behavior is unchanged.
3. **Open panel becomes a bottom sheet.** Slides up from the bottom over a dimmed backdrop, with three dismiss paths: drag the handle down, tap the backdrop, or tap the X. Respects iPhone home-indicator via `env(safe-area-inset-bottom)`.

## Goals

- **G1.** Mobile visitors never have the chat panel forced open by the server.
- **G2.** When a mobile visitor opens chat, dismissing it is obvious (drag-down, tap-backdrop, or X).
- **G3.** Operators retain the ability to ping mobile visitors — the message and the "Alex jumped in" system line are queued and rendered when the visitor opens chat from a notification peek.
- **G4.** Bubble and sheet respect iOS safe areas (home indicator).
- **G5.** Desktop behavior is byte-identical to today's behavior.

## Non-goals

- Tablet-specific treatment. Tablets (>640px) get the desktop layout.
- Theming, color, or font changes.
- Push notifications to the visitor's phone (out of scope; operator-side push handled by v1.3/v1.4).
- A11y audit. We're not regressing what's there but a full audit is a separate effort.
- Service-worker interaction with the widget.
- Replacing the auto-peek on desktop.

## Mobile detection

```typescript
function isMobile(): boolean {
  return window.matchMedia('(max-width: 640px)').matches;
}
```

- **Breakpoint chosen:** 640px (wider than the existing 480px). Catches iPhone Pro Max (430px), foldables, and landscape iPhone SE (also 568×320 so still under 640). Tablets (iPad ≥768px) get desktop.
- Re-evaluated on every call (not cached) so device rotation works.
- No User-Agent sniffing.

## Architecture

### Files

**Modified:**
- `widget/src/styles.ts` — significantly rewritten mobile styles
- `widget/src/ui.ts` — new methods, mobile-aware mount, sheet gestures
- `widget/src/index.ts` — `operator_pinged_you` branches by `isMobile()`

**Added:**
- `widget/tests/ui.test.ts` — unit tests for new behaviors

### `widget/src/styles.ts`

Replaces the existing `@media (max-width: 480px)` block with a `@media (max-width: 640px)` block that defines:

- `.s1031-bubble` — position respects `env(safe-area-inset-bottom)` via `bottom: calc(16px + env(safe-area-inset-bottom, 0px))`. Adds `.s1031-bubble-badge` rule for the red dot.
- `.s1031-peek` — keeps existing positioning but bottom uses the same safe-area calc.
- `.s1031-backdrop` — new fixed full-viewport overlay, `rgba(0,0,0,0.4)`, `z-index: 2147483646` (one below the panel).
- `.s1031-panel` — bottom-sheet treatment: `bottom: 0; right: 0; left: 0; width: 100vw; height: min(80vh, 600px); border-radius: 16px 16px 0 0; box-shadow: 0 -8px 32px rgba(0,0,0,0.2);`. The current full-screen rule is removed.
- `.s1031-handle` — new top section with a 36×4px gray pill, 16px tall, `flex-shrink: 0`.
- `.s1031-header` keeps existing styles. The X-close button is enlarged to 32×32px touch target on mobile (existing 20px font / 4px padding is too small for thumbs).

The animation `s1031-slide-up` is added: a 200ms cubic-bezier(0.32, 0.72, 0, 1) translate from `transform: translateY(100%)` to `translateY(0)`. Used on panel mount on mobile. Backdrop fades in with `opacity` 0→1 over the same 200ms.

The badge: `.s1031-bubble-badge { position: absolute; top: -2px; right: -2px; width: 14px; height: 14px; background: #ef4444; border-radius: 50%; border: 2px solid white; }`.

### `widget/src/ui.ts`

New private helper:

```typescript
private isMobile(): boolean {
  return window.matchMedia('(max-width: 640px)').matches;
}
```

`mount()` becomes:

```typescript
mount(operatorOnline: boolean) {
  this.operatorOnline = operatorOnline;
  this.bubble = document.createElement('div');
  this.bubble.className = 's1031-bubble s1031-pulse';
  this.bubble.textContent = '💬';
  this.bubble.onclick = () => this.open();
  document.body.appendChild(this.bubble);

  // Auto-peek: desktop only
  if (!this.isMobile()) {
    this.peek = document.createElement('div');
    this.peek.className = 's1031-peek';
    this.peek.textContent = '👋 Hi! Have a question about your 1031?';
    this.peek.onclick = () => this.open();
    document.body.appendChild(this.peek);
    setTimeout(() => this.peek?.remove(), 10000);
  }
}
```

New method for the operator-ping landing on mobile:

```typescript
notifyPing(body: string, operatorName = 'Alex') {
  // Cache so the visitor sees the message + system line when they open chat
  this.pendingPingBody = body;

  // Add badge to existing bubble (don't recreate)
  if (this.bubble && !this.bubble.querySelector('.s1031-bubble-badge')) {
    const badge = document.createElement('div');
    badge.className = 's1031-bubble-badge';
    this.bubble.appendChild(badge);
  }

  // Replace any existing peek with a tap-to-read peek
  this.peek?.remove();
  this.peek = document.createElement('div');
  this.peek.className = 's1031-peek s1031-peek-ping';
  this.peek.innerHTML = `
    <div class="s1031-peek-name">${operatorName} from Simple 1031</div>
    <div class="s1031-peek-body">${escapeHtml(body.slice(0, 80))}${body.length > 80 ? '…' : ''}</div>
    <div class="s1031-peek-cta">Tap to read →</div>
  `;
  this.peek.onclick = () => this.open();
  document.body.appendChild(this.peek);
  // Persist longer than auto-peek (30s)
  setTimeout(() => this.peek?.remove(), 30000);
}
```

`open()` is modified to consume `pendingPingBody`:

```typescript
open() {
  if (this.phase !== 'closed') return;
  this.peek?.remove();
  this.bubble?.remove();
  this.phase = 'chat';
  this.handlers.onOpen();
  this.renderPanel();
  if (this.pendingPingBody) {
    this.showMessage({ sender: 'system', body: '🔔 Alex jumped in to help' });
    this.showMessage({ sender: 'operator', body: this.pendingPingBody });
    this.pendingPingBody = undefined;
  }
}
```

`renderPanel()` adds a backdrop on mobile, drags the panel up, and wires dismissal gestures:

```typescript
private renderPanel() {
  if (this.isMobile()) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 's1031-backdrop';
    this.backdrop.onclick = () => this.close();
    document.body.appendChild(this.backdrop);
  }

  this.panel = document.createElement('div');
  this.panel.className = 's1031-panel' + (this.isMobile() ? ' s1031-panel-mobile' : '');

  const handleHTML = this.isMobile() ? '<div class="s1031-handle"><div></div></div>' : '';
  this.panel.innerHTML = handleHTML + `
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

  if (this.isMobile()) this.attachDismissGestures(this.panel);

  // ... rest unchanged: body wiring, close button, send button, focus, system message
}
```

New private method:

```typescript
private attachDismissGestures(panel: HTMLDivElement) {
  const handle = panel.querySelector('.s1031-handle') as HTMLElement | null;
  const header = panel.querySelector('.s1031-header') as HTMLElement | null;
  const grabbable = handle ?? header;
  if (!grabbable) return;

  let startY = 0;
  let currentY = 0;
  let dragging = false;
  const DISMISS_THRESHOLD = 80;

  grabbable.addEventListener('touchstart', (e) => {
    dragging = true;
    startY = e.touches[0].clientY;
    currentY = startY;
    panel.style.transition = 'none';
  }, { passive: true });

  grabbable.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    const dy = Math.max(0, currentY - startY);
    panel.style.transform = `translateY(${dy}px)`;
  }, { passive: true });

  grabbable.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    panel.style.transition = '';
    if (currentY - startY >= DISMISS_THRESHOLD) {
      this.close();
    } else {
      panel.style.transform = '';
    }
  });
}
```

`close()` also removes the backdrop:

```typescript
close() {
  this.panel?.remove();
  this.backdrop?.remove();
  this.backdrop = undefined;
  this.phase = 'closed';
  this.mount(this.operatorOnline);
  this.handlers.onClose();
}
```

New instance fields on `WidgetUI`: `private backdrop?: HTMLDivElement`, `private pendingPingBody?: string`.

### `widget/src/index.ts`

Single change in the `operator_pinged_you` handler:

```typescript
case 'operator_pinged_you':
  if (window.matchMedia('(max-width: 640px)').matches) {
    ui.notifyPing(m.body);
    appendToStore('system', '🔔 Alex jumped in to help');
    appendToStore('operator', m.body);
  } else {
    ui.open();
    ui.showMessage({ sender: 'system', body: '🔔 Alex jumped in to help' });
    ui.showMessage({ sender: 'operator', body: m.body });
    appendToStore('system', '🔔 Alex jumped in to help');
    appendToStore('operator', m.body);
  }
  break;
```

(Both branches `appendToStore` so a future page-load reload renders the ping. The mobile branch defers the in-DOM render to when the visitor taps to open.)

## Testing

### Unit tests (`widget/tests/ui.test.ts`)

- `mount()` does NOT create the auto-peek when `matchMedia('(max-width: 640px)')` is true.
- `mount()` DOES create the auto-peek when `matchMedia` matches false.
- `notifyPing(body)` adds a `.s1031-bubble-badge` element to the bubble and creates a `.s1031-peek-ping` element. It does NOT call `open()` (verifiable via the `onOpen` handler not firing).
- `notifyPing(body)` then `open()` causes the body to render the system message + the ping body.
- `close()` removes the backdrop element from the DOM.
- Backdrop click triggers `close()` (use `dispatchEvent(new MouseEvent('click'))` on the backdrop).

Drag-gesture testing is intentionally omitted from unit tests — touchstart/touchmove/touchend in jsdom is fragile. We verify it manually on devices.

### Manual smoke (production)

After deploy:
- iPhone Safari: bubble sits visibly above the home indicator. Tap → bottom sheet rises with drag handle. Drag handle down past 80px → sheet animates closed. Tap the dimmed backdrop → sheet closes.
- iPhone Safari: while open, focus the input → keyboard rises, sheet stays usable (the system handles this for a `position: fixed` element).
- Android Chrome: same checks.
- Operator console: ping a phone-side visitor. Phone shows red badge + peek with preview (NOT a forced-open panel). Tap peek → sheet opens with system line + operator message.
- Desktop Chrome: behavior unchanged. Bubble + auto-peek + force-open on ping all still work as today.

## Migration / rollout

- No DB migration.
- No server changes.
- Pure widget rebuild + redeploy.
- Existing visitors with `s1031_visitor_id` cookies are unaffected.
- The widget script is `https://chat.simple1031x.com/widget/chat-widget.js` — a single page reload picks up the new build.

## Risks

1. **Touch-gesture drag fights with iOS Safari's overscroll.** Mitigation: the panel uses `position: fixed` and we only listen on the handle/header (not the body), so the body's normal scroll behavior is untouched.
2. **`env(safe-area-inset-bottom)` not supported in older browsers.** Mitigation: the `calc()` fallback `env(safe-area-inset-bottom, 0px)` returns 0px on browsers that don't recognize `env`, identical to current behavior.
3. **Operator pings the visitor multiple times.** The current behavior in the code is that successive operator messages on a non-pinged conversation arrive as plain `operator_message` events; only the FIRST operator message in an operator-initiated conversation is `operator_pinged_you`. So `notifyPing` runs at most once per conversation. We don't need de-dup logic.
4. **Visitor on a desktop with a narrow window (≤640px).** They get the mobile treatment. This is intentional — narrow desktop windows want the same UX. If this becomes annoying we can add an additional `pointer: coarse` check; deferred.

## Files

**Added:**
- `widget/tests/ui.test.ts`
- `docs/superpowers/specs/2026-05-04-mobile-widget-design.md` (this file)

**Modified:**
- `widget/src/styles.ts` — mobile media query rewritten; backdrop, handle, badge, sheet animation, safe-area styles added
- `widget/src/ui.ts` — `isMobile()`, `notifyPing()`, `attachDismissGestures()`, backdrop removal in `close()`, new fields
- `widget/src/index.ts` — `operator_pinged_you` branches mobile vs desktop
