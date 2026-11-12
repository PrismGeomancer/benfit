// npm run dbc:config                 dry run: prints the config BENFIT would create
// npm run dbc:config -- --confirm    creates it on mainnet (owner, locally)
//
// The BENFIT launch config on Meteora Dynamic Bonding Curve. Every coin launched from the site
// is created under this config, so these settings are the same for every coin:
//   fee claimer             = config.payroll_wallet  (fixed in the config; no instruction changes it)
//   creator trading fee     = 0%                     (fixed in the config)
//   base fee                = 1% flat; Meteora keeps 20% of it, 0.8% of volume reaches payroll
//   token authority         = Immutable (no mint authority after launch)
//   after migration         = 100% of LP to the partner, permanently locked; its fees also go to payroll
//
// Review the curve numbers (market caps) before running with --confirm.
import { readFileSync } from 'node:fs';
import { config } from '../src/config';
import { RPC } from './lib/chain';
import { env } from './lib/io';
import { benfitCurve } from './lib/curve';

await import('../src/launch/polyfill');
const { Connection, Keypair, PublicKey, sendAndConfirmTransaction } = await import('@solana/web3.js');
const { NATIVE_MINT } = await import('@solana/spl-token');
const sdk = await import('@meteora-ag/dynamic-bonding-curve-sdk');

const confirm = process.argv.includes('--confirm');
if (confirm && !config.payroll_wallet) throw new Error('Set config.payroll_wallet first');
// Dry run without a payroll wallet still validates the curve, against a throwaway key.
const payroll = config.payroll_wallet ? new PublicKey(config.payroll_wallet) : Keypair.generate().publicKey;

const curve = benfitCurve();

const configKp = Keypair.generate();
console.log('BENFIT DBC config');
console.log('  fee claimer        ', payroll.toBase58(), config.payroll_wallet ? '' : '(throwaway: config.payroll_wallet is empty)');
console.log('  creator fee %      ', (curve as { creatorTradingFeePercentage: number }).creatorTradingFeePercentage);
console.log('  config address     ', configKp.publicKey.toBase58(), confirm ? '' : '(dry run, not created)');

if (!confirm) {
  console.log('\nNothing sent. Re-run with --confirm and PAYER_KEYPAIR set to create it.');
  process.exit(0);
}

const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(env('PAYER_KEYPAIR', true), 'utf8'))));
const conn = new Connection(RPC, 'confirmed');
const client = new sdk.DynamicBondingCurveClient(conn, 'confirmed');
const tx = await client.partner.createConfig({
  config: configKp.publicKey,
  feeClaimer: payroll,
  leftoverReceiver: payroll,
  payer: payer.publicKey,
  quoteMint: NATIVE_MINT,
  ...(curve as object),
} as never);
const sig = await sendAndConfirmTransaction(conn, tx, [payer, configKp]);
console.log(`created: ${sig}\nSet config.dbc_config_key = '${configKp.publicKey.toBase58()}'`);
