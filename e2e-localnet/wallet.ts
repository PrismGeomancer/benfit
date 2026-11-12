// A Wallet Standard test wallet for Playwright. The page sees a normal Solana wallet; signing
// happens in Node with a keypair from keys/devnet, and transactions go to the local chain.
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// No @solana/web3.js here: Playwright's loader cannot require it under Node 20.
// Transactions are signed from their wire format with ed25519 and sent over plain JSON-RPC.
interface Kp { publicKey: Uint8Array; secretKey: Uint8Array; address: string }

export function keypair(name: string): Kp {
  const secretKey = Uint8Array.from(JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'keys/devnet', `${name}.json`), 'utf8')));
  const publicKey = secretKey.slice(32);
  return { secretKey, publicKey, address: bs58.encode(publicKey) };
}

function shortvec(b: Uint8Array, o: number): [number, number] {
  let len = 0, size = 0;
  for (;;) {
    const e = b[o + size];
    len |= (e & 0x7f) << (size * 7);
    size++;
    if ((e & 0x80) === 0) return [len, size];
  }
}

/** Put our signature into the right slot of a serialized (legacy or v0) transaction. */
function signWire(raw: Uint8Array, kp: Kp): Uint8Array {
  const out = raw.slice();
  const [nSigs, n] = shortvec(out, 0);
  const msgStart = n + nSigs * 64;
  const msg = out.subarray(msgStart);
  const h = msg[0] & 0x80 ? 1 : 0; // v0 messages start with a version prefix
  const nRequired = msg[h];
  const [nKeys, k] = shortvec(msg, h + 3);
  const keysAt = h + 3 + k;
  for (let i = 0; i < Math.min(nRequired, nKeys); i++) {
    const key = msg.subarray(keysAt + i * 32, keysAt + i * 32 + 32);
    if (Buffer.compare(Buffer.from(key), Buffer.from(kp.publicKey)) === 0) {
      out.set(nacl.sign.detached(msg, kp.secretKey), n + i * 64);
      return out;
    }
  }
  throw new Error('wallet is not a signer of this transaction');
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = (await r.json()) as { result: T; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

export async function installWallet(page: Page, kp: Kp, url = 'http://127.0.0.1:8899') {
  await page.exposeFunction('__testSignAndSend', async (bytes: number[]) => {
    const signed = signWire(Uint8Array.from(bytes), kp);
    const sig = await rpc<string>(url, 'sendTransaction', [Buffer.from(signed).toString('base64'), { encoding: 'base64', preflightCommitment: 'confirmed' }]);
    for (let i = 0; i < 60; i++) {
      const s = await rpc<{ value: ({ confirmationStatus: string; err: unknown } | null)[] }>(url, 'getSignatureStatuses', [[sig]]);
      const st = s.value[0];
      if (st?.err) throw new Error('transaction failed');
      if (st && st.confirmationStatus !== 'processed') break;
      await new Promise((r) => setTimeout(r, 500));
    }
    return Array.from(bs58.decode(sig));
  });
  await page.exposeFunction('__testSignMessage', async (bytes: number[]) =>
    Array.from(nacl.sign.detached(Uint8Array.from(bytes), kp.secretKey)),
  );
  await page.addInitScript(
    ({ address, pub }) => {
      const chains = ['solana:localnet', 'solana:devnet', 'solana:mainnet'];
      const account = {
        address,
        publicKey: new Uint8Array(pub),
        chains,
        features: ['solana:signAndSendTransaction', 'solana:signMessage'],
      };
      const w = window as unknown as Record<string, (b: number[]) => Promise<number[]>>;
      const wallet = {
        version: '1.0.0',
        name: 'Test Wallet',
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNGMkU2MDAiLz48L3N2Zz4=',
        chains,
        accounts: [account],
        features: {
          'standard:connect': { version: '1.0.0', connect: async () => ({ accounts: [account] }) },
          'standard:disconnect': { version: '1.0.0', disconnect: async () => {} },
          'standard:events': { version: '1.0.0', on: () => () => {} },
          'solana:signAndSendTransaction': {
            version: '1.0.0',
            supportedTransactionVersions: ['legacy', 0],
            signAndSendTransaction: async (...inputs: { transaction: Uint8Array }[]) =>
              Promise.all(inputs.map(async (i) => ({ signature: new Uint8Array(await w.__testSignAndSend(Array.from(i.transaction))) }))),
          },
          'solana:signMessage': {
            version: '1.0.0',
            signMessage: async (...inputs: { message: Uint8Array }[]) =>
              Promise.all(inputs.map(async (i) => ({ signedMessage: i.message, signature: new Uint8Array(await w.__testSignMessage(Array.from(i.message))) }))),
          },
        },
      };
      const register = (api: { register: (w: unknown) => void }) => api.register(wallet);
      window.addEventListener('wallet-standard:app-ready', ((e: CustomEvent) => register(e.detail)) as EventListener);
      window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: register }));
    },
    { address: kp.address, pub: Array.from(kp.publicKey) },
  );
}
