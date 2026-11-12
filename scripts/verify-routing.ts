// npm run verify:routing     (gate 1)
// Reads the BENFIT DBC config back from chain and checks the two settings the fee-split copy relies on:
//   fee claimer == config.payroll_wallet, creator trading fee == 0%.
// The program has no instruction that changes either after creation, so a pass here means the
// routing is fixed for every coin launched under this config. Then set FEE_ROUTING_VERIFIED=1
// (or verified.feeRouting) for that network.
import '../src/launch/polyfill';
import { Connection, PublicKey } from '@solana/web3.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { config } from '../src/config';
import { RPC } from './lib/chain';

if (!config.dbc_config_key || !config.payroll_wallet) {
  console.log(`verify:routing (${config.network}): dbc_config_key and payroll_wallet must both be set. Not verified.`);
  process.exit(1);
}
const client = new DynamicBondingCurveClient(new Connection(RPC, 'confirmed'), 'confirmed');
const raw = (await client.state.getPoolConfig(new PublicKey(config.dbc_config_key))) as unknown as Record<string, unknown> | null;
if (!raw) {
  console.log(`config ${config.dbc_config_key} not found on ${config.network}. Not verified.`);
  process.exit(1);
}
const c = ((raw.poolConfig as Record<string, unknown>) ?? raw) as { feeClaimer: PublicKey; creatorTradingFeePercentage: number };
const okClaimer = c.feeClaimer.toBase58() === config.payroll_wallet;
const okCreator = c.creatorTradingFeePercentage === 0;
console.log(`network          ${config.network}`);
console.log(`config           ${config.dbc_config_key}`);
console.log(`fee claimer      ${c.feeClaimer.toBase58()}  ${okClaimer ? 'OK = payroll wallet' : 'MISMATCH'}`);
console.log(`creator fee      ${c.creatorTradingFeePercentage}%  ${okCreator ? 'OK' : 'MISMATCH'}`);
if (okClaimer && okCreator) console.log('\nVerified. Set FEE_ROUTING_VERIFIED=1 for this network to show the fee split.');
else process.exit(1);
