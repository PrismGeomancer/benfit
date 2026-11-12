// Chain reads for the scripts. RPC URL from env (HELIUS_RPC_URL or RPC_URL), else public mainnet.
import { getJson } from './io';

import { config } from '../../src/config';
export const RPC = process.env.HELIUS_RPC_URL || config.rpc_url;

let id = 0;
export async function rpc<T>(method: string, params: unknown): Promise<T> {
  const r = await getJson<{ result?: T; error?: { message: string } }>(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  });
  if (r.error) throw new Error(`${method}: ${r.error.message}`);
  return r.result as T;
}

export async function mintMeta(mint: string) {
  const r = await rpc<{ value: { data: { parsed: { info: { decimals: number; supply: string } } } } }>('getAccountInfo', [
    mint,
    { encoding: 'jsonParsed', commitment: 'confirmed' },
  ]);
  const info = r.value.data.parsed.info;
  return { decimals: info.decimals, supply: BigInt(info.supply) };
}

/**
 * Every holder balance of `mint`, summed per owner.
 * Uses Helius DAS getTokenAccounts (paginated) when HELIUS_RPC_URL is set,
 * otherwise getProgramAccounts on the token programs (many public RPCs refuse that).
 */
export async function holders(mint: string): Promise<Map<string, bigint>> {
  const out = new Map<string, bigint>();
  const add = (owner: string, amount: bigint) => amount > 0n && out.set(owner, (out.get(owner) ?? 0n) + amount);
  if (process.env.HELIUS_RPC_URL) {
    let cursor: string | undefined;
    for (;;) {
      const r = await rpc<{ token_accounts: { owner: string; amount: number | string }[]; cursor?: string }>('getTokenAccounts', {
        mint,
        limit: 1000,
        cursor,
        options: { showZeroBalance: false },
      });
      for (const a of r.token_accounts) add(a.owner, BigInt(a.amount));
      if (!r.cursor || !r.token_accounts.length) break;
      cursor = r.cursor;
    }
    return out;
  }
  for (const program of ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']) {
    const accs = await rpc<{ account: { data: { parsed: { info: { owner: string; tokenAmount: { amount: string } } } } } }[]>(
      'getProgramAccounts',
      [program, { encoding: 'jsonParsed', commitment: 'confirmed', filters: [{ memcmp: { offset: 0, bytes: mint } }] }],
    ).catch(() => []);
    for (const a of accs) add(a.account.data.parsed.info.owner, BigInt(a.account.data.parsed.info.tokenAmount.amount));
  }
  return out;
}

/** Name and symbol from the Metaplex metadata account (works on any network, no indexer). */
export async function tokenMetadata(mint: string): Promise<{ name: string; symbol: string; uri: string } | null> {
  const { PublicKey } = await import('@solana/web3.js');
  const META = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('metadata'), META.toBuffer(), new PublicKey(mint).toBuffer()], META);
  const r = await rpc<{ value: { data: [string, string] } | null }>('getAccountInfo', [pda.toBase58(), { encoding: 'base64', commitment: 'confirmed' }]);
  if (!r.value) return null;
  const b = Buffer.from(r.value.data[0], 'base64');
  let o = 1 + 32 + 32;
  const str = () => {
    const n = b.readUInt32LE(o);
    o += 4;
    const v = b.subarray(o, o + n).toString('utf8').replace(/\0+$/, '').trim();
    o += n;
    return v;
  };
  return { name: str(), symbol: str(), uri: str() };
}

/** Simulated clock for test networks only. Mainnet always uses the real time. */
export function clock(envName: string): Date {
  const v = process.env[envName];
  if (!v) return new Date();
  if (config.network === 'mainnet') throw new Error(`${envName} is refused on mainnet`);
  return new Date(v);
}
