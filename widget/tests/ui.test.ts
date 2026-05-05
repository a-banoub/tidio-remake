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
