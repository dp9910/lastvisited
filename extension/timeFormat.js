// Shared "time ago" formatting for notifications, badges, and the popup.

function formatRelativeTime(timestampMs) {
  if (!timestampMs) return 'an unknown time ago';

  const diffMs = Date.now() - timestampMs;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return 'just now';
  if (diffMs < hour) {
    const m = Math.floor(diffMs / minute);
    return `${m} min${m === 1 ? '' : 's'} ago`;
  }
  if (diffMs < day) {
    const h = Math.floor(diffMs / hour);
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  if (diffMs < 7 * day) {
    const d = Math.floor(diffMs / day);
    return `${d} day${d === 1 ? '' : 's'} ago`;
  }
  return new Date(timestampMs).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

if (typeof self !== 'undefined') {
  self.formatRelativeTime = formatRelativeTime;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatRelativeTime };
}
