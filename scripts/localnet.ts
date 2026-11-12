// npm run localnet:setup   creates the BENFIT config on the local chain, measures launch cost,
//                          writes .env.localnet (read by the site build and by the scripts)
// npm run localnet:story   launches coins, trades, snapshots (simulated clock), claims fees, pays
//
// Needs: `npm run localnet:validator` (solana-test-validator with DBC + Metaplex cloned from
// mainnet) and `npm run localnet:upload` (local upload server). Keys live in keys/devnet/*.json.
// Every transaction here is real, on the local chain, using the same code paths as mainnet.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import '../src/launch/polyfill';
import { Connection, Keypair, PublicKey, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import { NATIVE_MINT, getAssociatedTokenAddressSync } from '@solana/spl-token';
import BN from 'bn.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { benfitCurve } from './lib/curve';
import { root } from './lib/io';
import { buildLaunchTx } from '../src/launch/dbc';
import { nextPayday } from '../src/lib/time';
import { config } from '../src/config';

const RPC = 'http://127.0.0.1:8899';
const UPLOAD = 'http://127.0.0.1:8787/upload';
const conn = new Connection(RPC, 'confirmed');
const client = new DynamicBondingCurveClient(conn, 'confirmed');
const key = (n: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(resolve(root, 'keys/devnet', `${n}.json`), 'utf8'))));
const W = { payroll: key('payroll'), creator: key('creator'), h1: key('holder1'), h2: key('holder2'), h3: key('holder3') };
const envFile = resolve(root, '.env.localnet');
const DAY = 86_400_000;

function readEnv(): Record<string, string> {
  if (!existsSync(envFile)) return {};
  return Object.fromEntries(
    readFileSync(envFile, 'utf8')
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
}
function writeEnv(vars: Record<string, string>) {
  const all = { ...readEnv(), ...vars };
  // Both forms: VITE_* for the site build, plain for the scripts.
  const lines = Object.entries(all)
    .filter(([k]) => !k.startsWith('VITE_'))
    .flatMap(([k, v]) => [`${k}=${v}`, `VITE_${k}=${v}`]);
  writeFileSync(envFile, lines.join('\n') + '\n');
}

function run(cmd: string, extra: Record<string, string> = {}) {
  console.log(`\n$ ${cmd}${Object.keys(extra).length ? `   (${Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(' ')})` : ''}`);
  execSync(cmd, { stdio: 'inherit', cwd: root, env: { ...process.env, ...readEnv(), NETWORK: 'localnet', ...extra } });
}

async function setup() {
  for (const k of Object.values(W)) {
    if ((await conn.getBalance(k.publicKey)) < 10 * LAMPORTS_PER_SOL) {
      await conn.confirmTransaction(await conn.requestAirdrop(k.publicKey, 100 * LAMPORTS_PER_SOL));
    }
  }
  const configKp = Keypair.generate();
  const tx = await client.partner.createConfig({
    config: configKp.publicKey,
    feeClaimer: W.payroll.publicKey,
    leftoverReceiver: W.payroll.publicKey,
    payer: W.payroll.publicKey,
    quoteMint: NATIVE_MINT,
    ...(benfitCurve() as object),
  } as never);
  const sig = await sendAndConfirmTransaction(conn, tx, [W.payroll, configKp]);
  console.log(`config ${configKp.publicKey.toBase58()} (${sig})`);

  // Read it back: gate 1 on this chain.
  const cfg = (await client.state.getPoolConfig(configKp.publicKey)) as unknown as Record<string, unknown>;
  const c = ((cfg.poolConfig as Record<string, unknown>) ?? cfg) as { feeClaimer: PublicKey; creatorTradingFeePercentage: number };
  console.log(`read back: fee claimer ${c.feeClaimer.toBase58()}, creator fee ${c.creatorTradingFeePercentage}%`);
  if (c.feeClaimer.toBase58() !== W.payroll.publicKey.toBase58() || c.creatorTradingFeePercentage !== 0) throw new Error('routing mismatch');

  writeEnv({
    NETWORK: 'localnet',
    PAYROLL_WALLET: W.payroll.publicKey.toBase58(),
    DBC_CONFIG_KEY: configKp.publicKey.toBase58(),
    METADATA_UPLOAD_URL: UPLOAD,
    FEE_ROUTING_VERIFIED: '1',
  });
  // Measure under a separate throwaway config so the probe coin is not a BENFIT coin.
  const probeCfg = Keypair.generate();
  const ptx = await client.partner.createConfig({ config: probeCfg.publicKey, feeClaimer: W.payroll.publicKey, leftoverReceiver: W.payroll.publicKey, payer: W.payroll.publicKey, quoteMint: NATIVE_MINT, ...(benfitCurve() as object) } as never);
  await sendAndConfirmTransaction(conn, ptx, [W.payroll, probeCfg]);
  const cost = await measureLaunchCost(probeCfg.publicKey.toBase58());
  writeEnv({ LAUNCH_COST_SOL: cost.toFixed(4), LAUNCH_COST_VERIFIED: '1' });
  console.log(`launch cost measured: ${cost.toFixed(4)} SOL. Wrote .env.localnet`);
}

/** Gate 3: launch a throwaway coin for real and diff the creator's balance. */
async function measureLaunchCost(configKey: string): Promise<number> {
  const probe = Keypair.generate();
  await conn.confirmTransaction(await conn.requestAirdrop(probe.publicKey, 5 * LAMPORTS_PER_SOL));
  const before = await conn.getBalance(probe.publicKey);
  const { bytes } = await buildLaunchTx({ rpcUrl: RPC, configKey, creator: probe.publicKey.toBase58(), name: 'Cost probe', symbol: 'PROBE', uri: 'http://127.0.0.1:8787/probe.json', firstBuySol: 0 });
  const tx = Transaction.from(bytes);
  tx.partialSign(probe);
  await conn.confirmTransaction(await conn.sendRawTransaction(tx.serialize()));
  return (before - (await conn.getBalance(probe.publicKey))) / LAMPORTS_PER_SOL;
}

async function upload(symbol: string, name: string, description: string) {
  const fd = new FormData();
  fd.set('image', new Blob([readFileSync(resolve(root, 'scripts/fixtures', `${symbol.toLowerCase()}.png`))], { type: 'image/png' }), `${symbol}.png`);
  fd.set('name', name);
  fd.set('symbol', symbol);
  fd.set('description', description);
  const r = await fetch(UPLOAD, { method: 'POST', body: fd });
  return ((await r.json()) as { uri: string }).uri;
}

async function launch(symbol: string, name: string, firstBuy: number) {
  const env = readEnv();
  const uri = await upload(symbol, name, `${name}. Launched on BENFIT, local test chain.`);
  const { bytes, mint } = await buildLaunchTx({ rpcUrl: RPC, configKey: env.DBC_CONFIG_KEY, creator: W.creator.publicKey.toBase58(), name, symbol, uri, firstBuySol: firstBuy });
  const tx = Transaction.from(bytes);
  tx.partialSign(W.creator);
  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(sig);
  console.log(`launched $${symbol} ${mint} (${sig})`);
  return mint;
}

async function poolOf(mint: string) {
  const p = await client.state.getPoolByBaseMint(mint);
  if (!p) throw new Error(`no pool for ${mint}`);
  return p.publicKey;
}

async function buy(who: Keypair, mint: string, sol: number) {
  const tx = await client.pool.swap({ owner: who.publicKey, pool: await poolOf(mint), amountIn: new BN(Math.round(sol * LAMPORTS_PER_SOL)), minimumAmountOut: new BN(0), swapBaseForQuote: false, referralTokenAccount: null });
  await sendAndConfirmTransaction(conn, tx, [who]);
}

async function tokenBalance(who: Keypair, mint: string): Promise<bigint> {
  const ata = getAssociatedTokenAddressSync(new PublicKey(mint), who.publicKey);
  const b = await conn.getTokenAccountBalance(ata).catch(() => null);
  return BigInt(b?.value.amount ?? '0');
}

async function sell(who: Keypair, mint: string, fraction: number) {
  const bal = await tokenBalance(who, mint);
  const amt = (bal * BigInt(Math.round(fraction * 1000))) / 1000n;
  const tx = await client.pool.swap({ owner: who.publicKey, pool: await poolOf(mint), amountIn: new BN(amt.toString()), minimumAmountOut: new BN(0), swapBaseForQuote: true, referralTokenAccount: null });
  await sendAndConfirmTransaction(conn, tx, [who]);
}

async function story() {
  const env = readEnv();
  if (!env.DBC_CONFIG_KEY) throw new Error('run localnet:setup first');
  // Day -15: register every pool under the BENFIT config (including any launched from the site).
  const now = Date.now();
  const at = (days: number) => new Date(now - days * DAY).toISOString();
  run('npx tsx scripts/snapshot.ts', { SNAPSHOT_NOW: at(15) });
  const reg = JSON.parse(readFileSync(resolve(root, 'data/localnet/registry.json'), 'utf8')) as { mint: string; ticker: string }[];
  const bySym = new Map(reg.map((r) => [r.ticker, r.mint]));
  const mint = async (s: string, n: string) => bySym.get(s) ?? (await launch(s, n, 1));
  const OVT = await mint('OVT', 'Overtime');
  const SHIFT = await mint('SHIFT', 'Night Shift');
  const CLOCKIN = await mint('CLOCKIN', 'Clock In');
  const PENSION = bySym.get('PENSION') ?? (await launch('PENSION', 'Pension Pot', 1)); // the UI test may have launched it

  if (reg.length < 4) run('npx tsx scripts/snapshot.ts', { SNAPSHOT_NOW: at(15) });

  // Day -14: first holders buy in.
  await buy(W.h1, OVT, 2); await buy(W.h1, SHIFT, 1); await buy(W.h1, PENSION, 0.8);
  await buy(W.h2, OVT, 1.5); await buy(W.h2, CLOCKIN, 2); await buy(W.h2, PENSION, 0.5);
  await buy(W.h3, SHIFT, 0.6); await buy(W.h3, CLOCKIN, 0.4); await buy(W.h3, OVT, 0.3);
  run('npx tsx scripts/snapshot.ts', { SNAPSHOT_NOW: at(14) });

  // Day -7: holder 2 sells 40% of OVT. Their OVT clock restarts.
  await sell(W.h2, OVT, 0.4);
  run('npx tsx scripts/snapshot.ts', { SNAPSHOT_NOW: at(7) });

  // Day -3: holder 3 buys more SHIFT. Buying more does not reset.
  await buy(W.h3, SHIFT, 1.2);
  run('npx tsx scripts/snapshot.ts', { SNAPSHOT_NOW: at(3) });

  // Today: trading volume from the creator wallet generates fees (and resets the creator's clock).
  for (const m of [OVT, SHIFT, CLOCKIN, PENSION]) {
    for (let i = 0; i < 3; i++) {
      await buy(W.creator, m, 3);
      await sell(W.creator, m, 0.9);
    }
  }
  run('npx tsx scripts/snapshot.ts');

  // Claim the partner fees into the payroll wallet, record them per coin, then pay.
  run('npx tsx scripts/fees.ts claim --confirm', { PAYROLL_KEYPAIR: 'keys/devnet/payroll.json' });
  // Run as of one hour after the coming payday (simulated clock, refused on mainnet).
  const nextFriday = new Date(nextPayday(new Date(now), config.payday).getTime() + 3_600_000).toISOString();
  run('npx tsx scripts/payday.ts', { PAYDAY_AS_OF: nextFriday }); // dry run first, always
  run('npx tsx scripts/payday.ts --confirm', { PAYROLL_KEYPAIR: 'keys/devnet/payroll.json', PAYDAY_AS_OF: nextFriday });
}

const cmd = process.argv[2];
if (cmd === 'setup') await setup();
else if (cmd === 'story') await story();
else console.log('usage: tsx scripts/localnet.ts setup|story');
