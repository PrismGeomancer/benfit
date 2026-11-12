// npm run launch:cost
// Gate 3. Builds the real launch transaction under config.dbc_config_key and simulates it on
// mainnet (no signature, nothing sent), then prices it: signature fees + rent of every account
// the transaction creates. Prints the number to put in config.launch_cost_sol.
// Set verified.launchCost = true only after checking it against one real launch.
import { config } from '../src/config';
import { RPC } from './lib/chain';

await import('../src/launch/polyfill');
const { Connection } = await import('@solana/web3.js');
const { buildLaunchTx } = await import('../src/launch/dbc');

if (!config.dbc_config_key) {
  console.log('launch:cost needs config.dbc_config_key (run npm run dbc:config first). Not measured.');
  process.exit(0);
}
const creator = process.env.CREATOR ?? config.payroll_wallet;
if (!creator) throw new Error('Set CREATOR=<any funded wallet address> to simulate from');
const { bytes } = await buildLaunchTx({
  rpcUrl: RPC,
  configKey: config.dbc_config_key,
  creator,
  name: 'Cost check',
  symbol: 'COST',
  uri: 'https://example.invalid/m.json',
  firstBuySol: 0,
});
const conn = new Connection(RPC, 'confirmed');
const { Transaction } = await import('@solana/web3.js');
const tx = Transaction.from(bytes);
const keys = tx.compileMessage().accountKeys;
const sim = await conn.simulateTransaction(tx, undefined, keys);
if (sim.value.err) throw new Error(`simulation failed: ${JSON.stringify(sim.value.err)}\n${sim.value.logs?.join('\n')}`);
const before = await conn.getMultipleAccountsInfo(keys);
let rent = 0;
sim.value.accounts?.forEach((after, i) => {
  if (!after || before[i]) return; // only accounts this tx creates
  rent += after.lamports;
});
const sigFee = tx.signatures.length * 5000;
const sol = (rent + sigFee) / 1e9;
console.log(`accounts created rent: ${rent / 1e9} SOL\nsignature fees: ${sigFee / 1e9} SOL\nlaunch cost: ${sol.toFixed(4)} SOL (+ priority fee, + first buy)`);

