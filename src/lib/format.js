export const usd = (n) => `$${(Number(n) || 0).toFixed(2)}`;
export const usdShort = (n) => {
  const v = Number(n) || 0;
  return `$${Number.isInteger(v) ? v : v.toFixed(2)}`;
};
export const khr = (n, rate = 4100) => {
  const value = Math.round(((Number(n) || 0) * rate) / 100) * 100;
  return `${value.toLocaleString('en-US')} ៛`;
};

export function dateTime(iso, lang = 'kh') {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(lang === 'kh' ? 'km-KH' : 'en-US', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return new Date(iso).toLocaleString(); }
}

export function dateShort(iso, lang = 'kh') {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(lang === 'kh' ? 'km-KH' : 'en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
    }).format(new Date(iso));
  } catch { return new Date(iso).toLocaleDateString(); }
}

export function timeAgo(iso, lang = 'kh') {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (lang === 'kh') {
    if (mins < 1) return 'ឥឡូវនេះ';
    if (mins < 60) return `${mins} នាទីមុន`;
    if (mins < 1440) return `${Math.floor(mins / 60)} ម៉ោងមុន`;
    return `${Math.floor(mins / 1440)} ថ្ងៃមុន`;
  }
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export const compact = (n) => {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
};

export const statusTone = (s) => ({
  pending: 'amber', paid: 'cyan', processing: 'blue', completed: 'green',
  cancelled: 'red', delivery_failed: 'red',
}[s] || 'gray');

export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
