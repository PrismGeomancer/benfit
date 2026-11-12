import { defineConfig } from '@playwright/test';

// End-to-end tests against the local chain. Needs localnet:validator, localnet:upload and localnet:setup.
export default defineConfig({
  testDir: 'e2e-localnet',
  // launch.spec creates a coin; run it only on a fresh chain: npx playwright test -c playwright.localnet.config.ts launch
  timeout: 120_000,
  workers: 1,
  use: { baseURL: 'http://localhost:4174/' },
  webServer: {
    command: 'npm run localnet:build && npx vite preview --outDir dist-localnet --port 4174 --strictPort',
    port: 4174,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
