import { describe, it, expect, beforeEach } from 'vitest';
import { WidgetUI } from '../src/ui.js';

describe('WidgetUI replay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('replay() restores messages into the panel body', () => {
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    ui.open();
    expect(ui.hasBody()).toBe(true);
    ui.replay([
      { sender: 'visitor', body: 'I have a question' },
      { sender: 'operator', body: 'Happy to help' },
      { sender: 'visitor', body: 'about my exchange' },
    ]);
    const msgs = document.querySelectorAll('.s1031-msg');
    expect(msgs.length).toBe(3);
    expect(msgs[0].textContent).toBe('I have a question');
    expect(msgs[1].textContent).toBe('Happy to help');
    expect(msgs[1].className).toContain('operator');
  });

  it('replay() clears prior body content first', () => {
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    ui.open();
    ui.showMessage({ sender: 'visitor', body: 'first' });
    ui.replay([{ sender: 'operator', body: 'replayed' }]);
    const msgs = document.querySelectorAll('.s1031-msg');
    expect(msgs.length).toBe(1);
    expect(msgs[0].textContent).toBe('replayed');
  });

  it('close + open reuses replay flow (panel rebuilt empty)', () => {
    const ui = new WidgetUI({ onOpen: () => {}, onClose: () => {}, onSend: () => {}, onSubmitCapture: () => {} });
    ui.mount(true);
    ui.open();
    ui.showMessage({ sender: 'visitor', body: 'hi' });
    ui.close();
    ui.open();
    expect(document.querySelectorAll('.s1031-msg').length).toBe(0);
    ui.replay([{ sender: 'visitor', body: 'hi' }, { sender: 'operator', body: 'hello' }]);
    expect(document.querySelectorAll('.s1031-msg').length).toBe(2);
  });
});

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
    const operatorMsgs = document.querySelectorAll('.s1031-msg.operator');
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
