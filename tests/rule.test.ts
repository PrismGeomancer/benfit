import { describe, expect, it } from 'vitest';
import { computePayroll, lamportsToSol, solToLamports, toBase, type RuleHolder } from '../src/lib/rule';
import { nextState, tenureDays } from '../src/lib/state';
import { nextPayday, ymd } from '../src/lib/time';

const DEC = 6;
const M = (n: number) => toBase(n * 1_000_000, DEC);
const base = { decimals: DEC, capPct: 1, minTokens: 100_000, dustLamports: solToLamports(0.001) };

describe('worked example', () => {
  const holders: RuleHolder[] = [
    { wallet: 'Ana', balance: M(10), tenureDays: 30 },
    { wallet: 'Ben', balance: M(5), tenureDays: 30 },
    { wallet: 'Cy', balance: M(10), tenureDays: 10 },
  ];
  const r = computePayroll(holders, { ...base, poolLamports: solToLamports(20) });

  it('reproduces points', () => {
    expect(r.rows.map((x) => x.points / toBase(1, DEC))).toEqual([300_000_000n, 150_000_000n, 100_000_000n]);
    expect(r.totalPoints / toBase(1, DEC)).toBe(550_000_000n);
  });

  it('pays 10.91 / 5.45 / 3.64', () => {
    expect(r.rows.map((x) => lamportsToSol(x.shareLamports).toFixed(2))).toEqual(['10.91', '5.45', '3.64']);
  });

  it('shares plus carry sum to the pool exactly', () => {
    expect(r.paidLamports + r.carryOutLamports).toBe(solToLamports(20));
    expect(lamportsToSol(r.paidLamports).toFixed(2)).toBe('20.00');
  });
});

describe('limits', () => {
  it('caps a wallet at 1% of supply', () => {
    const supply = M(1000); // 1B tokens, cap = 10M
    const r = computePayroll(
      [
        { wallet: 'whale', balance: M(50), tenureDays: 10 },
        { wallet: 'small', balance: M(10), tenureDays: 10 },
      ],
      { ...base, supply, poolLamports: solToLamports(2) },
    );
    expect(r.rows[0].counted).toBe(M(10));
    expect(r.rows[0].capped).toBe(true);
    expect(r.rows[0].shareLamports).toBe(r.rows[1].shareLamports);
  });

  it('needs the minimum balance to be on payroll', () => {
    const r = computePayroll(
      [
        { wallet: 'under', balance: toBase(99_999, DEC), tenureDays: 100 },
        { wallet: 'at', balance: toBase(100_000, DEC), tenureDays: 1 },
      ],
      { ...base, poolLamports: solToLamports(1) },
    );
    expect(r.rows[0].points).toBe(0n);
    expect(r.rows[1].shareLamports).toBe(solToLamports(1));
  });

  it('rolls a share under 0.001 SOL into next week', () => {
    const r = computePayroll(
      [
        { wallet: 'big', balance: M(10), tenureDays: 100 },
        { wallet: 'tiny', balance: toBase(100_000, DEC), tenureDays: 1 },
      ],
      { ...base, poolLamports: solToLamports(1), carryLamports: solToLamports(0.5) },
    );
    expect(r.totalLamports).toBe(solToLamports(1.5));
    expect(r.rows[1].shareLamports).toBe(0n);
    expect(r.carryOutLamports).toBeGreaterThan(0n);
    expect(r.paidLamports + r.carryOutLamports).toBe(solToLamports(1.5));
  });

  it('pays nobody and carries everything when there are no points', () => {
    const r = computePayroll([{ wallet: 'new', balance: M(5), tenureDays: 0 }], { ...base, poolLamports: 5n });
    expect(r.paidLamports).toBe(0n);
    expect(r.carryOutLamports).toBe(5n);
  });
});

describe('tenure from snapshots', () => {
  const meta = { mint: 'MINT', decimals: DEC, supply: M(1000) };
  const t0 = new Date('2026-10-01T12:00:00Z');
  const t1 = new Date('2026-10-05T12:00:00Z');
  const t2 = new Date('2026-10-09T12:00:00Z');
  const payday = new Date('2026-10-16T14:00:00Z');

  it('a lower balance resets the clock', () => {
    const s0 = nextState(null, new Map([['w', M(5)]]), meta, t0);
    const s1 = nextState(s0, new Map([['w', M(4)]]), meta, t1);
    expect(s1.wallets.w.lastOutflowAt).toBe(t1.toISOString());
    expect(tenureDays(s1.wallets.w, payday)).toBe(11);
  });

  it('buying more does not reset', () => {
    const s0 = nextState(null, new Map([['w', M(5)]]), meta, t0);
    const s1 = nextState(s0, new Map([['w', M(9)]]), meta, t1);
    expect(s1.wallets.w.lastOutflowAt).toBeNull();
    expect(s1.wallets.w.firstSeenAt).toBe(t0.toISOString());
    expect(tenureDays(s1.wallets.w, payday)).toBe(15);
  });

  it('selling everything and buying back counts days from the snapshot where it emptied', () => {
    const s0 = nextState(null, new Map([['w', M(5)]]), meta, t0);
    const s1 = nextState(s0, new Map(), meta, t1);
    const s2 = nextState(s1, new Map([['w', M(5)]]), meta, t2);
    expect(s2.wallets.w.lastOutflowAt).toBe(t1.toISOString());
    expect(tenureDays(s2.wallets.w, payday)).toBe(11);
  });

  it('a wallet that buys just before payday gets 0 points', () => {
    const justBefore = new Date(payday.getTime() - 60 * 60 * 1000);
    const s = nextState(null, new Map([['late', M(10)], ]), meta, justBefore);
    const days = tenureDays(s.wallets.late, payday);
    expect(days).toBe(0);
    const r = computePayroll(
      [
        { wallet: 'late', balance: M(10), tenureDays: days },
        { wallet: 'holder', balance: M(1), tenureDays: 30 },
      ],
      { ...base, poolLamports: solToLamports(3) },
    );
    expect(r.rows[0].points).toBe(0n);
    expect(r.rows[0].shareLamports).toBe(0n);
    expect(r.rows[1].shareLamports).toBe(solToLamports(3));
  });
});

describe('payday time', () => {
  const conf = { weekday: 5, time: '16:00', tz: 'Europe/Stockholm' };
  it('is Friday 16:00 Stockholm in winter (UTC+1)', () => {
    const p = nextPayday(new Date('2026-11-12T10:00:00Z'), conf);
    expect(p.toISOString()).toBe('2026-11-13T15:00:00.000Z');
    expect(ymd(p, conf.tz)).toBe('2026-11-13');
  });
  it('is Friday 16:00 Stockholm in summer (UTC+2)', () => {
    expect(nextPayday(new Date('2026-07-01T10:00:00Z'), conf).toISOString()).toBe('2026-07-03T14:00:00.000Z');
  });
  it('moves to next week once Friday 16:00 has passed', () => {
    expect(nextPayday(new Date('2026-11-13T15:00:01Z'), conf).toISOString()).toBe('2026-11-20T15:00:00.000Z');
  });
});

describe('payday at 21:00 Stockholm', () => {
  const conf = { weekday: 5, time: '21:00', tz: 'Europe/Stockholm' };
  it('next payday from Thu 12 Nov 2026 is Fri 13 Nov 21:00 Stockholm (20:00 UTC)', () => {
    expect(nextPayday(new Date('2026-11-12T18:00:00Z'), conf).toISOString()).toBe('2026-11-13T20:00:00.000Z');
  });
  it('Friday afternoon still counts down to the same evening', () => {
    expect(nextPayday(new Date('2026-11-13T15:30:00Z'), conf).toISOString()).toBe('2026-11-13T20:00:00.000Z');
  });
});
