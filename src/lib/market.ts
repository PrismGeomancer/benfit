// Market data from DexScreener (price, change, cap, volume, pair quote) and GeckoTerminal (7d candles).
// Shared by the site and the scripts.

export interface MarketRow {
  mint: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  pairAddress: string;
  dexId: string;
  quoteSymbol: string;
  priceUsd: number | null;
  change24: number | null;
  marketCap: number | null;
  volume24: number | null;
  liquidityUsd: number | null;
  spark: number[] | null;
}

interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; symbol: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  marketCap?: number;
  fdv?: number;
  info?: { imageUrl?: string };
}

const DEX = 'https://api.dexscreener.com';
const GT = 'https://api.geckoterminal.com/api/v2';

async function j<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { headers: { accept: 'application/json' }, signal });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return (await r.json()) as T;
}

/** Best pair (highest liquidity) per mint, 30 mints per call. Order follows `mints`. */
export async function fetchMarket(mints: string[], signal?: AbortSignal): Promise<MarketRow[]> {
  const out = new Map<string, MarketRow>();
  for (let i = 0; i < mints.length; i += 30) {
    const chunk = mints.slice(i, i + 30);
    const pairs = await j<DexPair[]>(`${DEX}/tokens/v1/solana/${chunk.join(',')}`, signal);
    for (const p of pairs) {
      if (p.chainId !== 'solana') continue;
      const mint = p.baseToken.address;
      if (!chunk.includes(mint)) continue;
      const liq = p.liquidity?.usd ?? 0;
      const prev = out.get(mint);
      if (prev && (prev.liquidityUsd ?? 0) >= liq) continue;
      out.set(mint, {
        mint,
        name: p.baseToken.name,
        symbol: p.baseToken.symbol,
        imageUrl: p.info?.imageUrl ?? null,
        pairAddress: p.pairAddress,
        dexId: p.dexId,
        quoteSymbol: p.quoteToken.symbol,
        priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
        change24: p.priceChange?.h24 ?? null,
        marketCap: p.marketCap ?? p.fdv ?? null,
        volume24: p.volume?.h24 ?? null,
        liquidityUsd: liq,
        spark: null,
      });
    }
  }
  return mints.map((m) => out.get(m)).filter((x): x is MarketRow => !!x);
}

/** Daily closes for the last 7 days, oldest first. */
export async function fetchSpark(pairAddress: string, signal?: AbortSignal): Promise<number[]> {
  const r = await j<{ data: { attributes: { ohlcv_list: number[][] } } }>(
    `${GT}/networks/solana/pools/${pairAddress}/ohlcv/day?aggregate=1&limit=7&currency=usd`,
    signal,
  );
  return r.data.attributes.ohlcv_list
    .slice()
    .sort((a, b) => a[0] - b[0])
    .map((c) => c[4]);
}
