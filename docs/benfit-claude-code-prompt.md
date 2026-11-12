# Claude Code prompt: BENFIT

You are building the website and MVP for **BENFIT ($BENFIT)**, a Solana launchpad. This is a new repo, not a reskin. The only reference is a screenshot of Bagwork's dashboard for the *level* of density and polish. Do not copy its layout, look, or copy.

**The project in one sentence:** BENFIT is a launchpad where a coin's fees are paid to its holders every Friday, weighted by how long they have held.

**The rule, exactly:**
- Points = tokens counted × days since the wallet's last sell or transfer out. Buying more does not reset days.
- A wallet counts at most 1% of supply. A wallet needs at least 100,000 tokens to be on payroll. (Both are config values.)
- Payday is Friday 16:00 Europe/Stockholm. The pool for a coin is the creator fees collected for it since the last payday, plus carried-over dust.
- A wallet's share = pool × its points ÷ total points. A share under 0.001 SOL (config) rolls into next week's pool.
- Fee split per coin: 100% payroll, 0% creator, 0% BENFIT. **Only claim this after gate 1 below passes.**
- Worked example the tests must reproduce: pool 20 SOL; Ana 10M × 30d = 300M, Ben 5M × 30d = 150M, Cy 10M × 10d = 100M; total 550M → 10.91 / 5.45 / 3.64 SOL.

All user-facing strings come from `benfit-copy-deck.md`. Put them in `src/copy.ts` and import from there. Do not improvise copy. Where the deck marks `[VERIFY]`, implement both the claim and the fallback line and switch between them from `config.verified.*` flags that default to `false`.

---

## Layer 1: structure rules

**Stack.** Vite + TypeScript, vanilla DOM (no React). GSAP + Flip. Hash routing. `base: './'` so it works on a GitHub Pages subpath. No server, no database. Fonts are self-hosted (Fontsource), no CDN requests for fonts.

**Routes (hash):** `#/` dashboard (default) · `#/payroll` · `#/statement` · `#/book` · `#/how` · `#/launch` · `#/coin/<mint>`.

**Config.** One `src/config.ts` object: `site_url`, `x_url`, `telegram_url`, `repo_url`, `benfit_ca`, `rpc_url`, `fee_rate`, `wallet_cap_pct` (1), `min_tokens` (100000), `dust_sol` (0.001), `tenure_cap_days` (null), `payday: { weekday: 5, time: '16:00', tz: 'Europe/Stockholm' }`, `verified: { feeRouting: false, launchCost: false }`. Any empty URL or address hides its element. No secrets in the repo; the RPC key is a restricted, domain-allowlisted key, or the public RPC.

**Data contracts (all JSON in `/data`, read by the site, written by scripts):**
- `data/watchlist.json`: `[{ "mint": "..." }]`. Market-view coins. Built by `npm run watchlist:refresh`, which asks the DexScreener API for top Solana pairs by 24h volume above a liquidity floor and writes the mints it returns. **Never type a mint address from memory.** The owner may also paste mints from Axiom into this file.
- `data/registry.json`: coins launched on BENFIT: `[{ mint, name, ticker, payrollWallet, launchedAt, launchTx }]`. Starts empty.
- `data/state/<mint>.json`: per-wallet `{ balance, firstSeenAt, lastOutflowAt }` plus `snapshotAt`.
- `data/payroll/<YYYY-MM-DD>.json`: one file per payday run: `{ period, snapshotAt, coins: [{ mint, pool_lamports, carry_lamports, rows: [{ wallet, balance, counted, tenureDays, points, share_lamports }], txs: [signature] }] }`.
- `data/market-cache.json`: last good market response with timestamp, used as a labelled fallback when the live fetch fails.

**Scripts (Node, in `/scripts`):**
- `snapshot.ts`: for each registry coin, read all token holders (Helius `getTokenAccounts`, paginated), compare to previous state: a lower balance sets `lastOutflowAt = now`; a first-seen wallet gets `firstSeenAt = now`. Tenure days = floor((payday − max(lastOutflowAt, firstSeenAt)) / 1 day). Runs in GitHub Actions every hour and commits `data/state`. Document the limitation: a sell and rebuy between two snapshots is not seen.
- `payday.ts`: **runs locally by the owner, never in CI.** Computes points and shares from the latest state, builds batched SOL transfers from the payroll wallet (about 20 recipients per transaction), refuses to send without `--confirm`, prints a dry-run table first, signs with a keypair file path from an env var, writes `data/payroll/<date>.json` with signatures, and carries dust forward.
- `fees.ts`: records creator-fee claims per coin so each coin's pool is attributable (see gate 1).

**Wallet.** Wallet Standard (Phantom, Solflare, Backpack). Features used: connect, `signMessage` for statements, and the launch transaction. No other transactions.

---

## Layer 2: decision gates (verify first, report in the README)

1. **Fee routing.** Check whether the launch platform (Meteora Dynamic Bonding Curve, per the owner's default) lets the launch set the creator-fee / partner-fee claimer to the payroll wallet and whether that setting can be changed afterwards. Read the SDK and docs. If it is fixed at launch, set `verified.feeRouting = true` and the copy may say the split is locked. If it can change, keep it `false`; the fallback copy ships and the README says why. Attribute fees per coin from claim transactions.
2. **Payout path.** Default is direct batched SOL transfers run by `payday.ts`. Do not store a signing key in the repo, in CI secrets, or in the site. If you find a merkle-claim tool that pays SOL and fits, describe it in the README as an option; do not switch without being asked.
3. **Launch cost.** Compute the real network fees and rent for one launch on the chosen platform. Set `verified.launchCost = true` only once measured, and put the measured number into config.
4. **Authorities.** Show "Mint authority: none" and "Freeze authority: none" only when read live from chain and null.

---

## Layer 2: design

**Where the design comes from.** A payroll console and a payslip. Swedish bike lease and benefits portals are calm, bright and administrative; the mark of a bike is reflective gear. The page should feel like a serious trading and payroll tool, not a landing page.

**Do not use** (these are the generic defaults): cream background, terracotta or warm clay accent, near-black with acid green, hairline broadsheet layout, identical rounded cards with the same soft grey shadow, gradient washes, tracked-out ALL-CAPS eyebrow labels, middle-dot meta strings, spaced-em-dash labels, monospace for small labels, `→` on buttons, numbered markers except the four steps in How it works, fade-and-slide-up on every section, hover transitions on every card, a single accented word in a headline.

**Tokens**
- Mist `#E7ECEE` page · Paper `#F8F9F9` surfaces · Baltic `#0F1E2E` ink and the dark band · Hi-vis `#F2E600` accent (fills only: tenure bars, payday chip, primary button; text on it is Baltic) · Paid `#0A7A4A` positive numbers · Rule `#C9D2D7` lines · Down `#B3261E` negative numbers.
- Check contrast: Baltic on Hi-vis and on Mist ≥ 7:1, Paid on Paper ≥ 4.5:1.
- Type: **Schibsted Grotesk**, one family. Weights 400/500/700. Tabular figures (`font-variant-numeric: tabular-nums`) on every number. Scale 12 / 14 / 16 / 20 / 28 / 44 / 72. Body lines under 75 characters. Sentence case everywhere.
- Radii: 4px for tables and data cells, 16px for the payslip only. Two levels of elevation at most; the table has none, just rules.

**First screen is the dashboard. No hero section, no loader.**

```
┌──────────────────────────────────────────────────────────────────────────┐
│ BENFIT  Coins Payroll My statement Service book How it works   [Connect] [Launch a coin] │
├──────────────────────────────────────────────────────────────────────────┤
│ Every coin pays its holders a benefit.            ┌ Next payday ────────┐ │
│ Trading fees go to the people who hold…           │ Friday 16:00        │ │
│                                                   │ 2d 21h 14m 08s     │ │
│                                                   │ Pool this week  X   │ │
│                                                   └─────────────────────┘ │
│ [tile] [tile] [tile] [tile]                                               │
├───────────────────────────────────────────────┬──────────────────────────┤
│ All | On payroll | Market view     [search]   │  Try the rule            │
│ Coin  Price 24h MCap Vol Weekly pool Holders 7d│  (worked example)       │
│ row … row … row … row … row … row …           │                          │
│                                               │  Payslip (printed)       │
└───────────────────────────────────────────────┴──────────────────────────┘
```

- Table is the hero: 56px rows, sticky header, sortable columns, keyboard up/down and Enter to expand, search by ticker or full CA, filter segmented control. 7d sparkline is inline SVG from GeckoTerminal OHLCV.
- Right column: "Try the rule" (the fixed worked example plus two inputs for a fourth holder) and the payslip card.
- Below the fold: Payroll rules strip, Service book (latest runs), How it works (four steps), footer risk line.

**The one memorable thing: the payslip prints.** When a wallet connects, or when "Try the rule" changes, the payslip card feeds out of a slot with a perforated bottom edge, line items landing one at a time with a ratchet ease (stepped, slightly mechanical, 40ms between lines). Everything else on the page stays quiet.

**Other motion (all `prefers-reduced-motion` aware, all off when reduced):**
- Payday countdown digits roll on change (GSAP, vertical, 120ms).
- Numbers in tiles count up once on first load.
- Table sort uses Flip so rows travel to their new position.
- Tenure bars (Hi-vis fills inside Mist tracks) draw in once on first reveal.
- No other entrance animation.

**Responsive.** Works at 320px: the table becomes a list with Coin, Price, 24h and Weekly pool; the rest moves into the expanded row. The right column stacks under the table. Tap targets ≥ 44px.

**Accessibility.** Visible focus rings (2px Baltic with 2px Hi-vis offset), table has proper `<table>` semantics, countdown has an `aria-live="off"` and a static text alternative, colour is never the only carrier of up/down (use +/− and arrows in text).

---

## Layer 2: data and truth rules

- **Market view uses real coins and real numbers.** Price, 24h change, market cap, 24h volume come live from the DexScreener API (`/latest/dex/tokens/{mint}` or the tokens endpoint for Solana), sparklines from GeckoTerminal. If CORS or rate limits block the live call, use `data/market-cache.json` and show the toast `Market data is not loading. Showing values from {time}.`
- **Weekly pool in market view** = 24h volume × `config.fee_rate` × 7, shown with `est.` and the basis line from the deck. It is never presented as a payout. The `fee_rate` default is a clearly named assumption in config; replace it once gate 1 is verified.
- **Rows are labelled** `Market view` and have no holders or tenure columns. Do not invent holder counts or tenure for coins that did not launch on BENFIT.
- **Rows for registry coins** read real holder state from `data/state` and real payroll from `data/payroll`. Until a coin exists, the `On payroll` filter shows the empty state from the deck, and the dashboard opens in market-view mode with the market-view tiles.
- **Never show the words** demo, sample, lorem, placeholder, mock, test.
- Worked-example numbers appear only inside "Try the rule" and are captioned `Worked example. These are not real holders.`
- No price, return or profit claims anywhere. Payouts depend on trading fees and can be zero; the footer says so.
- Statements are a message-only signature: sign `BENFIT statement` + wallet + coin + period + SHA-256 of the statement JSON. Say what a signature proves and does not.
- Share image is rendered client-side with canvas; footer carries site URL, date and the first 12 characters of the hash.

---

## Layer 2: quality rules

- **Tests (Vitest):** points formula against the worked example (assert 10.91 / 5.45 / 3.64 to two decimals and that shares sum to the pool); wallet cap; minimum balance; tenure reset on a lower balance; buying more does not reset; dust carry-over; a wallet that buys just before payday gets 0 points.
- **Smoke (Playwright):** load at 320, 768 and 1280, screenshot each, assert no horizontal scroll, assert no console errors, assert the banned words list never appears in the DOM.
- **Grep before finishing:** `grep -rniE "benefit coin|benefits|moon|100x|guarantee|profit|returns|airdrop|giveaway|reward|yield|demo|sample|lorem|placeholder|mock" src data README.md`. Fix or justify every hit. Confirm the ticker is spelled `$BENFIT` everywhere.
- **Performance:** first meaningful paint under 2s on a throttled mobile profile; no layout shift when market data arrives (reserve row heights).
- **Packaging:** `npm run build` outputs a static folder deployable on a GitHub Pages subpath; the Actions workflow for hourly snapshots is included; `payday.ts` is documented but not wired to CI.
- **README** must contain: what is live vs read-only vs not built; the four decision gates and their outcomes; the snapshot limitation; the trust model (BENFIT runs payroll, every run is public, owner holds the payroll key locally); how to run `payday.ts` safely (dry run first); how to refresh the watchlist.

**Not in this build:** referral bonus, voting, shared walls, anything needing a server. Do not add them and do not mention them in the UI.

**When finished, reply with a short summary of what you verified live versus what is read from cached files, the result of each gate, and anything that could not be tested from your environment.**
