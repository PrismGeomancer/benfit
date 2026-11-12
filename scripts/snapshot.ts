// npm run snapshot   (GitHub Actions, every hour; commits data/state)
//
// 1. Registry sync: adds any pool created under config.dbc_config_key to data/registry.json,
//    so coins launched from the site appear without a server.
// 2. For each registry coin: read all holders and update data/state/<mint>.json.
//    A lower balance sets lastOutflowAt = now; a first-seen wallet gets firstSeenAt = now.
//
// Limitation: a sell and rebuy between two snapshots (ending at an equal or higher balance)
// is not seen. Snapshots are hourly.
import { config } from '../src/config';
import { nextState, type CoinState } from '../src/lib/state';
import { clock, holders, mintMeta, RPC, tokenMetadata } from './lib/chain';
import { dataPath, readJson, writeJson } from './lib/io';
import type { RegistryCoin } from '../src/lib/data';

const regPath = dataPath('registry.json');
const registry = readJson<RegistryCoin[]>(regPath, []);

if (config.dbc_config_key) {
  await import('../src/launch/polyfill');
  const { Connection, PublicKey } = await import('@solana/web3.js');
  const { DynamicBondingCurveClient } = await import('@meteora-ag/dynamic-bonding-curve-sdk');
  const client = new DynamicBondingCurveClient(new Connection(RPC, 'confirmed'), 'confirmed');
  const pools = await client.state.getPoolsByConfig(new PublicKey(config.dbc_config_key));
  for (const p of pools) {
    const acct = p.account as unknown as { baseMint?: { toBase58(): string }; poolState?: { baseMint: { toBase58(): string } } };
    const mint = (acct.baseMint ?? acct.poolState!.baseMint).toBase58();
    if (registry.some((r) => r.mint === mint)) continue;
    const meta = await client.state.getPoolMetadata(p.publicKey).catch(() => null);
    const sigs = await new Connection(RPC, 'confirmed').getSignaturesForAddress(p.publicKey, { limit: 1000 });
    const first = sigs.at(-1);
    registry.push({
      mint,
      name: (meta as { name?: string } | null)?.name ?? '',
      ticker: '',
      payrollWallet: config.payroll_wallet,
      launchedAt: first?.blockTime ? new Date(first.blockTime * 1000).toISOString() : new Date().toISOString(),
      launchTx: first?.signature ?? '',
      pool: p.publicKey.toBase58(),
    });
    console.log(`registry: added ${mint}`);
  }
  // Name, ticker and image from the token's Metaplex metadata (and the JSON it points to).
  for (const r of registry.filter((x) => !x.ticker || !x.image)) {
    const m = await tokenMetadata(r.mint).catch(() => null);
    if (!m) continue;
    r.ticker ||= m.symbol;
    r.name ||= m.name;
    const j = await fetch(m.uri).then((x) => x.json()).catch(() => null);
    if (j && typeof j.image === 'string') r.image = j.image;
  }
  writeJson(regPath, registry);

  // Pool price and market cap in SOL, read from the bonding curve (DexScreener does not list
  // test networks, and lists a mainnet coin only after it trades).
  const { getPriceFromSqrtPrice } = await import('@meteora-ag/dynamic-bonding-curve-sdk');
  const poolPrices: Record<string, { priceSol: number; mcapSol: number; quoteReserveSol: number; at: string }> = {};
  for (const r of registry.filter((x) => x.pool)) {
    const raw = (await client.state.getPool(r.pool!)) as unknown as Record<string, unknown> | null;
    if (!raw) continue;
    // The SDK's type wraps the account in poolState; at runtime it may be flat. Accept both.
    const pool = ((raw.poolState as Record<string, unknown>) ?? raw) as { sqrtPrice: import('bn.js'); quoteReserve: import('bn.js') };
    const meta = await mintMeta(r.mint);
    const price = Number(getPriceFromSqrtPrice(pool.sqrtPrice as never, 6 as never, 9).toString());
    poolPrices[r.mint] = {
      priceSol: price,
      mcapSol: price * (Number(meta.supply) / 10 ** meta.decimals),
      quoteReserveSol: Number(pool.quoteReserve.toString()) / 1e9,
      at: new Date().toISOString(),
    };
  }
  writeJson(dataPath('pools.json'), poolPrices);
}

const now = clock('SNAPSHOT_NOW');
for (const coin of registry) {
  const path = dataPath('state', `${coin.mint}.json`);
  const prev = readJson<CoinState | null>(path, null);
  const [meta, balances] = await Promise.all([mintMeta(coin.mint), holders(coin.mint)]);
  // The pool's vaults (owned by the DBC pool authority) and the payroll wallet are not holders.
  const { deriveDbcPoolAuthority } = await import('@meteora-ag/dynamic-bonding-curve-sdk');
  for (const skip of [coin.pool, coin.payrollWallet, deriveDbcPoolAuthority().toBase58()]) if (skip) balances.delete(skip);
  const next = nextState(prev, balances, { mint: coin.mint, ...meta }, now);
  writeJson(path, next);
  const resets = Object.values(next.wallets).filter((w) => w.lastOutflowAt === next.snapshotAt).length;
  console.log(`${coin.ticker || coin.mint}: ${balances.size} holders, ${resets} clocks reset`);
}
if (!registry.length) console.log('snapshot: registry is empty, nothing to read');
