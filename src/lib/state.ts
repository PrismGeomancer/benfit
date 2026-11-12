// Holder state between hourly snapshots.
// A lower balance than last time sets lastOutflowAt = now (any sell or transfer out).
// A first-seen wallet gets firstSeenAt = now. Buying more changes neither.
//
// Limitation: a sell and a rebuy between two snapshots that ends at an equal or higher
// balance is not seen. Snapshots are hourly.

export interface WalletState {
  balance: string; // base units, as a decimal string (JSON has no bigint)
  firstSeenAt: string; // ISO time
  lastOutflowAt: string | null;
}

export interface CoinState {
  mint: string;
  decimals: number;
  supply: string;
  snapshotAt: string;
  wallets: Record<string, WalletState>;
}

export function nextState(
  prev: CoinState | null,
  balances: Map<string, bigint>,
  meta: { mint: string; decimals: number; supply: bigint },
  now: Date,
): CoinState {
  const at = now.toISOString();
  const wallets: Record<string, WalletState> = {};
  const old = prev?.wallets ?? {};

  for (const [wallet, bal] of balances) {
    const before = old[wallet];
    if (!before) {
      wallets[wallet] = { balance: bal.toString(), firstSeenAt: at, lastOutflowAt: null };
      continue;
    }
    const lower = bal < BigInt(before.balance);
    wallets[wallet] = {
      balance: bal.toString(),
      firstSeenAt: before.firstSeenAt,
      lastOutflowAt: lower ? at : before.lastOutflowAt,
    };
  }
  // Wallets that emptied out keep a record so a later rebuy starts from 0 days.
  for (const [wallet, before] of Object.entries(old)) {
    if (balances.has(wallet)) continue;
    const hadBalance = BigInt(before.balance) > 0n;
    wallets[wallet] = {
      balance: '0',
      firstSeenAt: before.firstSeenAt,
      lastOutflowAt: hadBalance ? at : before.lastOutflowAt,
    };
  }
  return { mint: meta.mint, decimals: meta.decimals, supply: meta.supply.toString(), snapshotAt: at, wallets };
}

const DAY = 86_400_000;

export function tenureDays(w: Pick<WalletState, 'firstSeenAt' | 'lastOutflowAt'>, payday: Date): number {
  const start = Math.max(Date.parse(w.firstSeenAt), w.lastOutflowAt ? Date.parse(w.lastOutflowAt) : 0);
  return Math.max(0, Math.floor((payday.getTime() - start) / DAY));
}
