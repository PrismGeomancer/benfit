import { config } from '../config';
import { copy } from '../copy';
import { loadCoins, lookupMint, type CoinRow } from '../lib/coins';
import { esc, pct, pctLabel, sol, usdCompact, usdPrice } from '../lib/format';
import { payrollSummary } from '../lib/payroll';
import { lamportsToSol } from '../lib/rule';
import { mintInfo } from '../lib/rpc';
import { copyText, drawBars, h, sparkSvg, toast } from '../lib/ui';
import { coinHolders } from './payroll';
import { fill } from '../copy';

export default function coin(root: HTMLElement, mint?: string) {
  const page = h('<div class="wrap page"></div>');
  root.append(page);
  if (!mint) return;
  (async () => {
    const [{ rows }, summary] = await Promise.all([loadCoins(), payrollSummary()]);
    let row: CoinRow | null = rows.find((r) => r.mint === mint) ?? null;
    row ??= await lookupMint(mint);
    const pc = summary.coins.find((c) => c.coin.mint === mint);
    const t = copy.table;
    const e = t.expand;
    const symbol = pc ? pc.coin.ticker : (row?.symbol ?? mint.slice(0, 4));
    const name = pc ? pc.coin.name : (row?.name ?? '');
    const ch = pct(row?.m?.change24 ?? null);
    const pool = pc
      ? `${sol(lamportsToSol(pc.poolLamports + pc.carryLamports))} SOL`
      : row?.weeklyPoolUsd != null
        ? `${usdCompact(row.weeklyPoolUsd)} ${t.est}`
        : '–';
    page.innerHTML = '';
    page.append(
      h(`<div>
      <h1>$${esc(symbol)} <span class="badge ${pc ? 'on' : ''}" style="font-size:var(--f14);height:28px">${pc ? t.badgePayroll : t.badgeMarket}</span></h1>
      <p class="lede">${esc(name)}</p>
      <p style="margin-top:12px"><span class="ca-chip num">${copy.nav.ca} ${esc(mint)}<button type="button" data-copy aria-label="${copy.ui.copyCa}">⧉</button></span></p>
      ${pc ? '' : `<p class="note" style="margin-top:12px;max-width:70ch">${copy.dashboard.marketTip}</p>`}
      <div class="facts">
        <div><div class="k">${t.cols.price}</div><div class="v num">${usdPrice(row?.m?.priceUsd ?? null)}</div></div>
        <div><div class="k">${t.cols.ch24}</div><div class="v num ${ch.cls}">${ch.text}</div></div>
        <div><div class="k">${t.cols.mcap}</div><div class="v num">${usdCompact(row?.m?.marketCap ?? null)}</div></div>
        <div><div class="k">${t.cols.vol}</div><div class="v num">${usdCompact(row?.m?.volume24 ?? null)}</div></div>
        <div><div class="k">${e.pool}</div><div class="v num">${pool}</div></div>
        <div><div class="k">${t.cols.spark}</div><div class="v">${sparkSvg(row?.m?.spark ?? null, 140, 32)}</div></div>
      </div>
      <div class="facts">
        <div><div class="k">${e.mint}</div><div class="v num" data-a="mint"><span class="skeleton"></span></div></div>
        <div><div class="k">${e.freeze}</div><div class="v num" data-a="freeze"><span class="skeleton"></span></div></div>
        <div><div class="k">${e.counted}</div><div class="v num">${pc?.result ? pc.result.rows.filter((r) => r.points > 0n).length : '–'}</div></div>
      </div>
      ${pc ? '' : `<p class="basis" style="padding-left:0;border:0">${fill(t.basis, { fee_rate: pctLabel(config.fee_rate) })}</p>`}
      <div data-holders></div>
    </div>`),
    );
    page.querySelector('[data-copy]')!.addEventListener('click', () => {
      copyText(mint);
      toast(copy.toast.copied);
    });
    if (pc) {
      page.querySelector('[data-holders]')!.append(coinHolders(pc));
      drawBars(page);
    }
    const info = await mintInfo(mint);
    const show = (v: string | null | undefined) => (info ? (v === null ? copy.ui.none : `${v!.slice(0, 4)}…${v!.slice(-4)}`) : '–');
    page.querySelector('[data-a=mint]')!.textContent = show(info?.mintAuthority);
    page.querySelector('[data-a=freeze]')!.textContent = show(info?.freezeAuthority);
  })();
}
