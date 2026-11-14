const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** True when the item was published within the last 24 hours. */
export function isLatest(publishedAt: string): boolean {
  const time = new Date(publishedAt).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time < DAY;
}

/** Compact relative timestamp, e.g. "12m ago", "3h ago", "2d ago". */
export function formatRelative(publishedAt: string): string {
  const time = new Date(publishedAt).getTime();
  if (Number.isNaN(time)) return "";

  const diff = Date.now() - time;
  if (diff < 60 * 1000) return "just now";

  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(diff / HOUR);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diff / DAY);
  if (days < 7) return `${days}d ago`;

  return new Date(time).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
