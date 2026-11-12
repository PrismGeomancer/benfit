// One config object for the site and the scripts.
// Any empty URL or address hides the element that uses it.
// No secrets here: rpc URLs must be public or restricted, domain-allowlisted keys.
//
// Network: the site reads VITE_NETWORK at build time, scripts read NETWORK.
//   mainnet   the real thing (default)
//   devnet    Solana devnet
//   localnet  solana-test-validator on 127.0.0.1 with the real DBC + Metaplex programs cloned
//             from mainnet (see `npm run localnet`). For end-to-end tests of launch, snapshot,
//             fees and payday without real SOL.

export type Network = 'mainnet' | 'devnet' | 'localnet';

const env = (k: string): string | undefined => {
  const vite = (import.meta as unknown as { env?: Record<string, string> }).env;
  return vite?.[`VITE_${k}`] ?? (typeof process !== 'undefined' ? process.env?.[k] : undefined);
};

export const network: Network = ((env('NETWORK') as Network) || 'mainnet') as Network;

interface NetConf {
  rpc_url: string;
  chain: string;
  explorerSuffix: string;
  /** Where this network's JSON lives under /data. */
  dataDir: string;
  payroll_wallet: string;
  dbc_config_key: string;
  metadata_upload_url: string;
  launch_cost_sol: number | null;
  launchCostVerified: boolean;
}

const networks: Record<Network, NetConf> = {
  mainnet: {
    // api.mainnet-beta.solana.com answers 403 to browsers. PublicNode is free, keyless and allows CORS.
    // For production traffic, use a domain-restricted Helius key here (VITE_RPC_URL).
    rpc_url: 'https://solana-rpc.publicnode.com',
    chain: 'solana:mainnet',
    explorerSuffix: '',
    dataDir: '',
    // Generated 2026-11-12 by `npm run wallet:new`; key at keys/mainnet/payroll.json (gitignored).
    payroll_wallet: 'rDLUvJ7oVBHSaBR2zMKvXm7Mv3vTNfqNrodCfzctNob',
    // Created by `npm run dbc:config -- --confirm` (owner, locally, costs SOL).
    dbc_config_key: '',
    // The deployed upload worker (server/upload-worker.ts). Empty hides the launch button.
    metadata_upload_url: '',
    // Measured 2026-11-12: one launch under the BENFIT config on a validator running the
    // mainnet DBC + Metaplex programs (rent + signature fees, 0.0245 SOL; excludes priority fee).
    launch_cost_sol: 0.025,
    launchCostVerified: true,
  },
  devnet: {
    rpc_url: 'https://api.devnet.solana.com',
    chain: 'solana:devnet',
    explorerSuffix: '?cluster=devnet',
    dataDir: 'devnet/',
    payroll_wallet: '',
    dbc_config_key: '',
    metadata_upload_url: '',
    launch_cost_sol: null,
    launchCostVerified: false,
  },
  localnet: {
    rpc_url: 'http://127.0.0.1:8899',
    chain: 'solana:localnet',
    explorerSuffix: '?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899',
    dataDir: 'localnet/',
    payroll_wallet: '',
    dbc_config_key: '',
    metadata_upload_url: 'http://127.0.0.1:8787/upload',
    launch_cost_sol: null,
    launchCostVerified: false,
  },
};

const net = networks[network];

export const config = {
  network,
  x_url: '',
  telegram_url: '',
  repo_url: 'https://github.com/PrismGeomancer/benfit',
  // GitHub Pages address; becomes live after the first deploy workflow run.
  site_url: 'https://prismgeomancer.github.io/benfit/',
  benfit_ca: '',

  rpc_url: env('RPC_URL') || net.rpc_url,
  chain: net.chain,
  explorerSuffix: net.explorerSuffix,
  dataDir: net.dataDir,
  // .env.<network> (written by the localnet runner, or by you) overrides these.
  payroll_wallet: env('PAYROLL_WALLET') || net.payroll_wallet,
  dbc_config_key: env('DBC_CONFIG_KEY') || net.dbc_config_key,
  metadata_upload_url: env('METADATA_UPLOAD_URL') || net.metadata_upload_url,

  // ASSUMPTION for market-view estimates: share of 24h volume that would reach payroll as fees.
  // The BENFIT config (scripts/create-config.ts) sets a 1% base fee; Meteora keeps 20%, so 0.8%.
  fee_rate: 0.008,

  wallet_cap_pct: 1,
  min_tokens: 100_000,
  dust_sol: 0.001,
  tenure_cap_days: null as number | null,

  payday: { weekday: 5, time: '16:00', tz: 'Europe/Stockholm' },

  // Launch cost in SOL. Shown only when verified.launchCost is true.
  launch_cost_sol: env('LAUNCH_COST_SOL') ? Number(env('LAUNCH_COST_SOL')) : net.launch_cost_sol,

  verified: {
    // Flip only after `npm run verify:routing` reads the config back from chain (localnet setup does this itself).
    feeRouting: env('FEE_ROUTING_VERIFIED') === '1',
    launchCost: env('LAUNCH_COST_VERIFIED') === '1' || net.launchCostVerified,
  },
};

export type Config = typeof config;

export const explorerTx = (sig: string) => `https://solscan.io/tx/${sig}${config.explorerSuffix}`;
export const explorerAccount = (a: string) => `https://solscan.io/account/${a}${config.explorerSuffix}`;
