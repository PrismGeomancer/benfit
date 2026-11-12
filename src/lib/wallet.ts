// Wallet Standard (Phantom, Solflare, Backpack). Used for: connect, signMessage for statements,
// and the launch transaction. No other transactions.
import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletAccount } from '@wallet-standard/base';
import { config } from '../config';

type Listener = (account: WalletAccount | null) => void;

const CONNECT = 'standard:connect';
const DISCONNECT = 'standard:disconnect';
const SIGN_MESSAGE = 'solana:signMessage';
const SIGN_AND_SEND = 'solana:signAndSendTransaction';
export const CHAIN = config.chain;

let current: { wallet: Wallet; account: WalletAccount } | null = null;
const listeners = new Set<Listener>();

export function solanaWallets(): Wallet[] {
  return getWallets()
    .get()
    .filter((w) => CONNECT in w.features && w.chains.some((c) => c.startsWith('solana:')));
}

export function onWallets(cb: () => void) {
  return getWallets().on('register', cb);
}

export function account() {
  return current?.account ?? null;
}
export function address() {
  return current?.account.address ?? null;
}
export function walletName() {
  return current?.wallet.name ?? null;
}

export function subscribe(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const emit = () => listeners.forEach((l) => l(current?.account ?? null));

export async function connect(wallet: Wallet) {
  const f = wallet.features[CONNECT] as { connect: () => Promise<{ accounts: readonly WalletAccount[] }> };
  const { accounts } = await f.connect();
  const acc = accounts[0] ?? wallet.accounts[0];
  if (!acc) throw new Error('no account');
  current = { wallet, account: acc };
  try {
    localStorage.setItem('benfit.wallet', wallet.name);
  } catch {}
  emit();
}

export async function disconnect() {
  const f = current?.wallet.features[DISCONNECT] as { disconnect?: () => Promise<void> } | undefined;
  try {
    await f?.disconnect?.();
  } catch {}
  current = null;
  try {
    localStorage.removeItem('benfit.wallet');
  } catch {}
  emit();
}

export function lastWalletName(): string | null {
  try {
    return localStorage.getItem('benfit.wallet');
  } catch {
    return null;
  }
}

export async function signMessage(message: Uint8Array): Promise<Uint8Array> {
  if (!current) throw new Error('not connected');
  const f = current.wallet.features[SIGN_MESSAGE] as
    | { signMessage: (...i: { account: WalletAccount; message: Uint8Array }[]) => Promise<{ signature: Uint8Array }[]> }
    | undefined;
  if (!f) throw new Error('signMessage unsupported');
  const [out] = await f.signMessage({ account: current.account, message });
  return out.signature;
}

export async function signAndSend(tx: Uint8Array): Promise<Uint8Array> {
  if (!current) throw new Error('not connected');
  const f = current.wallet.features[SIGN_AND_SEND] as
    | {
        signAndSendTransaction: (
          ...i: { account: WalletAccount; transaction: Uint8Array; chain: string }[]
        ) => Promise<{ signature: Uint8Array }[]>;
      }
    | undefined;
  if (!f) throw new Error('signAndSendTransaction unsupported');
  const [out] = await f.signAndSendTransaction({ account: current.account, transaction: tx, chain: CHAIN });
  return out.signature;
}

/** True when the user declined in the wallet (codes and messages differ between wallets). */
export function isRejection(e: unknown): boolean {
  const err = e as { code?: number; message?: string; name?: string };
  return err?.code === 4001 || /reject|declin|denied|cancel/i.test(`${err?.name} ${err?.message}`);
}
