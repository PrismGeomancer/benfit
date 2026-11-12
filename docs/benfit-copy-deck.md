# BENFIT copy deck

Ticker spelling, everywhere: **$BENFIT** (B-E-N-F-I-T, no second E).
Existing look-alikes on Solana: two tokens called $BENEFITS and several $BEN. The contract address is always shown next to the ticker.

Conventions
- `[VERIFY]` = a claim that may only ship if the fee-routing / payout check in the Claude Code prompt passes. If it fails, use the fallback line given.
- `{config}` = value comes from the config object. If empty, the element is hidden, never shown blank.
- No italic or colored single-word accent in any headline. Headlines are set plain.
- Banned in all copy: yield, reward, APY, returns, profit, guaranteed, passive income, airdrop, giveaway, moon, 100x.
- Never use in the UI: demo, sample, lorem, placeholder, mock, test data.

---

## 0. Core lines

One sentence (what the project is):
> BENFIT is a launchpad where a coin's fees are paid to its holders every Friday, weighted by how long they have held.

Tagline:
> Every coin pays its holders a benefit.

Short hooks:
- Paid by tenure.
- Fees in. Payday Friday.
- Sell and the clock restarts.

---

## 1. Meta

- title: `BENFIT | Every coin pays its holders a benefit`
- description: `BENFIT is a Solana launchpad where a coin's fees are paid to its holders every Friday, weighted by how long they have held.`
- og:title: `BENFIT`
- og:description: `Every coin pays its holders a benefit. Paid by tenure.`
- theme-color: `#0F1E2E`

## 2. Nav and top bar

- Logo text: `BENFIT`
- Links: `Coins` · `Payroll` · `My statement` · `Service book` · `How it works`
- Buttons: `Connect wallet` (connected state: first 4 + last 4 of the address) · `Launch a coin`
- Social icons: X `{x_url}`, Telegram `{telegram_url}`, GitHub `{repo_url}` (each hidden when empty)
- Contract chip: `CA` + shortened `{benfit_ca}` with copy icon (hidden until `{benfit_ca}` is set)

## 3. Dashboard (first screen)

Page heading (H1):
> Every coin pays its holders a benefit.

Sub line (one sentence, max 2 lines):
> Trading fees go to the people who hold, weighted by how long they have held. Sell and your clock restarts.

Payday strip
- Label: `Next payday`
- Value: `Friday 16:00` + small `Stockholm time` (and `your time: {local}` when different)
- Countdown units: `d` `h` `m` `s`
- Next to countdown: `Pool this week` + SOL value
- Link: `How the pool is shared` (scrolls to How it works)

Tiles, **payroll live** state (at least one coin on payroll):
- `Paid to holders` / `SOL, all paydays`
- `Coins on payroll`
- `Holders on payroll`
- `Longest tenure` / `days`

Tiles, **market view** state (no coin on payroll yet):
- `Coins tracked`
- `Volume tracked` / `24h, USD`
- `Weekly pool at current volume` / `est., if these coins ran the rule`
- `Next payday`

Mode switch above the table (segmented): `All` · `On payroll` · `Market view`
- Tooltip on `Market view`: `Real coins from the market. They did not launch on BENFIT. The pool figure shows what the rule would pay at their current volume.`

## 4. Coin table

Columns: `Coin` · `Price` · `24h` · `Market cap` · `Volume 24h` · `Weekly pool` · `Holders` · `7d`
- `Holders` and the on-payroll columns show a dash for market-view rows.
- Row badges: `On payroll` (coins launched on BENFIT) · `Market view` (watchlist coins)
- Weekly pool for market-view rows is suffixed `est.`
- Search placeholder: `Search ticker or contract address`
- Row expand label: `Payslip for this coin`
- Row expand lines: `Pool this week` · `Holders counted` · `Average tenure` · `Last payday` · `Mint authority` · `Freeze authority`
- Empty search: `No coin matches that ticker or address. Paste a full contract address to look it up.`
- Basis line under the table (always visible, one line):
> Prices and volume are live from DexScreener. Weekly pool for market-view rows assumes a {fee_rate} fee on 24h volume and is not a payout.

## 5. Try the rule

Heading: `Try the rule`
Lede:
> Three holders share a 20 SOL pool. Add yourself as a fourth and watch the split move.

Inputs: `Your tokens (millions)` · `Days since you last sold`
Table (fixed worked example, labelled):
| Holder | Tokens | Days | Points | Share |
|---|---|---|---|---|
| Ana | 10M | 30 | 300M | 10.91 SOL |
| Ben | 5M | 30 | 150M | 5.45 SOL |
| Cy | 10M | 10 | 100M | 3.64 SOL |

Result line: `You: {points}M points. {share} SOL of 20.`
Caption: `Worked example. These are not real holders.`
Rule line under the example:
> Points are tokens counted times days since your last sell. A wallet that bought yesterday has 1 day.

## 6. My statement (payslip)

Page heading: `My statement`

States
- Not connected: `Connect a wallet to see its statement.` + button `Connect wallet`
- Connected, nothing on payroll: `This wallet holds no coin on payroll.` + `Browse coins`
- Loading: `Reading your balances`
- Ready: payslip card

Payslip lines
- `Coin`
- `Tokens counted`
- `Tenure` (days)
- `Points`
- `Share of this week's pool`
- `Expected pay` + `est. until payday`
- `Last payday received`
- `Wallet cap applied` (shown only when the 1% cap cut the balance)

Buttons: `Save payslip image` · `Sign this statement`
Sign helper:
> Signing sends nothing and moves no funds. It shows this wallet approved this statement. It does not show who you are.
Footer on the image: `{site_url}` + date + statement hash (first 12 characters)

## 7. Payroll page

Heading: `This week's payroll`
Lede:
> Holders are read every hour. On Friday the pool is shared by points and paid in SOL.

Facts block
- `Snapshot` / `{last_snapshot_time}`
- `Pool` / `{pool} SOL`
- `Points on payroll` / `{points}`
- `Payroll wallet holds` / `{wallet_balance} SOL`
- `Owed this week` / `{owed} SOL`
- `Dust carried over` / `{dust} SOL`

Rules table
- `Points`: tokens counted × days since your last sell
- `Wallet cap`: balances above 1% of supply are counted as 1%
- `Minimum`: 100,000 tokens to be on payroll
- `Dust`: a share under 0.001 SOL rolls into next week
- `Buying more`: does not reset your days
- `Any sell or transfer out`: resets your days to 0

## 8. Service book

Heading: `Service book`
Lede: `Every payroll run, with the transactions that paid it.`
Columns: `Date` · `Coin` · `Pool` · `Holders paid` · `Transactions`
Empty state:
> No payroll has run yet. The first run is posted here the Friday after the first coin launches, with a link to every transaction.
Row action: `View on Solscan`

## 9. How it works

Heading: `How it works`
1. **A coin launches on BENFIT.**
   `Anyone launches from their own wallet. The coin's trading fees go to the payroll wallet. The creator gets 0%.` `[VERIFY: fee routing]`
   Fallback if routing cannot be locked: `Anyone launches from their own wallet. BENFIT collects the coin's creator fees and pays them out as payroll. Routing is set by the launch platform and is shown on the coin's page.`
2. **You hold.**
   `Every hour BENFIT reads who holds the coin and since when. Nothing to sign up for.`
3. **Friday is payday.**
   `The week's pool is shared by points: tokens counted times days since your last sell. Paid in SOL straight to your wallet.`
4. **Sell and the clock restarts.**
   `Any sell or transfer out sets your days back to 0. Buying more does not.`

Fee split list (`[VERIFY]`; if not verified, show the fallback sentence instead):
- `100% → payroll`
- `0% → the creator`
- `0% → BENFIT`
Fallback: `The split for each coin is shown on its page, read from the launch platform.`

Trust note (always shown):
> BENFIT runs payroll. Every run is public, with transaction links, and the payroll wallet balance is shown next to what is owed.

## 10. Launch a coin

Heading: `Launch a coin`
Lede: `One signature. The payroll rule is the same for every coin.`
Fields: `Name` · `Ticker` · `Image` · `Description` · `First buy in SOL (optional)`
Rule card (read-only): `Payroll rule for this coin` + the six facts from section 7
Cost line: `Cost: about {launch_cost} SOL in network fees and rent, plus your first buy. No launch fee.` `[VERIFY]`
Primary button: `Launch coin`
Validation
- `Name is required.`
- `Ticker must be 2 to 10 letters or numbers.`
- `That ticker is already on BENFIT. Pick another.`
- `Image must be PNG, JPG or GIF under 2 MB.`
Success: `Coin launched. Open its page.` · Link `Open coin page`

## 11. Toasts, errors, empty states

- Wallet connected: `Wallet connected`
- Wallet disconnected: `Wallet disconnected`
- Address copied: `Address copied`
- Statement signed: `Statement signed`
- Payslip saved: `Payslip image saved`
- Market data failed: `Market data is not loading. Showing values from {time}.`
- RPC failed: `The network is not answering. Your balances may be out of date.`
- Wallet not found: `No Solana wallet found. Install Phantom, Solflare or Backpack.`
- Signature refused: `You declined the signature. Nothing was sent.`
- Transaction not confirmed: `The transaction did not confirm. Check your wallet history before trying again.`

## 12. Footer

Left: `BENFIT. Paid by tenure.`
Links: `Coins` · `Payroll` · `My statement` · `Service book` · `How it works`
Risk line (always):
> Not financial advice. Coins can lose all their value. Payouts depend on trading fees and can be zero. Verify the contract address on the official X.

---

## 13. X post (long)

Open any memecoin that ran this year and ask who got paid. The creator got the fees. The platform took a cut. The people who held through the red candles got nothing.

Today I'm opening BENFIT, a launchpad on Meteora where every coin pays its holders a benefit: the fees it earns, shared every Friday by how long each wallet has held.

Sell and the clock restarts.

The problem

Holder payouts usually go to whoever holds at the snapshot. So the fastest wallet buys an hour before and takes a share. Holding for a month earns the same as holding for an hour.

Why tenure

Points are tokens counted times days since your last sell. Buy an hour before payday and you have 0 days, which is 0 points. Hold since day one and your share grows every day you don't sell.

How it works

1. Launch a coin from your wallet. One signature.
2. Holders are read every hour.
3. On Friday the week's pool is shared by points and paid in SOL.
4. Any sell or transfer out resets your days to 0. Buying more doesn't.

Where the fee goes `[VERIFY]`

100% → payroll
0% → the creator
0% → BENFIT

A worked example

A coin's pool is 20 SOL. Ana holds 10M tokens for 30 days: 300M points. Ben holds 5M for 30 days: 150M. Cy holds 10M for 10 days: 100M. Total 550M. Ana gets 10.91 SOL, Ben 5.45, Cy 3.64.

The limits

A wallet counts at most 1% of supply. You need 100,000 tokens to be on payroll. A share under 0.001 SOL rolls into next week.

Cost to launch `[VERIFY]`

About {launch_cost} SOL in network fees and rent, plus your first buy. No launch fee.

The service book

Every payroll run is public, with a link to every transaction. The payroll wallet balance sits next to what is owed.

{site_url}

### One-line version
Launch a coin that pays its holders every Friday, by how long they've held.

### Short version
Every coin pays its holders a benefit.
The fees it earns, shared every Friday by how long each wallet has held.
Sell and the clock restarts.
{site_url}

---

## 14. Self-check log

- Ticker spelled `$BENFIT` in every section above.
- Every number in the X post matches the worked example in sections 5 and 13 (300M + 150M + 100M = 550M; 10.91 + 5.45 + 3.64 = 20.00).
- Lines tagged `[VERIFY]` do not ship until the corresponding check passes.
- Referral bonus is not in this deck. It needs attribution infrastructure and is a later phase.
