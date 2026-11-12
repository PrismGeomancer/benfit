// Minimal JSON-RPC reads. Keeps @solana/web3.js out of the main bundle.
import { config } from '../config';

let id = 0;
export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const r = await fetch(config.rpc_url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  });
  if (!r.ok) throw new Error(`rpc ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message ?? 'rpc error');
  return j.result as T;
}

export interface MintInfo {
  mintAuthority: string | null;
  freezeAuthority: string | null;
  decimals: number;
  supply: string;
}

const mintCache = new Map<string, Promise<MintInfo | null>>();

/** Read live from chain. Null means the read failed, not that authorities are null. */
export function mintInfo(mint: string): Promise<MintInfo | null> {
  if (!mintCache.has(mint)) {
    mintCache.set(
      mint,
      rpc<{ value: { data: { parsed: { info: MintInfo } } } | null }>('getAccountInfo', [mint, { encoding: 'jsonParsed' }])
        .then((r) => {
          const info = r.value?.data?.parsed?.info;
          if (!info) return null;
          return {
            mintAuthority: info.mintAuthority ?? null,
            freezeAuthority: info.freezeAuthority ?? null,
            decimals: info.decimals,
            supply: info.supply,
          };
        })
        .catch(() => {
          mintCache.delete(mint);
          return null;
        }),
    );
  }
  return mintCache.get(mint)!;
}

export async function solBalance(address: string): Promise<number> {
  const r = await rpc<{ value: number }>('getBalance', [address]);
  return r.value / 1e9;
}

/** Raw token balance (base units) of `owner` for each mint. */
export async function tokenBalances(owner: string, mints: string[]): Promise<Map<string, bigint>> {
  const out = new Map<string, bigint>();
  await Promise.all(
    mints.map(async (mint) => {
      const r = await rpc<{ value: { account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } } }[] }>(
        'getTokenAccountsByOwner',
        [owner, { mint }, { encoding: 'jsonParsed' }],
      );
      const sum = r.value.reduce((s, a) => s + BigInt(a.account.data.parsed.info.tokenAmount.amount), 0n);
      out.set(mint, sum);
    }),
  );
  return out;
}
