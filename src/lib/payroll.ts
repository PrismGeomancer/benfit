// This week's payroll projection per registry coin, from data/state, data/fees and data/payroll.
import { config } from '../config';
import { computePayroll, solToLamports, type RuleResult } from './rule';
import { tenureDays, type CoinState } from './state';
import { nextPayday } from './time';
import { allRuns, coinState, feeLog, registry, type PayrollRun, type RegistryCoin } from './data';

export interface CoinPayroll {
  coin: RegistryCoin;
  state: CoinState | null;
  poolLamports: bigint;
  carryLamports: bigint;
  result: RuleResult | null;
  lastPaid: { period: string; lamports: bigint } | null;
}

export interface PayrollSummary {
  coins: CoinPayroll[];
  runs: PayrollRun[];
  payday: Date;
  paidAllLamports: bigint;
  holdersOnPayroll: number;
  longestTenure: number;
  poolLamports: bigint;
  owedLamports: bigint;
  dustLamports: bigint;
  pointsTotal: bigint;
  lastSnapshot: string | null;
}

let memo: Promise<PayrollSummary> | null = null;

export function payrollSummary(now = new Date()): Promise<PayrollSummary> {
  memo ??= build(now);
  return memo;
}

async function build(now: Date): Promise<PayrollSummary> {
  const [reg, runs] = await Promise.all([registry(), allRuns()]);
  const payday = nextPayday(now, config.payday);

  const coins = await Promise.all(
    reg.map(async (coin): Promise<CoinPayroll> => {
      const [state, fees] = await Promise.all([coinState(coin.mint), feeLog(coin.mint)]);
      // Same rule as scripts/payday.ts: claims since the last run's payday.
      const from = runs[0]?.paydayAt ? Date.parse(runs[0].paydayAt) : 0;
      const poolLamports = fees.claims
        .filter((c) => Date.parse(c.at) > from)
        .reduce((s, c) => s + BigInt(c.lamports), 0n);
      const lastRunCoin = runs.flatMap((r) => r.coins.filter((c) => c.mint === coin.mint).map((c) => ({ r, c })))[0];
      const carryLamports = lastRunCoin ? BigInt(lastRunCoin.c.carry_lamports) : 0n;
      const lastPaid = lastRunCoin
        ? {
            period: lastRunCoin.r.period,
            lamports: lastRunCoin.c.rows.reduce((s, x) => s + BigInt(x.share_lamports), 0n),
          }
        : null;
      let result: RuleResult | null = null;
      if (state) {
        result = computePayroll(
          Object.entries(state.wallets).map(([wallet, w]) => ({
            wallet,
            balance: BigInt(w.balance),
            tenureDays: tenureDays(w, payday),
          })),
          {
            poolLamports,
            carryLamports,
            supply: BigInt(state.supply),
            decimals: state.decimals,
            capPct: config.wallet_cap_pct,
            minTokens: config.min_tokens,
            dustLamports: solToLamports(config.dust_sol),
            tenureCapDays: config.tenure_cap_days,
          },
        );
      }
      return { coin, state, poolLamports, carryLamports, result, lastPaid };
    }),
  );

  const paidAllLamports = runs.reduce(
    (s, r) => s + r.coins.reduce((t, c) => t + c.rows.reduce((u, x) => u + BigInt(x.share_lamports), 0n), 0n),
    0n,
  );
  const onPayroll = new Set<string>();
  let longest = 0;
  for (const c of coins)
    for (const r of c.result?.rows ?? [])
      if (r.points > 0n) {
        onPayroll.add(r.wallet);
        longest = Math.max(longest, r.tenureDays);
      }
  const sum = (f: (c: CoinPayroll) => bigint) => coins.reduce((s, c) => s + f(c), 0n);
  const snaps = coins.map((c) => c.state?.snapshotAt).filter((s): s is string => !!s).sort();

  return {
    coins,
    runs,
    payday,
    paidAllLamports,
    holdersOnPayroll: onPayroll.size,
    longestTenure: longest,
    poolLamports: sum((c) => c.poolLamports + c.carryLamports),
    owedLamports: sum((c) => c.result?.paidLamports ?? 0n),
    dustLamports: sum((c) => c.result?.carryOutLamports ?? c.carryLamports),
    pointsTotal: sum((c) => c.result?.totalPoints ?? 0n),
    lastSnapshot: snaps.at(-1) ?? null,
  };
}
