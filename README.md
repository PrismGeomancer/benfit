# BENFIT ($BENFIT)

A Solana launchpad where a coin's fees are paid to its holders every Friday, weighted by how long they have held.

**The rule.** Points = tokens counted × days since the wallet's last sell or transfer out (buying more does not reset days). A wallet counts at most 1% of supply and needs 100,000 tokens to be on payroll. Payday is Friday 16:00 Europe/Stockholm. Each wallet gets pool × points ÷ total points; a share under 0.001 SOL rolls into next week. All of these are values in `src/config.ts`, and the code lives in `src/lib/rule.ts` and `src/lib/state.ts`.

Static site (Vite + TypeScript, vanilla DOM, GSAP), hash routing, `base: './'` for a GitHub Pages subpath. There is no server and no database: scripts write JSON to `/data`, and the site reads it.

```
npm install
npm run dev            # local site
npm test               # rule tests (Vitest)
npm run smoke          # Playwright: 320 / 768 / 1280, console errors, banned words
npm run build          # static site in dist/ (includes /data)
```

Docs: `docs/benfit-claude-code-prompt.md` (build brief), `docs/benfit-copy-deck.md` (every UI string; transcribed into `src/copy.ts`), `docs/benfit-image-prompts.md`.
Brand: `docs/brand/benfit-logo.png` is the logo (payslip, coin, tenure bars). Icon sizes are in `public/brand/`. `docs/brand/unused-claude-mark/` holds an earlier mark that was not used.

---

## What is live, read-only, and not built

| Part | Status |
|---|---|
| Market view (price, 24h, market cap, volume) | **Live** from DexScreener in the visitor's browser. If that call fails, the site falls back to `data/market-cache.json` and shows the "Showing values from {time}" toast. |
| 7d sparklines | **Hourly cache** of GeckoTerminal OHLCV (`npm run market:cache`, run in CI). Live per-visitor calls trip GeckoTerminal's rate limit, and its 429 responses carry no CORS header, so the browser does not call it. |
| Watchlist | `npm run watchlist:refresh` (live APIs; see below). |
| Mint / freeze authority | **Live** RPC read on row expand and on the coin page. Shows "none" only when the read succeeded and the value is null; a failed read shows a dash. |
| Payroll, holders, tenure, Service book | **Read-only** from `data/state`, `data/fees`, `data/payroll`. These are empty until the first coin launches. |
| Wallet connect, statement signing, payslip image | Built (Wallet Standard: Phantom, Solflare, Backpack). Signing is message-only. |
| Launch transaction | Built and **tested end to end on a local validator running the mainnet DBC program** (form → upload → transaction → wallet signature → confirmation). On mainnet the button stays hidden until `dbc_config_key` and `metadata_upload_url` are set. |
| Metadata hosting for launches | Built: `server/upload-worker.ts` (Cloudflare Worker → Pinata/IPFS). Needs deploying with your Pinata JWT. A local stand-in (`npm run localnet:upload`) is used for tests. |
| Referral, voting, shared walls | Not in this build. |

## Decision gates

**1. Fee routing: verified on the local chain; mainnet flag stays off until the mainnet config exists.**
`npm run verify:routing` reads the config back from chain and checks fee claimer = payroll wallet and creator share = 0%. On the local chain it passes (`localnet:setup` runs the same check). The fee-split copy now reads "100% of the coin's fee share → payroll" with a line that Meteora keeps 20%. Set `FEE_ROUTING_VERIFIED=1` (or `verified.feeRouting`) for mainnet after `verify:routing` passes there.
Read from `@meteora-ag/dynamic-bonding-curve-sdk` 2.0.0 (IDL and docs):
- A DBC pool config sets `fee_claimer` and `creator_trading_fee_percentage` at `create_config`. The program has **no instruction that changes either one** afterwards. The instruction list is in the SDK's IDL: no `update_config` exists, and `transfer_pool_creator` only moves the creator role, whose share is 0%. So once BENFIT's config exists, every pool launched under it routes the partner trading fee to the payroll wallet, and the creator gets 0%.
- Why the flag still stays `false`:
  1. The config does not exist on mainnet yet. Run `npm run dbc:config -- --confirm`, read the account back, then flip the flag.
  2. Meteora keeps **20% of the trading fee** (`PROTOCOL_FEE_PERCENT = 20`). "100% → payroll" holds for the partner + creator share, not for the whole fee. Before flipping the flag, either reword the split (e.g. "100% of the coin's fee share → payroll") or accept that reading.
  3. The fee claimer is a wallet BENFIT controls, so delivery to holders rests on trust (see trust model), not on the chain.
- Per-coin attribution: `npm run fees` records each claim transaction that touches a coin's DBC pool, with the payroll wallet's SOL delta, into `data/fees/<mint>.json`. `npm run fees -- claim --confirm` claims, run locally with the payroll key.

**2. Payout path: direct batched SOL transfers** (`scripts/payday.ts`, about 20 recipients per tx). No key in the repo, in CI or in the site. An option not adopted: a merkle-distributor claim flow (e.g. Jito's merkle-distributor) would let holders pull their share instead of BENFIT pushing it, at the cost of a claim tx per holder. Not switched.

**3. Launch cost: measured, 0.0245 SOL** (rent + signature fees, before any priority fee or first buy). `npm run localnet:setup` launches a coin under the BENFIT curve on a validator running the mainnet DBC and Metaplex programs and diffs the creator's balance. Rent does not differ between clusters, so mainnet uses `launch_cost_sol: 0.025`, `launchCost: true`. After the first mainnet launch, `npm run launch:cost` re-checks it there.

**4. Authorities:** read live from chain. The BENFIT config uses `TokenAuthorityOption.Immutable`, so launched coins should read "none" for the mint authority.

## Snapshot limitation

`scripts/snapshot.ts` runs hourly in GitHub Actions. A lower balance than last snapshot resets the wallet's clock (`lastOutflowAt`). **A sell and rebuy between two snapshots that ends at an equal or higher balance is not seen.** The DBC pool account and the payroll wallet are excluded from holders. With `HELIUS_RPC_URL` set it uses Helius `getTokenAccounts` (paginated); otherwise it uses `getProgramAccounts`, which most public RPCs refuse.

## Trust model

BENFIT runs payroll. The owner holds the payroll wallet key **locally**, never in CI or the repo. Every run is written to `data/payroll/<date>.json` with every transaction signature and shown in the Service book. The Payroll page shows the payroll wallet's live balance next to what is owed this week.

## Running payday safely

```
npm run snapshot && npm run fees                 # latest holders and fee claims
npm run payday                                   # DRY RUN: prints the table, sends nothing
PAYROLL_KEYPAIR=~/keys/payroll.json npm run payday -- --confirm
git add data/payroll && git commit -m "payroll <date>" && git push
```
`payday.ts` refuses to send without `--confirm`, refuses a key that is not `config.payroll_wallet`, refuses when the wallet holds less than is owed, refuses a period that already has a run, and writes the run file after every batch so no signature is lost. Run it after Friday 16:00 Stockholm; it pays the payday that just passed.

## Refreshing the watchlist

```
npm run watchlist:refresh      # PAGES=10 LIQ_FLOOR=50000 WATCHLIST_MAX=24 are optional
npm run market:cache
```
DexScreener has no "top by volume" listing, so candidates come from GeckoTerminal's Solana pools sorted by 24h volume. Each candidate is then confirmed on DexScreener: its deepest pair must be SOL-quoted and above the liquidity floor, and majors, stables, LSTs and tokenised stocks are dropped by symbol. No mint is typed by hand. To add mints pasted from Axiom, edit `data/watchlist.json` and run with `KEEP_PASTED=1`.


## Local test chain (everything working without real SOL)

The devnet faucet rate-limits most IPs, so the full flow runs on a local validator that clones Meteora's
DBC program and the Metaplex metadata program from mainnet: same on-chain code, unlimited test SOL.

```
npm run localnet:validator     # terminal 1
npm run localnet:upload        # terminal 2: local stand-in for the upload worker
npm run localnet:setup         # BENFIT config, routing read-back, launch cost, writes .env.localnet
npx playwright test -c playwright.localnet.config.ts launch     # launches $PENSION through the website
npm run localnet:story         # launches OVT, SHIFT, CLOCKIN; trades; 5 snapshots; fee claims; payday
npx playwright test -c playwright.localnet.config.ts statement  # statements, signing, payroll pages
npm run localnet:dev           # browse it (red "Local test chain" label in the header)
```
The story uses a simulated snapshot clock (`SNAPSHOT_NOW`) and payday time (`PAYDAY_AS_OF`) so tenure
builds up over "two weeks" in a few minutes. Both are refused when `NETWORK=mainnet`. Test wallets are
in `keys/devnet/` (gitignored). The four coin names are invented and exist only on the local chain.

Last run (2026-11-12): 4 coins launched (1 through the UI), 3 holders, 5 snapshots, 1 clock reset seen,
buying more did not reset, 0.71 SOL of fees claimed and attributed per coin, 9 payouts in 4 transactions,
creator paid 0 (sold during the week), 1% cap applied.

## Mainnet checklist (what is left, in order)

1. **Payroll wallet**: done. `rDLUvJ7oVBHSaBR2zMKvXm7Mv3vTNfqNrodCfzctNob`, key at `keys/mainnet/payroll.json`. Back the key file up offline now.
2. Fund it with about 0.1 SOL. Then `PAYER_KEYPAIR=keys/mainnet/payroll.json npm run dbc:config -- --confirm` and put the printed address in `dbc_config_key` (mainnet block of `src/config.ts`).
3. `npm run verify:routing`, then turn on `verified.feeRouting`.
4. Upload worker: create a Pinata account and JWT, then deploy `server/upload-worker.ts` (commands in the file). Put its URL in `metadata_upload_url`. The launch button appears.
5. Fill `site_url`, `x_url`, `telegram_url`, `repo_url`.
6. GitHub repo secret `HELIUS_RPC_URL` (free Helius key) for the hourly snapshot.
7. Launch $BENFIT from the site, then set `benfit_ca`.

## Owner setup, in order (reference)

1. Set `site_url`, `x_url`, `telegram_url`, `repo_url`, `payroll_wallet` in `src/config.ts`. Each empty value hides its element.
2. `npm run dbc:config` (dry run), review the curve (`INITIAL_MCAP_SOL`, `MIGRATION_MCAP_SOL`), then `PAYER_KEYPAIR=… npm run dbc:config -- --confirm` and set `dbc_config_key`.
3. Stand up metadata hosting and set `metadata_upload_url`.
4. `npm run launch:cost` and gate 3.
5. Add the `HELIUS_RPC_URL` repo secret and enable Pages (source: GitHub Actions).
6. After launching $BENFIT, set `benfit_ca`.

## Notes and justified grep hits

- `grep … placeholder` hits the HTML `placeholder` attribute of the search input, which holds the deck's string. `returns` hits two code comments where it is a verb.
- Tabular figures are used in tables and the countdown. Schibsted Grotesk's tabular set also widens `.` and `,`, which made prose and the payslip read "10 . 91", so other numbers use the default figures.
- The smoke test's banned-word check runs on live coin names. A market coin named with a banned word would fail it; refresh the watchlist if that happens.
- `fee_rate` (0.008) is an assumption used only for market-view "est." figures: 1% base fee less Meteora's 20%.
