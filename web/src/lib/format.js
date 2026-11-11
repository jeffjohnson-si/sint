/** Small formatting helpers shared by the feed, profiles and chat. */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Pinned rather than the browser locale: the audience is Solomon Islands, and a
 * device set to another language should not turn dates into 9月4日.
 */
const LOCALE = 'en-GB';

/** "now", "4m", "3h", "2d", then a date. Matches how the apps show timestamps. */
export function timeAgo(value) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';

  const diff = Date.now() - then;
  if (diff < MINUTE) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;

  return new Date(then).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}

export function clockTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' });
}

export function longDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** 1200 -> "1.2K". Keeps profile stats compact on narrow phones. */
export function compactNumber(value) {
  const number = Number(value ?? 0);
  if (number < 1000) return String(number);
  if (number < 1_000_000) return `${(number / 1000).toFixed(number % 1000 === 0 ? 0 : 1)}K`;
  return `${(number / 1_000_000).toFixed(1)}M`;
}

export function initials(name) {
  return String(name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Account types are lowercase on the wire. */
export function accountTypeLabel(type) {
  return (
    {
      user: 'Personal',
      business: 'Business',
      company: 'Company',
      freelancer: 'Freelancer',
    }[type] ?? 'Account'
  );
}

export function fileSizeLabel(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
