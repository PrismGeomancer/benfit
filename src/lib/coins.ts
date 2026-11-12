// Table rows: registry coins (On payroll) and watchlist coins (Market view), with live market data.
import { config } from '../config';
import { copy, fill } from '../copy';
import { load, marketCache, registry, watchlist } from './data';
import { fetchMarket, type MarketRow } from './market';
import { dateTime, usdPrice } from './format';
import { toast } from './ui';

export type Kind = 'payroll' | 'market';

export interface CoinRow {
  mint: string;
  kind: Kind;
  symbol: string;
  name: string;
  imageUrl: string | null;
  m: MarketRow | null;
  /** Weekly pool in USD for market-view rows (estimate); null for payroll rows (they use SOL from data). */
  weeklyPoolUsd: number | null;
  /** Price and market cap in SOL from the bonding curve, for coins DexScreener does not list yet. */
  curve: { priceSol: number; mcapSol: number } | null;
}

type PoolPrices = Record<string, { priceSol: number; mcapSol: number }>;

export interface MarketLoad {
  rows: CoinRow[];
  live: boolean;
  fetchedAt: string;
}

let loadPromise: Promise<MarketLoad> | null = null;

export function loadCoins(): Promise<MarketLoad> {
  loadPromise ??= build();
  return loadPromise;
}

async function build(): Promise<MarketLoad> {
  const [reg, watch, cached, curves] = await Promise.all([registry(), watchlist(), marketCache(), load<PoolPrices>('pools.json', {})]);
  const regMints = reg.map((r) => r.mint);
  const mints = [...new Set([...regMints, ...watch.map((w) => w.mint)])];
  let market: MarketRow[] = [];
  let live = true;
  let fetchedAt = new Date().toISOString();
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    market = await fetchMarket(mints, ctl.signal);
    clearTimeout(t);
    if (!market.length && mints.length) throw new Error('empty');
  } catch {
    live = false;
    market = cached.rows;
    fetchedAt = cached.fetchedAt;
    if (cached.fetchedAt) toast(fill(copy.toast.market, { time: dateTime(cached.fetchedAt) }));
  }
  // 7d candles: GeckoTerminal, via the hourly cache.
  const cachedSpark = new Map(cached.rows.map((r) => [r.mint, r.spark]));
  for (const m of market) m.spark ??= cachedSpark.get(m.mint) ?? null;

  const byMint = new Map(market.map((m) => [m.mint, m]));
  const rows: CoinRow[] = mints.map((mint) => {
    const m = byMint.get(mint) ?? null;
    const r = reg.find((x) => x.mint === mint);
    const kind: Kind = r ? 'payroll' : 'market';
    return {
      mint,
      kind,
      symbol: r?.ticker ?? m?.symbol ?? mint.slice(0, 4),
      name: r?.name ?? m?.name ?? '',
      imageUrl: m?.imageUrl ?? r?.image ?? null,
      m,
      weeklyPoolUsd: kind === 'market' && m?.volume24 != null ? m.volume24 * config.fee_rate * 7 : null,
      curve: curves[mint] ?? null,
    };
  });
  return { rows: rows.filter((r) => r.kind === 'payroll' || r.m), live, fetchedAt };
}

export function solPrice(v: number): string {
  return usdPriceLike(v) + ' SOL';
}
function usdPriceLike(v: number): string {
  return usdPrice(v).replace(/^\$/, '');
}

/** Look up any mint on DexScreener (for a pasted contract address). */
export async function lookupMint(mint: string): Promise<CoinRow | null> {
  try {
    const [m] = await fetchMarket([mint]);
    if (!m) return null;
    return {
      mint,
      kind: 'market',
      symbol: m.symbol,
      name: m.name,
      imageUrl: m.imageUrl,
      m,
      weeklyPoolUsd: m.volume24 != null ? m.volume24 * config.fee_rate * 7 : null,
      curve: null,
    };
  } catch {
    return null;
  }
}

export const isMint = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim());
