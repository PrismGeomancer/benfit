// Reads the JSON contracts in /data. The site never writes them; scripts do.
import { config } from '../config';
import type { CoinState } from './state';
import type { MarketRow } from './market';

export interface RegistryCoin {
  mint: string;
  name: string;
  ticker: string;
  payrollWallet: string;
  launchedAt: string;
  launchTx: string;
  pool?: string;
  image?: string;
}

export interface PayrollRunRow {
  wallet: string;
  balance: string;
  counted: string;
  tenureDays: number;
  points: string;
  share_lamports: string;
}

export interface PayrollRun {
  period: string;
  paydayAt?: string;
  snapshotAt: string;
  coins: { mint: string; pool_lamports: string; carry_lamports: string; rows: PayrollRunRow[]; txs: string[] }[];
}

export interface FeeLog {
  mint: string;
  claims: { signature: string; at: string; lamports: string }[];
}

export interface MarketCache {
  fetchedAt: string;
  rows: MarketRow[];
}

const cache = new Map<string, Promise<unknown>>();

export function load<T>(path: string, fallback: T): Promise<T> {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(`./data/${config.dataDir}${path}`, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : fallback))
        .catch(() => fallback),
    );
  }
  return cache.get(path) as Promise<T>;
}

export const registry = () => load<RegistryCoin[]>('registry.json', []);
export const watchlist = () => load<{ mint: string }[]>('watchlist.json', []);
export const marketCache = () => load<MarketCache>('market-cache.json', { fetchedAt: '', rows: [] });
export const coinState = (mint: string) => load<CoinState | null>(`state/${mint}.json`, null);
export const feeLog = (mint: string) => load<FeeLog>(`fees/${mint}.json`, { mint, claims: [] });
export const payrollIndex = () => load<string[]>('payroll/index.json', []);
export const payrollRun = (date: string) => load<PayrollRun | null>(`payroll/${date}.json`, null);

export async function allRuns(): Promise<PayrollRun[]> {
  const idx = await payrollIndex();
  const runs = await Promise.all(idx.map((d) => payrollRun(d)));
  return runs.filter((r): r is PayrollRun => !!r).sort((a, b) => b.period.localeCompare(a.period));
}
