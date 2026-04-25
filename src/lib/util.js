// src/lib/util.js
export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};
export const ease = [0.16, 1, 0.3, 1];

export function relativeTime(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export function startOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(0,0,0,0); return x;
}
export function startOfMonth(d = new Date()) {
  const x = startOfDay(d); x.setDate(1); return x;
}
export function startOfWeek(d = new Date()) {
  const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x;
}
export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
