// Browser notification helper. Distinct from VAPID Web Push:
// - Web Push: server pushes to subscribed browsers even when console tab is closed
// - Notification API (here): fires while console tab is open but backgrounded
//
// We trigger a Notification on inbound visitor messages whenever the document
// is hidden, plus title flash + sound, so the operator can hear/see it from
// another tab or window.

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

export function notifyVisitorMessage(opts: { name?: string | null; body: string }) {
  if (typeof document === 'undefined') return;
  if (document.visibilityState !== 'hidden') return;

  unread++;
  flashTitle();
  playPing();
  fireDesktop(opts);
}

function fireDesktop(opts: { name?: string | null; body: string }) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const title = opts.name ? `New message from ${opts.name}` : 'New visitor message';
    const n = new Notification(title, {
      body: opts.body.slice(0, 140),
      icon: '/console/icons/icon-192.png',
      tag: 'tidio-remake-visitor-msg',
      renotify: true,
    } as NotificationOptions & { renotify: boolean });
    n.onclick = () => {
      try { window.focus(); } catch {}
      try { n.close(); } catch {}
    };
  } catch {}
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
