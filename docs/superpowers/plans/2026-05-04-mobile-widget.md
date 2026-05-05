# Mobile Widget UX (v1.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the visitor-side chat widget mobile-friendly: bottom-sheet open layout with three dismiss paths, badge+peek notification for operator pings (no force-open), auto-peek silenced on mobile. Desktop behavior byte-identical to today.

**Architecture:** Single mobile-detection seam (`isMobile()` via `matchMedia('(max-width: 640px)')`) gates all behavior changes inside `WidgetUI`. The class gains a `notifyPing()` method that adds a bubble badge + tap-to-read peek, caches the message body in `pendingPingBody`, and lets `open()` render the cached message when the visitor expands. `renderPanel()` adds a backdrop, drag handle, and dismiss gestures on mobile. `index.ts` branches the `operator_pinged_you` handler so desktop keeps force-open while mobile calls `notifyPing()`.

**Tech Stack:** TypeScript, vanilla DOM, esbuild → IIFE bundle (`dist/chat-widget.js`), Vitest + jsdom.

**Branch:** `v1.5-mobile-widget` (already created off `main` at `d7a4628`; spec already committed at `b54194b`).

**Spec:** `docs/superpowers/specs/2026-05-04-mobile-widget-design.md`

---

## File map

**Created:**
- (none — `widget/tests/ui.test.ts` already exists; we're adding cases to it)

**Modified:**
- `widget/src/styles.ts` — mobile media query rewritten for bottom-sheet layout; backdrop, handle, badge, peek-ping styles added; safe-area-inset on bubble + peek
- `widget/src/ui.ts` — `isMobile()` private, `notifyPing()` public, `attachDismissGestures()` private, `pendingPingBody` field, `backdrop` field, `mount()` skips auto-peek on mobile, `open()` consumes pending ping, `renderPanel()` adds backdrop + handle on mobile, `close()` removes backdrop
- `widget/src/index.ts` — `operator_pinged_you` handler branches by `isMobile()`
- `widget/tests/ui.test.ts` — adds cases for auto-peek mobile suppression, `notifyPing()` behavior, mobile bottom-sheet rendering, backdrop dismiss, `close()` cleanup

---

## Task 1: `isMobile()` private + auto-peek silenced on mobile

**Files:**
- Modify: `widget/src/ui.ts`
- Modify: `widget/tests/ui.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `widget/tests/ui.test.ts` after the existing `describe('WidgetUI replay', ...)` block:

```typescript
describe('WidgetUI mobile auto-peek', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function mockMatchMedia(matches: boolean) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches,
        media: query,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  it('mount() creates the auto-peek on desktop (matchMedia: false)', () => {
    mockMatchMedia(false);
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    expect(document.querySelector('.s1031-peek')).not.toBeNull();
  });

  it('mount() does NOT create the auto-peek on mobile (matchMedia: true)', () => {
    mockMatchMedia(true);
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    expect(document.querySelector('.s1031-peek')).toBeNull();
    expect(document.querySelector('.s1031-bubble')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npx vitest run tests/ui.test.ts`
Expected: The "does NOT create" test fails — the peek is created unconditionally today.

- [ ] **Step 3: Modify `widget/src/ui.ts`**

3a. Add a private method to the `WidgetUI` class (place it as the LAST private method, after `renderEmailOnFile`):

```typescript
  private isMobile(): boolean {
    return window.matchMedia('(max-width: 640px)').matches;
  }
```

3b. Modify the `mount()` method. Locate the existing peek-creation block:

```typescript
    this.peek = document.createElement('div');
    this.peek.className = 's1031-peek';
    this.peek.textContent = '👋 Hi! Have a question about your 1031?';
    this.peek.onclick = () => this.open();
    document.body.appendChild(this.peek);
    setTimeout(() => this.peek?.remove(), 10000);
```

Wrap it in a desktop-only guard:

```typescript
    if (!this.isMobile()) {
      this.peek = document.createElement('div');
      this.peek.className = 's1031-peek';
      this.peek.textContent = '👋 Hi! Have a question about your 1031?';
      this.peek.onclick = () => this.open();
      document.body.appendChild(this.peek);
      setTimeout(() => this.peek?.remove(), 10000);
    }
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npx vitest run tests/ui.test.ts`
Expected: PASS (5 tests in this file: 3 existing + 2 new).

- [ ] **Step 5: Run full widget test suite**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npm test`
Expected: PASS — 16 tests (14 existing + 2 new).

- [ ] **Step 6: Commit**

```bash
git -C C:/Users/alexa/code/tidio-remake add widget/src/ui.ts widget/tests/ui.test.ts
git -C C:/Users/alexa/code/tidio-remake commit -m "v1.5: silence auto-peek on mobile (matchMedia 640px)"
```

---

## Task 2: Mobile styles — bottom sheet, backdrop, handle, badge, safe area

**Files:**
- Modify: `widget/src/styles.ts`

No automated tests — style changes are validated manually per repo convention. The build and existing tests must still pass after this task.

- [ ] **Step 1: Replace the existing mobile media query block**

Locate the current block in `widget/src/styles.ts` (lines 55-58):

```css
@media (max-width: 480px) {
  .s1031-panel { width: calc(100vw - 16px); right: 8px; bottom: 8px; max-height: calc(100vh - 16px); height: calc(100vh - 16px); }
  .s1031-bubble { right: 12px; bottom: 12px; }
}
```

Replace with:

```css
@media (max-width: 640px) {
  .s1031-bubble {
    right: 12px;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  }
  .s1031-peek {
    right: 12px;
    bottom: calc(82px + env(safe-area-inset-bottom, 0px));
  }
  .s1031-panel {
    left: 0; right: 0; bottom: 0;
    width: 100vw;
    height: min(80vh, 600px);
    max-height: 80vh;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -8px 32px rgba(0,0,0,0.2);
    animation: s1031-slide-up 220ms cubic-bezier(0.32, 0.72, 0, 1);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .s1031-close {
    width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
  }
}
@keyframes s1031-slide-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
```

- [ ] **Step 2: Add new component styles to the CSS string**

Insert these rules INSIDE the backtick-delimited `STYLES` template, immediately AFTER the existing `.s1031-bubble.s1031-pulse` line and BEFORE the `@keyframes s1031pulse` line:

```css
.s1031-bubble-badge {
  position: absolute;
  top: -2px; right: -2px;
  width: 14px; height: 14px;
  background: #ef4444;
  border-radius: 50%;
  border: 2px solid white;
  pointer-events: none;
}
.s1031-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 2147483646;
  animation: s1031-fade-in 220ms ease-out;
}
@keyframes s1031-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.s1031-handle {
  height: 16px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  cursor: grab;
  touch-action: none;
}
.s1031-handle > div {
  width: 36px; height: 4px;
  background: #cbd5e1;
  border-radius: 2px;
}
.s1031-peek.s1031-peek-ping { width: 240px; }
.s1031-peek-name {
  font-weight: 700;
  color: #2563eb;
  font-size: 11px;
  margin-bottom: 2px;
}
.s1031-peek-body {
  color: #0f172a;
  font-size: 13px;
  line-height: 1.4;
}
.s1031-peek-cta {
  color: #64748b;
  font-size: 10px;
  margin-top: 4px;
}
```

The `.s1031-bubble` rule already exists in the desktop section; the bubble itself needs `position: fixed` (it has it) and the badge is positioned `absolute` against it — but `position: fixed` only forms a containing block for `position: fixed` children. Confirm by reading the existing rule: `position: fixed` makes `.s1031-bubble` itself the containing block for absolute children because its position is non-static. The badge will anchor correctly.

- [ ] **Step 3: Run full widget test suite**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npm test`
Expected: PASS — 16 tests still green (no behavior changed yet).

- [ ] **Step 4: Build the widget**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npm run build`
Expected: clean build, `dist/chat-widget.js` produced.

- [ ] **Step 5: Commit**

```bash
git -C C:/Users/alexa/code/tidio-remake add widget/src/styles.ts
git -C C:/Users/alexa/code/tidio-remake commit -m "v1.5: mobile styles — bottom sheet, backdrop, handle, badge, safe area"
```

---

## Task 3: `notifyPing()` method + `pendingPingBody` consumption in `open()`

**Files:**
- Modify: `widget/src/ui.ts`
- Modify: `widget/tests/ui.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `widget/tests/ui.test.ts` (after the `describe('WidgetUI mobile auto-peek', ...)` block):

```typescript
describe('WidgetUI notifyPing (mobile operator-ping landing)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: true,
        media: query,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  it('notifyPing() adds a badge to the bubble', () => {
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    ui.notifyPing('Hey, want to chat?');
    expect(document.querySelector('.s1031-bubble-badge')).not.toBeNull();
    expect(document.querySelector('.s1031-bubble')).not.toBeNull();
  });

  it('notifyPing() creates a ping peek with the message preview', () => {
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    ui.notifyPing('Hey, want to chat about your 1031?');
    const peek = document.querySelector('.s1031-peek-ping');
    expect(peek).not.toBeNull();
    expect(peek!.textContent).toContain('Hey, want to chat about your 1031?');
  });

  it('notifyPing() does NOT call onOpen', () => {
    let opened = false;
    const ui = new WidgetUI({ onOpen: () => { opened = true; }, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    ui.notifyPing('Hello');
    expect(opened).toBe(false);
  });

  it('notifyPing() then open() renders system + operator messages', () => {
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    ui.notifyPing('Want help with your exchange?');
    ui.open();
    const systemMsgs = document.querySelectorAll('.s1031-system');
    const operatorMsgs = document.querySelectorAll('.s1031-msg.operator');
    // Body has welcome system msg + ping system msg (the auto welcome only appears when the body is empty,
    // so when openning after notifyPing it skips the auto welcome).
    const allText = Array.from(document.querySelectorAll('.s1031-system, .s1031-msg')).map(e => e.textContent).join('|');
    expect(allText).toContain('Alex jumped in to help');
    expect(allText).toContain('Want help with your exchange?');
    expect(operatorMsgs.length).toBe(1);
    expect(operatorMsgs[0].textContent).toBe('Want help with your exchange?');
  });

  it('notifyPing() truncates long messages with ellipsis in the peek', () => {
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    const longBody = 'a'.repeat(200);
    ui.notifyPing(longBody);
    const peekBody = document.querySelector('.s1031-peek-body');
    expect(peekBody).not.toBeNull();
    expect(peekBody!.textContent!.length).toBeLessThanOrEqual(82); // 80 chars + '…'
    expect(peekBody!.textContent!.endsWith('…')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npx vitest run tests/ui.test.ts -t "notifyPing"`
Expected: FAIL — `ui.notifyPing` is not a function.

- [ ] **Step 3: Modify `widget/src/ui.ts`**

3a. Add a new instance field next to the existing private fields (top of the class):

```typescript
  private pendingPingBody?: string;
```

3b. Add the public `notifyPing()` method after `setKnownEmail`:

```typescript
  notifyPing(body: string, operatorName: string = 'Alex'): void {
    this.pendingPingBody = body;

    // Add badge to the existing bubble (idempotent)
    if (this.bubble && !this.bubble.querySelector('.s1031-bubble-badge')) {
      const badge = document.createElement('div');
      badge.className = 's1031-bubble-badge';
      this.bubble.appendChild(badge);
    }

    // Replace any existing peek with a tap-to-read ping peek
    this.peek?.remove();
    const truncated = body.length > 80 ? body.slice(0, 80) + '…' : body;
    this.peek = document.createElement('div');
    this.peek.className = 's1031-peek s1031-peek-ping';
    this.peek.innerHTML = `
      <div class="s1031-peek-name">${escapeHtml(operatorName)} from Simple 1031</div>
      <div class="s1031-peek-body">${escapeHtml(truncated)}</div>
      <div class="s1031-peek-cta">Tap to read →</div>
    `;
    this.peek.onclick = () => this.open();
    document.body.appendChild(this.peek);
    setTimeout(() => this.peek?.remove(), 30000);
  }
```

3c. Modify `open()` to consume `pendingPingBody`. Locate the current `open()` method:

```typescript
  open() {
    if (this.phase !== 'closed') return;
    this.peek?.remove();
    this.bubble?.remove();
    this.phase = 'chat';
    this.handlers.onOpen();
    this.renderPanel();
  }
```

Replace with:

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

3d. The auto-welcome system message in `renderPanel()` checks `if (this.body.childElementCount === 0)`. Because `open()` calls `renderPanel()` BEFORE pushing the ping messages, the auto-welcome will fire first, then the ping system + operator messages. This is the desired order for a pinged conversation: visitor sees both the generic "We usually reply within a few minutes…" line AND the "Alex jumped in" + actual operator message.

If you'd rather suppress the auto-welcome when there's a pending ping, modify `renderPanel()`. The plan KEEPS the auto-welcome for now — it provides reassurance and is short. Test 4 above is written to be resilient: it asserts the system and operator content is present, not the count of system messages.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npx vitest run tests/ui.test.ts -t "notifyPing"`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run full widget suite**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npm test`
Expected: PASS — 21 tests (16 + 5 new).

- [ ] **Step 6: Commit**

```bash
git -C C:/Users/alexa/code/tidio-remake add widget/src/ui.ts widget/tests/ui.test.ts
git -C C:/Users/alexa/code/tidio-remake commit -m "v1.5: notifyPing() — bubble badge + peek for operator pings (no force-open)"
```

---

## Task 4: Bottom-sheet rendering — backdrop + handle + mobile class

**Files:**
- Modify: `widget/src/ui.ts`
- Modify: `widget/tests/ui.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `widget/tests/ui.test.ts`:

```typescript
describe('WidgetUI mobile bottom-sheet rendering', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function setMobile(matches: boolean) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (q: string) => ({
        matches, media: q,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  it('open() on mobile creates a backdrop element', () => {
    setMobile(true);
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    ui.open();
    expect(document.querySelector('.s1031-backdrop')).not.toBeNull();
  });

  it('open() on mobile adds a drag handle to the panel', () => {
    setMobile(true);
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    ui.open();
    expect(document.querySelector('.s1031-panel .s1031-handle')).not.toBeNull();
  });

  it('open() on mobile adds the s1031-panel-mobile class', () => {
    setMobile(true);
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    ui.open();
    const panel = document.querySelector('.s1031-panel');
    expect(panel).not.toBeNull();
    expect(panel!.classList.contains('s1031-panel-mobile')).toBe(true);
  });

  it('open() on desktop does NOT create backdrop, handle, or mobile class', () => {
    setMobile(false);
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    ui.open();
    expect(document.querySelector('.s1031-backdrop')).toBeNull();
    expect(document.querySelector('.s1031-handle')).toBeNull();
    const panel = document.querySelector('.s1031-panel');
    expect(panel!.classList.contains('s1031-panel-mobile')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npx vitest run tests/ui.test.ts -t "bottom-sheet"`
Expected: FAIL — backdrop and handle don't exist yet.

- [ ] **Step 3: Modify `widget/src/ui.ts`**

3a. Add a new field to the class (near the other private DOM fields):

```typescript
  private backdrop?: HTMLDivElement;
```

3b. Modify `renderPanel()`. Locate the current method body. Replace it entirely with:

```typescript
  private renderPanel() {
    const mobile = this.isMobile();
    if (mobile) {
      this.backdrop = document.createElement('div');
      this.backdrop.className = 's1031-backdrop';
      this.backdrop.onclick = () => this.close();
      document.body.appendChild(this.backdrop);
    }

    this.panel = document.createElement('div');
    this.panel.className = 's1031-panel' + (mobile ? ' s1031-panel-mobile' : '');
    const handleHTML = mobile ? '<div class="s1031-handle"><div></div></div>' : '';
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
```

(Body of the method is the same as today, with the new mobile branch at the top, the conditional `s1031-panel-mobile` class, and the conditional handle prepended.)

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npx vitest run tests/ui.test.ts`
Expected: PASS — 25 tests (21 + 4 new). Some existing tests use `ui.mount(true); ui.open();` without setting matchMedia. jsdom's default `window.matchMedia` is undefined; that would make `isMobile()` throw. Mitigation: add a global default in `beforeEach` of the existing `WidgetUI replay` describe block, OR make `isMobile()` defensive. Choose the latter — modify `isMobile()` to:

```typescript
  private isMobile(): boolean {
    return typeof window.matchMedia === 'function'
      && window.matchMedia('(max-width: 640px)').matches;
  }
```

(This also handles non-browser environments — required by spec section "Architecture", `isMobile` should be safe to call anywhere.)

After this defensive update, re-run the full suite.

- [ ] **Step 5: Run full widget suite**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npm test`
Expected: PASS, 25 tests green.

- [ ] **Step 6: Commit**

```bash
git -C C:/Users/alexa/code/tidio-remake add widget/src/ui.ts widget/tests/ui.test.ts
git -C C:/Users/alexa/code/tidio-remake commit -m "v1.5: mobile renderPanel — backdrop + handle + s1031-panel-mobile class"
```

---

## Task 5: Backdrop dismiss + `close()` removes backdrop

**Files:**
- Modify: `widget/src/ui.ts`
- Modify: `widget/tests/ui.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `widget/tests/ui.test.ts`:

```typescript
describe('WidgetUI mobile dismiss', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (q: string) => ({
        matches: true, media: q,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  it('clicking the backdrop closes the panel', () => {
    let closed = false;
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => { closed = true; }, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    ui.open();
    const backdrop = document.querySelector('.s1031-backdrop') as HTMLElement;
    backdrop.click();
    expect(closed).toBe(true);
    expect(document.querySelector('.s1031-panel')).toBeNull();
  });

  it('close() removes the backdrop from DOM', () => {
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    ui.open();
    expect(document.querySelector('.s1031-backdrop')).not.toBeNull();
    ui.close();
    expect(document.querySelector('.s1031-backdrop')).toBeNull();
  });

  it('close() then open() recreates the backdrop fresh', () => {
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    ui.open();
    ui.close();
    ui.open();
    expect(document.querySelectorAll('.s1031-backdrop').length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npx vitest run tests/ui.test.ts -t "mobile dismiss"`
Expected: FAIL on the close() tests — current `close()` doesn't remove the backdrop. The "clicking the backdrop closes" test should PASS (Task 4 already wired the onclick), but if Task 4 only set up the handler and `close()` leaves the backdrop in DOM, the panel-removal assertion may pass while the backdrop assertion in the next test fails.

- [ ] **Step 3: Modify `widget/src/ui.ts` — `close()` method**

Locate the current `close()` method:

```typescript
  close() {
    this.panel?.remove();
    this.phase = 'closed';
    this.mount(this.operatorOnline);
    this.handlers.onClose();
  }
```

Replace with:

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

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npx vitest run tests/ui.test.ts`
Expected: PASS — 28 tests (25 + 3 new).

- [ ] **Step 5: Commit**

```bash
git -C C:/Users/alexa/code/tidio-remake add widget/src/ui.ts widget/tests/ui.test.ts
git -C C:/Users/alexa/code/tidio-remake commit -m "v1.5: backdrop click + close() removes backdrop"
```

---

## Task 6: Drag-to-dismiss gesture (no automated test — manual)

**Files:**
- Modify: `widget/src/ui.ts`

Per the spec: drag-gesture testing is intentionally skipped at the unit level. Touch event dispatching in jsdom is unreliable. We add the implementation and verify on real devices.

- [ ] **Step 1: Add `attachDismissGestures()` private method**

Add to `WidgetUI` after the existing private methods:

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
      if (e.touches.length !== 1) return;
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

    grabbable.addEventListener('touchcancel', () => {
      if (!dragging) return;
      dragging = false;
      panel.style.transition = '';
      panel.style.transform = '';
    });
  }
```

- [ ] **Step 2: Wire it into `renderPanel()`**

In `renderPanel()`, after the `if (this.body.childElementCount === 0) { ... }` welcome block (i.e., at the very end of the method), add:

```typescript
    if (mobile) this.attachDismissGestures(this.panel);
```

- [ ] **Step 3: Run full widget suite**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npm test`
Expected: PASS — 28 tests still green (no new tests; behavior change is touch-only and not unit-tested).

- [ ] **Step 4: Build the widget**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npm run build`
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git -C C:/Users/alexa/code/tidio-remake add widget/src/ui.ts
git -C C:/Users/alexa/code/tidio-remake commit -m "v1.5: attachDismissGestures — drag-down to dismiss bottom sheet"
```

---

## Task 7: `index.ts` — branch `operator_pinged_you` by `isMobile()`

**Files:**
- Modify: `widget/src/index.ts`

No automated test — `index.ts` has no existing test coverage and adding a harness for it is out of scope. Behavior is verified via Task 3's `notifyPing()` tests + manual smoke.

- [ ] **Step 1: Modify `widget/src/index.ts`**

Locate the `case 'operator_pinged_you':` block in the WS message switch:

```typescript
        case 'operator_pinged_you':
          ui.open();
          ui.showMessage({ sender: 'system', body: '🔔 Alex jumped in to help' });
          ui.showMessage({ sender: 'operator', body: m.body });
          appendToStore('system', '🔔 Alex jumped in to help');
          appendToStore('operator', m.body);
          break;
```

Replace with:

```typescript
        case 'operator_pinged_you': {
          const isMobile = typeof window.matchMedia === 'function'
            && window.matchMedia('(max-width: 640px)').matches;
          if (isMobile) {
            ui.notifyPing(m.body);
          } else {
            ui.open();
            ui.showMessage({ sender: 'system', body: '🔔 Alex jumped in to help' });
            ui.showMessage({ sender: 'operator', body: m.body });
          }
          appendToStore('system', '🔔 Alex jumped in to help');
          appendToStore('operator', m.body);
          break;
        }
```

(Both branches `appendToStore` so the message survives a page reload — the visitor's `ConvStore` rehydrates messages on next mount via the existing `replay()` flow.)

- [ ] **Step 2: Run full widget suite**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npm test`
Expected: PASS — 28 tests still green.

- [ ] **Step 3: Build the widget**

Run: `cd C:\Users\alexa\code\tidio-remake\widget; npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git -C C:/Users/alexa/code/tidio-remake add widget/src/index.ts
git -C C:/Users/alexa/code/tidio-remake commit -m "v1.5: operator_pinged_you branches — notifyPing on mobile, force-open on desktop"
```

---

## Final integration checks (after all tasks)

After Task 7 completes:

- Run `cd C:\Users\alexa\code\tidio-remake\widget; npm test` — expect 28 tests green
- Run `cd C:\Users\alexa\code\tidio-remake\server; npm test` — expect 154 tests green (no server changes; sanity check)
- Run `cd C:\Users\alexa\code\tidio-remake\console; npm test` — expect 110 tests green (no console changes; sanity check)
- Run `cd C:\Users\alexa\code\tidio-remake\widget; npm run build` — clean build
- Push the branch and open a PR

Manual smoke (after PR merge + deploy):

1. iPhone Safari: visit a page with the widget. Bubble visible above home indicator. NO auto-peek appears.
2. Tap bubble → bottom sheet rises with drag handle, dimmed backdrop. Conversation area scrolls; composer doesn't.
3. Drag the handle down past 80px → sheet animates closed, backdrop fades, bubble reappears.
4. Re-open → tap the dimmed backdrop → sheet closes.
5. Re-open → focus the input → keyboard rises, sheet stays usable.
6. Operator console: ping the visitor. Phone shows the bubble with a red dot + a peek with the operator's message preview. Page is still scrollable.
7. Tap the peek → sheet opens with system "Alex jumped in" line + operator message.
8. Android Chrome: same checks.
9. Desktop Chrome at >640px wide: bubble + auto-peek + force-open on operator ping all work as before.
10. Desktop Chrome resized below 640px: gets mobile treatment — confirms breakpoint handling.

These are not numbered tasks because they're verification, not implementation work.
