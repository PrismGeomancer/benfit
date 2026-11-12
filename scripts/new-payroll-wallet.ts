// npm run wallet:new
// Creates the mainnet payroll wallet keypair at keys/mainnet/payroll.json (gitignored) and prints
// its address. Refuses to overwrite an existing key. Back the file up offline: whoever holds it
// controls the payroll wallet and every fee that flows into it.
import '../src/launch/polyfill';
import { Keypair } from '@solana/web3.js';
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './lib/io';

const file = resolve(root, 'keys', 'mainnet', 'payroll.json');
if (existsSync(file)) {
  console.log(`exists, not overwritten: ${file}`);
  process.exit(0);
}
mkdirSync(resolve(root, 'keys', 'mainnet'), { recursive: true });
const kp = Keypair.generate();
writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)));
chmodSync(file, 0o600);
console.log(`payroll wallet: ${kp.publicKey.toBase58()}\nkey file:       ${file}  (back it up offline; never commit it)`);
