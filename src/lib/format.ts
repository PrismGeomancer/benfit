const SUB = '₀₁₂₃₄₅₆₇₈₉';

/** $0.0₄481 for tiny prices, $1.09 for normal ones. */
export function usdPrice(v: number | null): string {
  if (v === null || !isFinite(v)) return '–';
  if (v >= 1) return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (v >= 0.01) return '$' + v.toFixed(4);
  const s = v.toFixed(20);
  const m = s.match(/^0\.(0+)(\d{1,4})/);
  if (!m) return '$' + v.toPrecision(3);
  const zeros = m[1].length;
  const sig = m[2].replace(/0+$/, '') || '0';
  if (zeros < 3) return '$0.' + m[1] + sig;
  return '$0.0' + String(zeros).split('').map((d) => SUB[+d]).join('') + sig;
}

export function usdCompact(v: number | null): string {
  if (v === null || !isFinite(v)) return '–';
  const a = Math.abs(v);
  const f = (n: number, s: string) => '$' + (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + s;
  if (a >= 1e9) return f(v / 1e9, 'B');
  if (a >= 1e6) return f(v / 1e6, 'M');
  if (a >= 1e3) return f(v / 1e3, 'K');
  return '$' + v.toFixed(0);
}

/** +12.3% / −4.1%; sign in text, never colour alone. */
export function pct(v: number | null): { text: string; cls: string } {
  if (v === null || !isFinite(v)) return { text: '–', cls: '' };
  const abs = Math.abs(v);
  const n = abs >= 1000 ? Math.round(abs).toLocaleString('en-US') : abs.toFixed(abs >= 100 ? 0 : 1);
  if (v > 0) return { text: `▲ +${n}%`, cls: 'pos' };
  if (v < 0) return { text: `▼ −${n}%`, cls: 'neg' };
  return { text: '0.0%', cls: '' };
}

export function sol(v: number, dp = 2): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function int(v: number | bigint): string {
  return Number(v).toLocaleString('en-US');
}

export function compactNum(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(v >= 1e10 ? 0 : 1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + 'K';
  return String(Math.round(v));
}

export function short(addr: string, n = 4): string {
  return addr.length > n * 2 + 1 ? `${addr.slice(0, n)}…${addr.slice(-n)}` : addr;
}

export function pctLabel(rate: number): string {
  return `${+(rate * 100).toFixed(2)}%`;
}

export function dateTime(iso: string | Date, tz?: string): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('en-GB', { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function dateOnly(iso: string | Date, tz?: string): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' });
}

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
