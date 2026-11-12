// Every user-facing string, from docs/benfit-copy-deck.md. Do not improvise copy here.
// `{name}` tokens are filled by fill(). [VERIFY] lines carry a claim and a fallback;
// the site switches between them with config.verified.*.
// The `ui` block at the end holds the few interface labels the deck does not cover
// (accessible names and units); they carry no claims.

export const copy = {
  core: {
    sentence: "BENFIT is a launchpad where a coin's fees are paid to its holders every Friday, weighted by how long they have held.",
    tagline: 'Every coin pays its holders a benefit.',
    hooks: ['Paid by tenure.', 'Fees in. Payday Friday.', 'Sell and the clock restarts.'],
  },
  meta: {
    title: 'BENFIT | Every coin pays its holders a benefit',
    description:
      "BENFIT is a Solana launchpad where a coin's fees are paid to its holders every Friday, weighted by how long they have held.",
    ogTitle: 'BENFIT',
    ogDescription: 'Every coin pays its holders a benefit. Paid by tenure.',
    themeColor: '#0F1E2E',
  },
  nav: {
    logo: 'BENFIT',
    links: { coins: 'Coins', payroll: 'Payroll', statement: 'My statement', book: 'Service book', how: 'How it works' },
    connect: 'Connect wallet',
    launch: 'Launch a coin',
    ca: 'CA',
  },
  dashboard: {
    h1: 'Every coin pays its holders a benefit.',
    sub: 'Trading fees go to the people who hold, weighted by how long they have held. Sell and your clock restarts.',
    payday: {
      label: 'Next payday',
      value: 'Friday 16:00',
      tz: 'Stockholm time',
      yourTime: 'your time: {local}',
      units: { d: 'd', h: 'h', m: 'm', s: 's' },
      pool: 'Pool this week',
      howLink: 'How the pool is shared',
    },
    tilesLive: {
      paid: ['Paid to holders', 'SOL, all paydays'],
      coins: ['Coins on payroll', ''],
      holders: ['Holders on payroll', ''],
      longest: ['Longest tenure', 'days'],
    },
    tilesMarket: {
      tracked: ['Coins tracked', ''],
      volume: ['Volume tracked', '24h, USD'],
      pool: ['Weekly pool at current volume', 'est., if these coins ran the rule'],
      payday: ['Next payday', ''],
    },
    modes: { all: 'All', payroll: 'On payroll', market: 'Market view' },
    marketTip:
      'Real coins from the market. They did not launch on BENFIT. The pool figure shows what the rule would pay at their current volume.',
  },
  table: {
    cols: {
      coin: 'Coin',
      price: 'Price',
      ch24: '24h',
      mcap: 'Market cap',
      vol: 'Volume 24h',
      pool: 'Weekly pool',
      holders: 'Holders',
      spark: '7d',
    },
    badgePayroll: 'On payroll',
    badgeMarket: 'Market view',
    est: 'est.',
    search: 'Search ticker or contract address',
    expandLabel: 'Payslip for this coin',
    expand: {
      pool: 'Pool this week',
      counted: 'Holders counted',
      avgTenure: 'Average tenure',
      lastPayday: 'Last payday',
      mint: 'Mint authority',
      freeze: 'Freeze authority',
    },
    emptySearch: 'No coin matches that ticker or address. Paste a full contract address to look it up.',
    basis:
      'Prices and volume are live from DexScreener. Weekly pool for market-view rows assumes a {fee_rate} fee on 24h volume and is not a payout.',
  },
  rule: {
    heading: 'Try the rule',
    lede: 'Three holders share a 20 SOL pool. Add yourself as a fourth and watch the split move.',
    inputs: { tokens: 'Your tokens (millions)', days: 'Days since you last sold' },
    cols: { holder: 'Holder', tokens: 'Tokens', days: 'Days', points: 'Points', share: 'Share' },
    holders: [
      { name: 'Ana', tokens: 10, days: 30 },
      { name: 'Ben', tokens: 5, days: 30 },
      { name: 'Cy', tokens: 10, days: 10 },
    ],
    pool: 20,
    result: 'You: {points}M points. {share} SOL of 20.',
    caption: 'Worked example. These are not real holders.',
    line: 'Points are tokens counted times days since your last sell. A wallet that bought yesterday has 1 day.',
  },
  statement: {
    heading: 'My statement',
    notConnected: 'Connect a wallet to see its statement.',
    nothing: 'This wallet holds no coin on payroll.',
    browse: 'Browse coins',
    loading: 'Reading your balances',
    lines: {
      coin: 'Coin',
      counted: 'Tokens counted',
      tenure: 'Tenure',
      points: 'Points',
      share: "Share of this week's pool",
      expected: 'Expected pay',
      expectedNote: 'est. until payday',
      last: 'Last payday received',
      cap: 'Wallet cap applied',
    },
    save: 'Save payslip image',
    sign: 'Sign this statement',
    signHelp:
      'Signing sends nothing and moves no funds. It shows this wallet approved this statement. It does not show who you are.',
  },
  payroll: {
    heading: "This week's payroll",
    lede: 'Holders are read every hour. On Friday the pool is shared by points and paid in SOL.',
    facts: {
      snapshot: 'Snapshot',
      pool: 'Pool',
      points: 'Points on payroll',
      wallet: 'Payroll wallet holds',
      owed: 'Owed this week',
      dust: 'Dust carried over',
    },
    rules: [
      ['Points', 'tokens counted × days since your last sell'],
      ['Wallet cap', 'balances above 1% of supply are counted as 1%'],
      ['Minimum', '100,000 tokens to be on payroll'],
      ['Dust', 'a share under 0.001 SOL rolls into next week'],
      ['Buying more', 'does not reset your days'],
      ['Any sell or transfer out', 'resets your days to 0'],
    ] as [string, string][],
  },
  book: {
    heading: 'Service book',
    lede: 'Every payroll run, with the transactions that paid it.',
    cols: { date: 'Date', coin: 'Coin', pool: 'Pool', paid: 'Holders paid', txs: 'Transactions' },
    empty:
      'No payroll has run yet. The first run is posted here the Friday after the first coin launches, with a link to every transaction.',
    view: 'View on Solscan',
  },
  how: {
    heading: 'How it works',
    steps: [
      {
        title: 'A coin launches on BENFIT.',
        body: "Anyone launches from their own wallet. The coin's trading fees go to the payroll wallet. The creator gets 0%.",
        verify: 'feeRouting' as const,
        fallback:
          "Anyone launches from their own wallet. BENFIT collects the coin's creator fees and pays them out as payroll. Routing is set by the launch platform and is shown on the coin's page.",
      },
      { title: 'You hold.', body: 'Every hour BENFIT reads who holds the coin and since when. Nothing to sign up for.' },
      {
        title: 'Friday is payday.',
        body: 'The week’s pool is shared by points: tokens counted times days since your last sell. Paid in SOL straight to your wallet.',
      },
      { title: 'Sell and the clock restarts.', body: 'Any sell or transfer out sets your days back to 0. Buying more does not.' },
    ],
    split: ["100% of the coin's fee share → payroll", '0% → the creator', '0% → BENFIT'],
    splitNote: 'Meteora, the launch platform, keeps 20% of each trading fee. The rest is the coin\'s fee share.',
    splitFallback: 'The split for each coin is shown on its page, read from the launch platform.',
    trust:
      'BENFIT runs payroll. Every run is public, with transaction links, and the payroll wallet balance is shown next to what is owed.',
  },

  // How it works: FAQ and documentation (added at the owner's request, same voice and banned-word list as the deck).
  help: {
    tabs: { overview: 'Overview', faq: 'FAQ', docs: 'Documentation' },
    faqHeading: 'Questions',
    docsHeading: 'Documentation',
    docsLede: 'Everything BENFIT does is public. This is how each part works and where to check it.',
    faq: [
      ['What is BENFIT?', "A launchpad on Solana. Every coin launched on it sends its fee share to a payroll wallet, and every Friday that pool is paid to the coin's holders in SOL, weighted by how long each wallet has held."],
      ['How do I get paid?', 'Hold at least 100,000 tokens of a coin launched on BENFIT. There is nothing to sign up for. Payroll is sent after Friday 16:00 Stockholm time to the wallet that holds the tokens.'],
      ['How are my points counted?', 'Tokens counted times days since your last sell or transfer out. 10M tokens held for 30 days is 300M points. Your share of the week’s pool is your points divided by everyone’s points.'],
      ['What resets my days?', 'Any lower balance between two hourly snapshots: a sell, a transfer to another wallet, or a deposit to an exchange. Buying more does not reset your days.'],
      ['I moved tokens between my own wallets. Does that count as a sell?', 'Yes. The snapshot sees a lower balance and cannot know who owns the other wallet. Keep tokens in one wallet to keep your days.'],
      ['Why is there a 1% wallet cap?', 'So one large wallet cannot take most of the pool. A balance above 1% of supply is counted as 1%.'],
      ['What happens to very small shares?', 'A share under 0.001 SOL rolls into next week’s pool instead of being paid, so network fees do not eat it.'],
      ['Where does the pool come from?', "The coin's trading fees. Meteora, the launch platform, keeps 20% of each fee. The rest is the coin's fee share, and all of it goes to the payroll wallet. The creator gets 0% and BENFIT gets 0%."],
      ['Can the split change after a coin launches?', 'The fee claimer and the creator share are set in the BENFIT launch config on chain. The launch program has no instruction to change either one, so they are the same for every coin, for its whole life.'],
      ['Can a payday be zero?', 'Yes. The pool is whatever the coin earned in fees that week. A quiet week pays little or nothing.'],
      ['Who sends the payouts?', 'BENFIT runs payroll from the payroll wallet. Every run is posted in the Service book with a link to each transaction, and the Payroll page shows the wallet balance next to what is owed.'],
      ['Can I check my pay myself?', 'Yes. My statement works it out from the same public files the payroll uses, and every run is a public file you can download and recompute.'],
      ['What does signing a statement prove?', 'That this wallet approved this statement. Signing sends nothing and moves no funds, and it does not show who you are.'],
      ['How often are holders read?', 'Every hour. A sell and a rebuy inside the same hour that ends at the same or a higher balance is not seen.'],
      ['What does it cost to launch a coin?', 'Network fees and rent, about {launch_cost} SOL, plus your first buy if you make one. There is no launch fee.'],
      ['What is Market view?', 'Real coins from the market that did not launch on BENFIT. Their pool figure is an estimate of what the rule would pay at their current volume. It is not a payout.'],
      ['Is this financial advice?', 'No. Coins can lose all their value, and payouts depend on trading fees and can be zero.'],
    ] as [string, string][],
    docs: [
      {
        id: 'rule',
        title: 'The rule',
        body: [
          'Points = tokens counted × days since the wallet’s last sell or transfer out.',
          'Tokens counted is the wallet’s balance, capped at 1% of supply. A wallet needs at least 100,000 tokens to be on payroll.',
          'Days are whole days from the later of the wallet’s first snapshot and its last lower balance, up to payday. A wallet that bought yesterday has 1 day; a wallet that bought an hour before payday has 0.',
          'Share = pool × the wallet’s points ÷ all points on payroll. Shares under 0.001 SOL roll into next week.',
        ],
      },
      {
        id: 'week',
        title: 'A week of payroll',
        body: [
          'Every hour: holders of every BENFIT coin are read from chain and compared with the last snapshot.',
          'During the week: the coin’s fee share is claimed into the payroll wallet. Each claim is recorded against the coin it came from.',
          'Friday 16:00 Stockholm time: the pool for each coin is the fees claimed since the last payday plus any dust carried over. Shares are worked out and a dry run is checked.',
          'After 16:00: SOL is sent in batches of about 20 wallets per transaction. The run is posted in the Service book with every transaction.',
        ],
      },
      {
        id: 'fees',
        title: 'Fees and routing',
        body: [
          'Coins launch on Meteora’s Dynamic Bonding Curve under one BENFIT launch config.',
          'That config sets the fee claimer to the payroll wallet and the creator share to 0%. The launch program has no instruction that changes either after the config is created.',
          'Trading fee: 1% of each trade. Meteora keeps 20% of it, so 0.8% of volume reaches the payroll wallet.',
          'When a coin completes its curve, it moves to a Meteora DAMM v2 pool. The liquidity is locked permanently and its fees also go to the payroll wallet.',
        ],
      },
      {
        id: 'launch',
        title: 'Launch settings',
        body: [
          'Supply: 1,000,000,000 tokens, 6 decimals.',
          'Mint authority: none after launch. Nobody can mint more.',
          'Creator share of fees: 0%.',
          'Launch cost: network fees and rent, plus the creator’s optional first buy, made in the same transaction so nobody can buy in between.',
        ],
      },
      {
        id: 'data',
        title: 'Public data',
        body: [
          'registry.json lists every coin launched on BENFIT.',
          'state/<mint>.json holds each holder’s balance, first snapshot and last lower balance.',
          'fees/<mint>.json lists every fee claim for a coin, with its transaction.',
          'payroll/<date>.json is a full payroll run: pool, every wallet’s points and share, and the transactions that paid it.',
        ],
      },
      {
        id: 'verify',
        title: 'Check a payout yourself',
        body: [
          'Open the run in the Service book and download payroll/<date>.json.',
          'Find your wallet: its balance, tokens counted, days, points and share are all listed.',
          'Add up everyone’s points, then share = pool × your points ÷ total. It should match to the lamport.',
          'Open the transaction link and check the SOL arrived in your wallet.',
        ],
      },
    ],
    glossary: [
      ['Tenure', 'Days since a wallet’s last sell or transfer out.'],
      ['Points', 'Tokens counted × tenure.'],
      ['Pool', 'The fees a coin earned since the last payday, plus dust carried over.'],
      ['Dust', 'Shares under 0.001 SOL, carried to next week.'],
      ['Payroll wallet', 'The wallet that receives the fee share and sends payroll.'],
      ['Snapshot', 'An hourly read of every holder’s balance.'],
    ] as [string, string][],
    glossaryHeading: 'Glossary',
    dataLink: 'Open the file',
  },
  launch: {
    heading: 'Launch a coin',
    lede: 'One signature. The payroll rule is the same for every coin.',
    fields: { name: 'Name', ticker: 'Ticker', image: 'Image', description: 'Description', firstBuy: 'First buy in SOL (optional)' },
    ruleCard: 'Payroll rule for this coin',
    cost: 'Cost: about {launch_cost} SOL in network fees and rent, plus your first buy. No launch fee.',
    submit: 'Launch coin',
    errors: {
      name: 'Name is required.',
      ticker: 'Ticker must be 2 to 10 letters or numbers.',
      tickerTaken: 'That ticker is already on BENFIT. Pick another.',
      image: 'Image must be PNG, JPG or GIF under 2 MB.',
    },
    success: 'Coin launched. Open its page.',
    open: 'Open coin page',
  },
  toast: {
    connected: 'Wallet connected',
    disconnected: 'Wallet disconnected',
    copied: 'Address copied',
    signed: 'Statement signed',
    saved: 'Payslip image saved',
    market: 'Market data is not loading. Showing values from {time}.',
    rpc: 'The network is not answering. Your balances may be out of date.',
    noWallet: 'No Solana wallet found. Install Phantom, Solflare or Backpack.',
    refused: 'You declined the signature. Nothing was sent.',
    unconfirmed: 'The transaction did not confirm. Check your wallet history before trying again.',
  },
  footer: {
    left: 'BENFIT. Paid by tenure.',
    risk:
      'Not financial advice. Coins can lose all their value. Payouts depend on trading fees and can be zero. Verify the contract address on the official X.',
  },
  ui: {
    none: 'none',
    sortBy: 'Sort by {col}',
    copyCa: 'Copy contract address',
    disconnect: 'Disconnect',
    chooseWallet: 'Choose a wallet',
    days: 'days',
    sol: 'SOL',
    you: 'You',
    menu: 'Menu',
    close: 'Close',
    countdownAlt: 'Next payday is {date}, Stockholm time.',
    social: { x: 'X', telegram: 'Telegram', github: 'GitHub' },
    network: { devnet: 'Devnet', localnet: 'Local test chain' } as Record<string, string>,
  },
};

export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}
