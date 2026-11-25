// npm run watchlist:refresh
// Builds data/watchlist.json from live APIs. Mint addresses are never typed by hand from memory;
// the owner may paste mints copied from Axiom into the file (set KEEP_PASTED=1 to keep them).
//
// Selection (all tunable by env):
//   MAX_AGE_DAYS  (30)       the coin's deepest pair was created within this many days
//   MIN_ATH_USD   (500000)   its all-time-high market cap in that window was at least this
//   LIQ_FLOOR     (25000)    it still has this much liquidity, so it is tradable and not rugged
//   WATCHLIST_MAX (24)       list size, best ATH first
//
// Discovery: DexScreener has no listing endpoint, so candidates come from GeckoTerminal's Solana pool
// lists (top volume, trending, newest). Each candidate is then confirmed on DexScreener (age, SOL quote,
// liquidity) and its ATH is measured from GeckoTerminal daily candles:
//   ATH market cap = highest daily high x (current market cap / current price)
// That assumes supply has not changed, which holds for launchpad coins with a fixed supply.
import { dataPath, getJson, readJson, sleep, writeJson } from './lib/io';
import { fetchDaily, fetchMarket } from '../src/lib/market';

const MAX_AGE_DAYS = Number(process.env.MAX_AGE_DAYS ?? 30);
const MIN_ATH = Number(process.env.MIN_ATH_USD ?? 500_000);
const LIQ_FLOOR = Number(process.env.LIQ_FLOOR ?? 25_000);
const MAX = Number(process.env.WATCHLIST_MAX ?? 24);
const PAGES = Number(process.env.PAGES ?? 8);
const GT = 'https://api.geckoterminal.com/api/v2/networks/solana';
const DAY = 86_400_000;

interface GtPools {
  data: { relationships: { base_token: { data: { id: string } } } }[];
}

const seen = new Set<string>();
const candidates: string[] = [];
async function collect(url: string, label: string) {
  try {
    const r = await getJson<GtPools>(url);
    let n = 0;
    for (const p of r.data) {
      const mint = p.relationships.base_token.data.id.replace(/^solana_/, '');
      if (!seen.has(mint)) {
        seen.add(mint);
        candidates.push(mint);
        n++;
      }
    }
    console.log(`  ${label}: +${n}`);
  } catch (e) {
    console.warn(`  ${label}: skipped (${(e as Error).message.slice(0, 60)})`);
  }
  await sleep(2500);
}

console.log('discovering candidates');
for (let page = 1; page <= PAGES; page++) await collect(`${GT}/pools?sort=h24_volume_usd_desc&page=${page}`, `top volume p${page}`);
for (let page = 1; page <= 3; page++) await collect(`${GT}/trending_pools?duration=24h&page=${page}`, `trending p${page}`);
for (let page = 1; page <= 3; page++) await collect(`${GT}/new_pools?page=${page}`, `newest p${page}`);

// Majors, stablecoins, liquid-staking tokens and tokenised stocks are not launchpad coins.
// Matched by symbol, never by a remembered address.
const NOT_LAUNCHPAD = /^(w?sol|.*sol$|usd.*|.*usd.?|usdt|usdc|eurc|pyusd|w?eth|w?btc|cbbtc|zbtc|tbtc|zec|hype|xrp|bnb|sui|ton|link|jup|jto|pyth|ray|bonk-sol)$/i;
const XSTOCK = /^[A-Z]{1,6}x$/;

const now = Date.now();
const rows = await fetchMarket(candidates);
const fresh = rows
  .filter((r) => r.quoteSymbol === 'SOL' && (r.liquidityUsd ?? 0) >= LIQ_FLOOR)
  .filter((r) => !NOT_LAUNCHPAD.test(r.symbol) && !XSTOCK.test(r.symbol) && !/wrapped|staked/i.test(r.name))
  .filter((r) => r.createdAt !== null && now - r.createdAt <= MAX_AGE_DAYS * DAY)
  .filter((r) => r.priceUsd && r.marketCap);
console.log(`\n${candidates.length} candidates, ${rows.length} on DexScreener, ${fresh.length} created in the last ${MAX_AGE_DAYS} days with >= $${LIQ_FLOOR.toLocaleString()} liquidity`);

// GeckoTerminal answers 429 for about a minute after a burst, so wait it out rather than skip a coin.
async function dailyWithRetry(pair: string): Promise<number[][]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchDaily(pair, MAX_AGE_DAYS + 1);
    } catch (e) {
      if (attempt >= 4 || !/429/.test((e as Error).message)) throw e;
      await sleep(20_000 * (attempt + 1));
    }
  }
}

console.log('cooling down before measuring ATH (rate limit)');
await sleep(65_000);

interface Hit { symbol: string; mint: string; ageDays: number; athCap: number; cap: number; liq: number; vol: number }
const hits: Hit[] = [];
for (const r of fresh) {
  try {
    const candles = await dailyWithRetry(r.pairAddress);
    const highest = Math.max(...candles.map((c) => c[2]));
    const supplyFactor = r.marketCap! / r.priceUsd!;
    const athCap = highest * supplyFactor;
    const ageDays = (now - r.createdAt!) / DAY;
    const ok = athCap >= MIN_ATH;
    console.log(`  ${ok ? '+' : '-'} ${r.symbol.padEnd(12)} ${ageDays.toFixed(1).padStart(5)}d  ATH $${Math.round(athCap).toLocaleString().padStart(12)}  now $${Math.round(r.marketCap!).toLocaleString().padStart(12)}`);
    if (ok) hits.push({ symbol: r.symbol, mint: r.mint, ageDays, athCap, cap: r.marketCap!, liq: r.liquidityUsd ?? 0, vol: r.volume24 ?? 0 });
  } catch (e) {
    console.warn(`  ? ${r.symbol}: ATH not measurable (${(e as Error).message.slice(0, 50)}), skipped`);
  }
  await sleep(3000); // GeckoTerminal allows about 30 calls a minute
}

hits.sort((a, b) => b.athCap - a.athCap);
const picked = hits.slice(0, MAX);
const existing = readJson<{ mint: string }[]>(dataPath('watchlist.json'), []);
const pickedMints = picked.map((h) => h.mint);
const pasted = process.env.KEEP_PASTED === '1' ? existing.map((e) => e.mint).filter((m) => !pickedMints.includes(m)) : [];
const list = [...pickedMints, ...pasted].map((mint) => ({ mint }));
if (!list.length) {
  console.error('\nNo coin matched. watchlist.json left unchanged. Loosen MIN_ATH_USD / MAX_AGE_DAYS / LIQ_FLOOR.');
  process.exit(1);
}
writeJson(dataPath('watchlist.json'), list);

console.log(`\nwatchlist: ${list.length} coins (age <= ${MAX_AGE_DAYS}d, ATH >= $${MIN_ATH.toLocaleString()}, liquidity >= $${LIQ_FLOOR.toLocaleString()})`);
for (const h of picked) console.log(`  ${h.symbol.padEnd(12)} ${h.mint}  ${h.ageDays.toFixed(1)}d  ATH $${Math.round(h.athCap).toLocaleString()}`);
