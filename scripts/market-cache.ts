// npm run market:cache
// Writes data/market-cache.json: the last good market response. The site shows it, labelled,
// when the live fetch fails. Run after watchlist:refresh (CI runs it hourly).
import { dataPath, readJson, sleep, writeJson } from './lib/io';
import { fetchMarket, fetchSpark } from '../src/lib/market';

const watch = readJson<{ mint: string }[]>(dataPath('watchlist.json'), []);
const registry = readJson<{ mint: string }[]>(dataPath('registry.json'), []);
const mints = [...new Set([...registry.map((r) => r.mint), ...watch.map((w) => w.mint)])];
const rows = await fetchMarket(mints);
const previous = readJson<{ rows: { mint: string; spark: number[] | null }[] }>(dataPath('market-cache.json'), { rows: [] });
const oldSpark = new Map(previous.rows.map((r) => [r.mint, r.spark]));
for (const r of rows) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      r.spark = await fetchSpark(r.pairAddress);
      break;
    } catch (e) {
      if (attempt === 3) {
        r.spark = oldSpark.get(r.mint) ?? null; // keep the last good candles rather than none
        console.warn(`spark failed for ${r.symbol}: ${(e as Error).message}`);
      } else await sleep(15_000 * (attempt + 1));
    }
  }
  await sleep(2500); // GeckoTerminal allows about 30 calls a minute
}
writeJson(dataPath('market-cache.json'), { fetchedAt: new Date().toISOString(), rows });
console.log(`market-cache: ${rows.length} rows, ${rows.filter((r) => r.spark).length} with 7d data`);
