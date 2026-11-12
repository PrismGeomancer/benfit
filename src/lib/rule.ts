// The payroll rule. Pure functions, shared by the site, the scripts and the tests.
//
// Points = tokens counted × days since the wallet's last sell or transfer out.
// Counted = min(balance, cap). A wallet needs at least `minTokens` to be on payroll.
// Share = pool × points ÷ total points. Shares under `dust` roll into next week.

export const LAMPORTS_PER_SOL = 1_000_000_000n;

export interface RuleHolder {
  wallet: string;
  /** Balance in base units (raw, including decimals). */
  balance: bigint;
  tenureDays: number;
}

export interface RuleParams {
  /** Fees collected for this coin since the last payday, in lamports. */
  poolLamports: bigint;
  /** Dust carried over from earlier paydays, in lamports. */
  carryLamports?: bigint;
  /** Total supply in base units. Needed for the wallet cap; omit to skip the cap. */
  supply?: bigint;
  decimals: number;
  capPct: number;
  minTokens: number;
  dustLamports: bigint;
  tenureCapDays?: number | null;
}

export interface RuleRow {
  wallet: string;
  balance: bigint;
  counted: bigint;
  capped: boolean;
  tenureDays: number;
  points: bigint;
  shareLamports: bigint;
}

export interface RuleResult {
  totalLamports: bigint;
  totalPoints: bigint;
  rows: RuleRow[];
  paidLamports: bigint;
  /** Lamports not paid this week: dust shares plus rounding remainder. */
  carryOutLamports: bigint;
}

export function toBase(tokens: number, decimals: number): bigint {
  // Whole-token amounts only need integer math; fractional input is rounded down to base units.
  const [i, f = ''] = tokens.toString().split('.');
  return BigInt(i) * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || '0');
}

export function capFor(supply: bigint | undefined, capPct: number): bigint | null {
  if (supply === undefined) return null;
  // capPct may be fractional (e.g. 0.5); scale by 1e4 to stay in integers.
  return (supply * BigInt(Math.round(capPct * 10_000))) / 1_000_000n;
}

export function computePayroll(holders: RuleHolder[], p: RuleParams): RuleResult {
  const cap = capFor(p.supply, p.capPct);
  const min = toBase(p.minTokens, p.decimals);
  const totalLamports = p.poolLamports + (p.carryLamports ?? 0n);

  const rows: RuleRow[] = holders.map((h) => {
    const eligible = h.balance >= min;
    const capped = cap !== null && h.balance > cap;
    const counted = eligible ? (capped ? (cap as bigint) : h.balance) : 0n;
    const days = Math.max(0, Math.floor(p.tenureCapDays ? Math.min(h.tenureDays, p.tenureCapDays) : h.tenureDays));
    return {
      wallet: h.wallet,
      balance: h.balance,
      counted,
      capped: eligible && capped,
      tenureDays: days,
      points: counted * BigInt(days),
      shareLamports: 0n,
    };
  });

  const totalPoints = rows.reduce((s, r) => s + r.points, 0n);
  let paid = 0n;
  if (totalPoints > 0n) {
    for (const r of rows) {
      if (r.points === 0n) continue;
      const share = (totalLamports * r.points) / totalPoints;
      if (share < p.dustLamports) continue; // rolls into next week
      r.shareLamports = share;
      paid += share;
    }
  }
  return { totalLamports, totalPoints, rows, paidLamports: paid, carryOutLamports: totalLamports - paid };
}

export function lamportsToSol(l: bigint): number {
  return Number(l) / 1e9;
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * 1e9));
}
