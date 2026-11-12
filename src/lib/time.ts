// Payday maths in a named time zone without a date library.

function partsIn(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday);
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, s: +o.second, wd };
}

/** UTC instant for a wall-clock time in `tz`. */
export function zonedTime(y: number, m: number, d: number, h: number, mi: number, tz: string): Date {
  let guess = Date.UTC(y, m - 1, d, h, mi);
  for (let i = 0; i < 3; i++) {
    const p = partsIn(new Date(guess), tz);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
    const want = Date.UTC(y, m - 1, d, h, mi);
    guess += want - asUtc;
  }
  return new Date(guess);
}

export interface PaydayConf {
  weekday: number;
  time: string;
  tz: string;
}

/** Next payday strictly after `now`. */
export function nextPayday(now: Date, conf: PaydayConf): Date {
  const [hh, mm] = conf.time.split(':').map(Number);
  const p = partsIn(now, conf.tz);
  for (let add = 0; add <= 7; add++) {
    if ((p.wd + add) % 7 !== conf.weekday) continue;
    const base = new Date(Date.UTC(p.y, p.m - 1, p.d + add));
    const t = zonedTime(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hh, mm, conf.tz);
    if (t.getTime() > now.getTime()) return t;
  }
  // Same weekday but time already passed: next week.
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d + 7));
  return zonedTime(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hh, mm, conf.tz);
}

export function previousPayday(now: Date, conf: PaydayConf): Date {
  const next = nextPayday(now, conf);
  return nextPayday(new Date(next.getTime() - 8 * 86_400_000), conf);
}

export function ymd(date: Date, tz: string): string {
  const p = partsIn(date, tz);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export function splitDuration(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}
