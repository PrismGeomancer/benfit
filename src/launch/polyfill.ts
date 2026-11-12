import { Buffer } from 'buffer';

// web3.js and anchor expect Node's Buffer. Runs before they are evaluated (import order).
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer ??= Buffer;
