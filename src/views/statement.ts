// My statement: the connected wallet's payslip per coin on payroll.
import { config } from '../config';
import { copy } from '../copy';
import { dateOnly, int, short, sol } from '../lib/format';
import { payrollSummary } from '../lib/payroll';
import { computePayroll, lamportsToSol, solToLamports } from '../lib/rule';
import { tokenBalances } from '../lib/rpc';
import { tenureDays } from '../lib/state';
import { ymd } from '../lib/time';
import { h, sha256Hex, toast } from '../lib/ui';
import * as wallet from '../lib/wallet';
import { openConnect } from '../shell';
import { createPrinter, type Slip } from './payslip';

export interface StatementData {
  slip: Slip;
  json: Record<string, unknown>;
  mint: string;
}

/** Real statements for `owner`. Null if the RPC did not answer. */
export async function statements(owner: string): Promise<StatementData[] | null> {
  const s = await payrollSummary();
  if (!s.coins.length) return [];
  let balances: Map<string, bigint>;
  try {
    balances = await tokenBalances(owner, s.coins.map((c) => c.coin.mint));
  } catch {
    toast(copy.toast.rpc);
    return null;
  }
  const L = copy.statement.lines;
  const period = ymd(s.payday, config.payday.tz);
  const out: StatementData[] = [];
  for (const c of s.coins) {
    const bal = balances.get(c.coin.mint) ?? 0n;
    if (bal === 0n || !c.state) continue;
    const known = c.state.wallets[owner];
    const days = known ? tenureDays(known, s.payday) : 0;
    // Recompute with the live balance in place of the snapshot balance for this wallet.
    const holders = Object.entries(c.state.wallets).map(([w, x]) => ({
      wallet: w,
      balance: w === owner ? bal : BigInt(x.balance),
      tenureDays: w === owner ? days : tenureDays(x, s.payday),
    }));
    if (!known) holders.push({ wallet: owner, balance: bal, tenureDays: 0 });
    const res = computePayroll(holders, {
      poolLamports: c.poolLamports,
      carryLamports: c.carryLamports,
      supply: BigInt(c.state.supply),
      decimals: c.state.decimals,
      capPct: config.wallet_cap_pct,
      minTokens: config.min_tokens,
      dustLamports: solToLamports(config.dust_sol),
      tenureCapDays: config.tenure_cap_days,
    });
    const me = res.rows.find((r) => r.wallet === owner)!;
    const unit = 10n ** BigInt(c.state.decimals);
    const lastRun = s.runs.find((r) => r.coins.some((x) => x.mint === c.coin.mint));
    const lastMine = lastRun?.coins.find((x) => x.mint === c.coin.mint)?.rows.find((r) => r.wallet === owner);
    const sharePct = res.totalPoints > 0n ? (Number(me.points) / Number(res.totalPoints)) * 100 : 0;
    const lines: [string, string][] = [
      [L.coin, `$${c.coin.ticker}`],
      [L.counted, int(Number(me.counted / unit))],
      [L.tenure, `${me.tenureDays} ${copy.ui.days}`],
      [L.points, int(Number(me.points / unit))],
      [L.share, `${sharePct.toFixed(2)}%`],
      [L.last, lastMine && lastRun ? `${sol(lamportsToSol(BigInt(lastMine.share_lamports)), 4)} SOL, ${dateOnly(lastRun.period)}` : '–'],
    ];
    if (me.capped) lines.push([L.cap, `${config.wallet_cap_pct}%`]);
    const json = {
      wallet: owner,
      coin: c.coin.mint,
      period,
      balance: bal.toString(),
      counted: me.counted.toString(),
      tenureDays: me.tenureDays,
      points: me.points.toString(),
      totalPoints: res.totalPoints.toString(),
      expectedLamports: me.shareLamports.toString(),
      snapshotAt: c.state.snapshotAt,
    };
    out.push({
      mint: c.coin.mint,
      json,
      slip: {
        title: short(owner),
        sub: period,
        lines,
        total: { label: L.expected, note: L.expectedNote, value: `${sol(lamportsToSol(me.shareLamports), 4)} SOL` },
      },
    });
  }
  return out;
}

export async function statementSlips(owner: string): Promise<Slip[] | null> {
  const s = await statements(owner);
  return s?.map((x) => x.slip) ?? null;
}

export default function statementPage(root: HTMLElement) {
  const st = copy.statement;
  const page = h(`<div class="wrap page"><h1>${st.heading}</h1><div data-body style="margin-top:24px"></div></div>`);
  root.append(page);
  const body = page.querySelector('[data-body]') as HTMLElement;

  async function render() {
    const addr = wallet.address();
    body.innerHTML = '';
    if (!addr) {
      const el = h(`<div class="rel"><p class="note">${st.notConnected}</p><p style="margin-top:12px"><button class="btn btn-primary" type="button">${copy.nav.connect}</button></p></div>`);
      const btn = el.querySelector('button')!;
      btn.addEventListener('click', () => openConnect(el, btn));
      body.append(el);
      return;
    }
    body.append(h(`<p class="note" aria-live="polite">${st.loading}</p>`));
    const list = await statements(addr);
    if (wallet.address() !== addr) return;
    body.innerHTML = '';
    if (list === null) return;
    if (!list.length) {
      body.append(h(`<div><p class="note">${st.nothing}</p><p style="margin-top:12px"><a class="btn btn-ghost" href="#/">${st.browse}</a></p></div>`));
      return;
    }
    const grid = h('<div class="two"></div>');
    body.append(grid);
    for (const item of list) {
      const col = h('<div style="max-width:420px"></div>');
      const printer = createPrinter(col);
      const hash = await sha256Hex(JSON.stringify(item.json));
      item.slip.foot = [config.site_url, item.json.period as string, hash.slice(0, 12)].filter(Boolean).join('  ');
      printer.print(item.slip, true);
      const actions = h(`<div><div class="slip-actions"><button class="btn btn-ghost" type="button" data-save>${st.save}</button><button class="btn btn-primary" type="button" data-sign>${st.sign}</button></div><p class="note" style="margin-top:10px;max-width:46ch">${st.signHelp}</p></div>`);
      col.append(actions);
      actions.querySelector('[data-save]')!.addEventListener('click', () => {
        saveImage(item.slip, hash);
        toast(copy.toast.saved);
      });
      actions.querySelector('[data-sign]')!.addEventListener('click', async () => {
        const msg = ['BENFIT statement', addr, item.mint, item.json.period, hash].join('\n');
        try {
          await wallet.signMessage(new TextEncoder().encode(msg));
          toast(copy.toast.signed);
        } catch (e) {
          if (wallet.isRejection(e)) toast(copy.toast.refused);
        }
      });
      grid.append(col);
    }
  }
  render();
  const unsub = wallet.subscribe(render);
  return () => {
    unsub();
  };
}

/** Client-side PNG of the payslip. Footer: site URL, date, first 12 characters of the hash. */
function saveImage(s: Slip, hash: string) {
  const W = 720;
  const lineH = 52;
  const H = 180 + (s.lines.length + 1) * lineH + 90;
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const g = c.getContext('2d')!;
  g.scale(2, 2);
  g.fillStyle = '#E7ECEE';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#F8F9F9';
  g.beginPath();
  g.roundRect(32, 24, W - 64, H - 48, [0, 0, 16, 16]);
  g.fill();
  g.fillStyle = '#0F1E2E';
  g.fillRect(24, 16, W - 48, 14);
  const font = (w: number, size: number) => `${w} ${size}px "Schibsted Grotesk", system-ui, sans-serif`;
  g.font = font(700, 26);
  g.fillText('BENFIT', 64, 84);
  g.font = font(400, 16);
  g.fillStyle = '#44525E';
  g.textAlign = 'right';
  g.fillText(`${s.title}  ${s.sub}`, W - 64, 84);
  g.fillStyle = '#0F1E2E';
  g.fillRect(64, 104, W - 128, 2);
  let y = 150;
  for (const [k, v] of [...s.lines, [s.total.label, s.total.value] as [string, string]]) {
    const total = k === s.total.label;
    g.textAlign = 'left';
    g.fillStyle = '#44525E';
    g.font = font(400, 18);
    g.fillText(k, 64, y);
    g.textAlign = 'right';
    g.fillStyle = total ? '#0A7A4A' : '#0F1E2E';
    g.font = font(total ? 700 : 500, total ? 26 : 18);
    g.fillText(v, W - 64, y);
    if (!total) {
      g.fillStyle = '#C9D2D7';
      g.fillRect(64, y + 18, W - 128, 1);
    }
    y += lineH;
  }
  g.textAlign = 'left';
  g.fillStyle = '#44525E';
  g.font = font(400, 14);
  const foot = [config.site_url, new Date().toISOString().slice(0, 10), hash.slice(0, 12)].filter(Boolean).join('   ');
  g.fillText(foot, 64, H - 52);
  const a = document.createElement('a');
  a.download = `benfit-payslip-${hash.slice(0, 12)}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
}
