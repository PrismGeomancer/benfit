// Live top holders of any Solana coin, from RugCheck's public report (free, keyless, CORS-open).
// Public Solana RPC endpoints do not serve "largest accounts" without a paid key, and DexScreener
// has no holder data. Liquidity pools are hidden; creator wallets and lockers are labelled.

export interface LiveHolder {
  owner: string;
  /** Share of total supply, in percent. */
  pct: number;
  /** Token amount in whole tokens. */
  tokens: number;
  label: string | null;
}

export interface LiveHolders {
  rows: LiveHolder[];
  /** Total holder count for the coin, when the report has it. */
  total: number | null;
}

interface Report {
  totalHolders?: number;
  topHolders?: { address: string; owner?: string; pct: number; uiAmount: number }[];
  knownAccounts?: Record<string, { name: string; type: string }>;
}

const cache = new Map<string, Promise<LiveHolders | null>>();

export function liveHolders(mint: string, limit = 8): Promise<LiveHolders | null> {
  if (!cache.has(mint)) {
    const p = (async (): Promise<LiveHolders | null> => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 10_000);
      try {
        const r = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`, { signal: ctl.signal });
        if (!r.ok) return null;
        const j = (await r.json()) as Report;
        const known = j.knownAccounts ?? {};
        const byOwner = new Map<string, LiveHolder>();
        for (const h of j.topHolders ?? []) {
          const owner = h.owner || h.address;
          const k = known[owner] ?? known[h.address];
          if (k?.type === 'AMM') continue; // a pool, not a person
          const label = k ? (k.type === 'CREATOR' ? 'Creator' : k.name) : null;
          const prev = byOwner.get(owner);
          if (prev) {
            prev.pct += h.pct;
            prev.tokens += h.uiAmount;
          } else byOwner.set(owner, { owner, pct: h.pct, tokens: h.uiAmount, label });
        }
        const rows = [...byOwner.values()].sort((a, b) => b.pct - a.pct).slice(0, limit);
        return rows.length ? { rows, total: j.totalHolders ?? null } : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })().then((v) => {
      if (!v) cache.delete(mint); // a failure is not cached, so a retry can succeed
      return v;
    });
    cache.set(mint, p);
  }
  return cache.get(mint)!;
}
