export function isInQuietHours(start: string | null, end: string | null, timezone: string, now = new Date()): boolean {
  if (!start || !end) return false;
  const localTime = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  // Intl can return "24:30" for 00:30 in some implementations; normalize:
  const normalized = localTime.replace(/^24/, '00');
  return overlapsInterval(normalized, start, end);
}

function overlapsInterval(time: string, start: string, end: string): boolean {
  const [t, s, e] = [time, start, end].map(toMinutes);
  if (s <= e) return t >= s && t < e;
  return t >= s || t < e;
}

function toMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}
