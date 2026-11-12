// npm run fees               record fee claims (read-only, safe in CI)
// npm run fees -- claim      claim partner trading fees into the payroll wallet (owner, locally)
// npm run fees -- claim --confirm
//
// Attribution: each coin's pool is the SOL its own claim transactions moved into the payroll
// wallet. A claim tx is attributed to a coin when it references that coin's DBC pool account.
import { readFileSync } from 'node:fs';
import { config } from '../src/config';
import type { FeeLog, RegistryCoin } from '../src/lib/data';
import { RPC } from './lib/chain';
import { dataPath, env, readJson, writeJson } from './lib/io';

await import('../src/launch/polyfill');
const { Connection, Keypair, PublicKey, sendAndConfirmTransaction } = await import('@solana/web3.js');

const registry = readJson<RegistryCoin[]>(dataPath('registry.json'), []);
const conn = new Connection(RPC, 'confirmed');
const payroll = config.payroll_wallet;
if (!payroll) {
  console.log('fees: config.payroll_wallet is empty, nothing to record');
  process.exit(0);
}

if (process.argv.includes('claim')) {
  const confirm = process.argv.includes('--confirm');
  const { DynamicBondingCurveClient } = await import('@meteora-ag/dynamic-bonding-curve-sdk');
  const client = new DynamicBondingCurveClient(conn, 'confirmed');
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(env('PAYROLL_KEYPAIR', true), 'utf8'))));
  if (kp.publicKey.toBase58() !== payroll) throw new Error('PAYROLL_KEYPAIR is not config.payroll_wallet');
  const BN = (await import('bn.js')).default;
  const U64_MAX = new BN('18446744073709551615');
  for (const coin of registry.filter((c) => c.pool)) {
    const tx = await client.partner.claimPartnerTradingFee({
      pool: new PublicKey(coin.pool!),
      feeClaimer: kp.publicKey,
      payer: kp.publicKey,
      maxBaseAmount: new BN(0),
      maxQuoteAmount: U64_MAX,
      receiver: kp.publicKey,
    } as never);
    if (!confirm) {
      console.log(`dry run: would claim quote fees for ${coin.ticker} (${coin.pool})`);
      continue;
    }
    const sig = await sendAndConfirmTransaction(conn, tx, [kp]);
    console.log(`claimed ${coin.ticker}: ${sig}`);
  }
  if (!confirm) console.log('nothing sent. Re-run with --confirm to claim.');
}

// Record: walk payroll wallet history since the last recorded signature.
for (const coin of registry.filter((c) => c.pool)) {
  const path = dataPath('fees', `${coin.mint}.json`);
  const log = readJson<FeeLog>(path, { mint: coin.mint, claims: [] });
  const known = new Set(log.claims.map((c) => c.signature));
  const sigs = await conn.getSignaturesForAddress(new PublicKey(coin.pool!), { limit: 1000 });
  for (const s of sigs.reverse()) {
    if (known.has(s.signature) || s.err) continue;
    const tx = await conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
    if (!tx?.meta) continue;
    const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
    const logs = tx.meta.logMessages?.join('\n') ?? '';
    if (!/ClaimTradingFee|claim_trading_fee/i.test(logs)) continue;
    const i = keys.indexOf(payroll);
    if (i < 0) continue;
    const delta = BigInt(tx.meta.postBalances[i]) - BigInt(tx.meta.preBalances[i]) + BigInt(tx.meta.fee ?? 0) * (i === 0 ? 1n : 0n);
    if (delta <= 0n) continue;
    log.claims.push({ signature: s.signature, at: new Date((s.blockTime ?? 0) * 1000).toISOString(), lamports: delta.toString() });
    console.log(`${coin.ticker}: claim ${s.signature} +${Number(delta) / 1e9} SOL`);
  }
  writeJson(path, log);
}
