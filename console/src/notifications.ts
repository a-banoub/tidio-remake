// In-page audio + title-bar feedback for visitor events.
//
// Audio: synthesized via Web Audio API (no binary assets). Plays on every
// visitor message AND every visitor arrival when operator status != DND,
// regardless of console window focus.
//
// Title flash: only when the tab is hidden (otherwise we'd just rewrite the
// title repeatedly while the operator is looking at it).

let audioCtx: AudioContext | null = null;
let originalTitle: string | null = null;
let unread = 0;
let operatorStatusLocal: 'online' | 'away' | 'dnd' = 'online';

export function setOperatorStatusForNotifications(s: 'online' | 'away' | 'dnd') {
  operatorStatusLocal = s;
}

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  const Ctor: typeof AudioContext | undefined =
    (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

// Call from a user gesture (login button) so subsequent ping plays succeed
// in autoplay-restricted browsers.
export function unlockAudio() {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
}

function playTone(freq: number, durationMs: number, volume: number) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = volume;
    // Short fade-out to avoid click at the end
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  } catch {}
}

export function notifyVisitorMessage(_opts: { name?: string | null; body: string }) {
  if (operatorStatusLocal === 'dnd') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    unread++;
    flashTitle();
  }
  playTone(880, 150, 0.4);
}

export function notifyVisitorArrived(_opts: { name?: string | null; page: string }) {
  if (operatorStatusLocal === 'dnd') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    unread++;
    flashTitle();
  }
  playTone(523, 200, 0.25);
}

function flashTitle() {
  if (typeof document === 'undefined') return;
  if (originalTitle === null) originalTitle = document.title;
  document.title = `(${unread}) ${originalTitle}`;
}

export function clearUnread() {
  unread = 0;
  if (originalTitle !== null && typeof document !== 'undefined') {
    document.title = originalTitle;
  }
}

export function _resetForTests() {
  audioCtx = null;
  originalTitle = null;
  unread = 0;
  operatorStatusLocal = 'online';
}
