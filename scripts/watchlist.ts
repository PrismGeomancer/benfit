// npm run watchlist:refresh
// Builds data/watchlist.json from live APIs. Mint addresses are never typed by hand from memory;
// the owner may paste mints copied from Axiom into the file (set KEEP_PASTED=1 to keep them).
//
// DexScreener has no "top pairs by volume" listing, so candidates come from GeckoTerminal's Solana
// pools sorted by 24h volume. Each candidate is then confirmed on DexScreener: its deepest pair must
// be quoted in SOL (drops SOL itself, stablecoins and tokenised stocks) and hold at least LIQ_FLOOR
// USD of liquidity (drops wash-traded pools).
import { dataPath, getJson, readJson, sleep, writeJson } from './lib/io';
import { fetchMarket } from '../src/lib/market';

const LIQ_FLOOR = Number(process.env.LIQ_FLOOR ?? 75_000);
const MAX = Number(process.env.WATCHLIST_MAX ?? 24);
const PAGES = Number(process.env.PAGES ?? 5);

interface GtPools {
  data: { relationships: { base_token: { data: { id: string } } } }[];
}

const seen = new Set<string>();
const candidates: string[] = [];
for (let page = 1; page <= PAGES; page++) {
  const r = await getJson<GtPools>(
    `https://api.geckoterminal.com/api/v2/networks/solana/pools?sort=h24_volume_usd_desc&page=${page}`,
  );
  for (const p of r.data) {
    const mint = p.relationships.base_token.data.id.replace(/^solana_/, '');
    if (!seen.has(mint)) {
      seen.add(mint);
      candidates.push(mint);
    }
  }
  await sleep(2500);
}

// Majors, stablecoins, liquid-staking tokens and tokenised stocks are not launchpad coins.
// Matched by symbol, never by a remembered address.
const NOT_LAUNCHPAD = /^(w?sol|.*sol$|usd.*|.*usd.?|usdt|usdc|eurc|pyusd|w?eth|w?btc|cbbtc|zbtc|tbtc|zec|hype|xrp|bnb|sui|ton|link|jup|jto|pyth|ray|bonk-sol)$/i;
const XSTOCK = /^[A-Z]{1,6}x$/;

const rows = await fetchMarket(candidates);
const kept = rows
  .filter((r) => (r.liquidityUsd ?? 0) >= LIQ_FLOOR && r.quoteSymbol === 'SOL')
  .filter((r) => !NOT_LAUNCHPAD.test(r.symbol) && !XSTOCK.test(r.symbol) && !/wrapped|staked/i.test(r.name))
  .slice(0, MAX);

const existing = readJson<{ mint: string }[]>(dataPath('watchlist.json'), []);
const keptMints = kept.map((r) => r.mint);
const pasted = process.env.KEEP_PASTED === '1' ? existing.map((e) => e.mint).filter((m) => !keptMints.includes(m)) : [];
const list = [...keptMints, ...pasted].map((mint) => ({ mint }));
writeJson(dataPath('watchlist.json'), list);

console.log(`watchlist: ${list.length} coins from ${candidates.length} candidates (SOL-quoted, liquidity >= $${LIQ_FLOOR.toLocaleString()})`);
for (const r of kept) console.log(`  ${r.symbol.padEnd(12)} ${r.mint}  liq $${Math.round(r.liquidityUsd ?? 0).toLocaleString()}`);
