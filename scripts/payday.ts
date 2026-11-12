// npm run payday                  dry run: prints the payroll table, sends nothing
// npm run payday -- --confirm     sends SOL from the payroll wallet (owner, locally)
//
// NEVER run in CI. The payroll key never leaves the owner's machine:
//   PAYROLL_KEYPAIR=/path/to/payroll.json npm run payday -- --confirm
//
// Writes data/payroll/<YYYY-MM-DD>.json with every signature and the dust carried forward,
// and adds the date to data/payroll/index.json. Commit both so the Service book shows the run.
import { readFileSync } from 'node:fs';
import { config } from '../src/config';
import type { FeeLog, PayrollRun, RegistryCoin } from '../src/lib/data';
import { computePayroll, lamportsToSol, solToLamports } from '../src/lib/rule';
import { tenureDays, type CoinState } from '../src/lib/state';
import { nextPayday, previousPayday, ymd } from '../src/lib/time';
import { clock, RPC } from './lib/chain';
import { dataPath, env, readJson, writeJson } from './lib/io';

await import('../src/launch/polyfill');
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, ComputeBudgetProgram } =
  await import('@solana/web3.js');

const confirm = process.argv.includes('--confirm');
const BATCH = 20; // recipients per transaction
// PAYDAY_AS_OF (test networks only) runs the payday that falls before that time.
const now = clock('PAYDAY_AS_OF');
// Run on Friday after 21:00 Stockholm: the payday is the one that just passed.
const payday = previousPayday(now, config.payday);
const period = ymd(payday, config.payday.tz);
if (nextPayday(new Date(payday.getTime() - 1), config.payday).getTime() !== payday.getTime()) throw new Error('payday calc');

const registry = readJson<RegistryCoin[]>(dataPath('registry.json'), []);
const index = readJson<string[]>(dataPath('payroll', 'index.json'), []);
if (index.includes(period)) throw new Error(`payroll for ${period} already exists`);
const lastRun = index.length ? readJson<PayrollRun | null>(dataPath('payroll', `${index.at(-1)}.json`), null) : null;

const run: PayrollRun = { period, paydayAt: payday.toISOString(), snapshotAt: '', coins: [] };
const transfers: { mint: string; to: string; lamports: bigint }[] = [];

for (const coin of registry) {
  const state = readJson<CoinState | null>(dataPath('state', `${coin.mint}.json`), null);
  if (!state) continue;
  run.snapshotAt = state.snapshotAt > run.snapshotAt ? state.snapshotAt : run.snapshotAt;
  const fees = readJson<FeeLog>(dataPath('fees', `${coin.mint}.json`), { mint: coin.mint, claims: [] });
  // Pool = claims since the previous run's payday (so a missed week rolls in), up to this payday.
  const from = lastRun?.paydayAt ? Date.parse(lastRun.paydayAt) : 0;
  const pool = fees.claims
    .filter((c) => Date.parse(c.at) > from && Date.parse(c.at) <= payday.getTime())
    .reduce((s, c) => s + BigInt(c.lamports), 0n);
  const carry = BigInt(lastRun?.coins.find((c) => c.mint === coin.mint)?.carry_lamports ?? '0');
  const res = computePayroll(
    Object.entries(state.wallets).map(([wallet, w]) => ({ wallet, balance: BigInt(w.balance), tenureDays: tenureDays(w, payday) })),
    {
      poolLamports: pool,
      carryLamports: carry,
      supply: BigInt(state.supply),
      decimals: state.decimals,
      capPct: config.wallet_cap_pct,
      minTokens: config.min_tokens,
      dustLamports: solToLamports(config.dust_sol),
      tenureCapDays: config.tenure_cap_days,
    },
  );
  const paid = res.rows.filter((r) => r.shareLamports > 0n);
  console.log(`\n$${coin.ticker}  pool ${lamportsToSol(pool)} + carry ${lamportsToSol(carry)} SOL, ${paid.length} paid`);
  console.table(
    paid.slice(0, 50).map((r) => ({ wallet: r.wallet, days: r.tenureDays, points: r.points.toString(), sol: lamportsToSol(r.shareLamports) })),
  );
  run.coins.push({
    mint: coin.mint,
    pool_lamports: res.totalLamports.toString(),
    carry_lamports: res.carryOutLamports.toString(),
    rows: res.rows
      .filter((r) => r.points > 0n)
      .map((r) => ({
        wallet: r.wallet,
        balance: r.balance.toString(),
        counted: r.counted.toString(),
        tenureDays: r.tenureDays,
        points: r.points.toString(),
        share_lamports: r.shareLamports.toString(),
      })),
    txs: [],
  });
  for (const r of paid) transfers.push({ mint: coin.mint, to: r.wallet, lamports: r.shareLamports });
}

const total = transfers.reduce((s, t) => s + t.lamports, 0n);
console.log(`\nperiod ${period}: ${transfers.length} transfers, ${lamportsToSol(total)} SOL in ${run.coins.reduce((n, c) => n + Math.ceil(transfers.filter((t) => t.mint === c.mint).length / BATCH), 0)} transactions`);

if (!confirm) {
  console.log('\nDry run. Nothing sent, nothing written. Re-run with --confirm to pay.');
  process.exit(0);
}

const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(env('PAYROLL_KEYPAIR', true), 'utf8'))));
if (config.payroll_wallet && kp.publicKey.toBase58() !== config.payroll_wallet) throw new Error('PAYROLL_KEYPAIR is not config.payroll_wallet');
const conn = new Connection(RPC, 'confirmed');
const balance = BigInt(await conn.getBalance(kp.publicKey));
if (balance < total + 10_000_000n) throw new Error(`payroll wallet holds ${lamportsToSol(balance)} SOL, owes ${lamportsToSol(total)}`);

for (const coin of run.coins) {
  const mine = transfers.filter((t) => t.mint === coin.mint);
  for (let i = 0; i < mine.length; i += BATCH) {
    const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }));
    for (const t of mine.slice(i, i + BATCH))
      tx.add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(t.to), lamports: t.lamports }));
    const sig = await sendAndConfirmTransaction(conn, tx, [kp]);
    coin.txs.push(sig);
    console.log(`sent ${sig}`);
    // Write after every batch so a crash never loses a signature.
    writeJson(dataPath('payroll', `${period}.json`), run);
  }
}
writeJson(dataPath('payroll', `${period}.json`), run);
writeJson(dataPath('payroll', 'index.json'), [...index, period]);
console.log(`\nwrote data/payroll/${period}.json. Commit data/payroll to publish the run.`);
