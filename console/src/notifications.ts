// In-page feedback for inbound visitor messages.
//
// OS-level notifications come from the service worker's push handler, which
// fires for every message regardless of which device is online. This module
// only handles in-page affordances: ping sound + title-bar unread count.
// We deliberately don't call `new Notification(...)` here anymore — that
// used to double-fire alongside the SW push notification.

const SOUND_DATA_URL =
  'data:audio/wav;base64,UklGRoQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YWAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=';

let audioEl: HTMLAudioElement | null = null;
let originalTitle: string | null = null;
let unread = 0;

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export function notifyVisitorMessage(_opts: { name?: string | null; body: string }) {
  if (typeof document === 'undefined') return;
  if (document.visibilityState !== 'hidden') return;
  unread++;
  flashTitle();
  playPing();
}

function playPing() {
  try {
    if (!audioEl) {
      audioEl = new Audio(SOUND_DATA_URL);
      audioEl.volume = 0.4;
    }
    audioEl.currentTime = 0;
    void audioEl.play();
  } catch {}
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
  audioEl = null;
  originalTitle = null;
  unread = 0;
}
