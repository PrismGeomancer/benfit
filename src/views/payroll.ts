import { config, explorerAccount } from '../config';
import { copy } from '../copy';
import { compactNum, dateTime, int, short, sol } from '../lib/format';
import { payrollSummary, type CoinPayroll } from '../lib/payroll';
import { lamportsToSol } from '../lib/rule';
import { solBalance } from '../lib/rpc';
import { drawBars, h, toast } from '../lib/ui';

export default function payroll(root: HTMLElement) {
  const p = copy.payroll;
  const f = p.facts;
  const page = h(`<div class="wrap page">
    <h1>${p.heading}</h1>
    <p class="lede">${p.lede}</p>
    <div class="facts">
      <div><div class="k">${f.snapshot}</div><div class="v num" data-f="snapshot">–</div></div>
      <div><div class="k">${f.pool}</div><div class="v num" data-f="pool">–</div></div>
      <div><div class="k">${f.points}</div><div class="v num" data-f="points">–</div></div>
      ${config.payroll_wallet ? `<div><div class="k">${f.wallet}</div><div class="v num" data-f="wallet">–</div></div>` : ''}
      <div><div class="k">${f.owed}</div><div class="v num" data-f="owed">–</div></div>
      <div><div class="k">${f.dust}</div><div class="v num" data-f="dust">–</div></div>
    </div>
    <div class="data-wrap"><table class="data"><tbody>
      ${p.rules.map(([k, v]) => `<tr><th scope="row" style="text-align:left;color:var(--baltic);font-weight:700">${k}</th><td style="text-align:left">${v}</td></tr>`).join('')}
    </tbody></table></div>
    <div data-coins></div>
    <p class="trust" style="margin-top:32px">${copy.how.trust}</p>
  </div>`);
  root.append(page);
  const set = (k: string, v: string) => {
    const el = page.querySelector(`[data-f="${k}"]`);
    if (el) el.textContent = v;
  };

  payrollSummary().then((s) => {
    set('snapshot', s.lastSnapshot ? dateTime(s.lastSnapshot) : '–');
    set('pool', `${sol(lamportsToSol(s.poolLamports), 3)} SOL`);
    // Points are in base units × days; divide by 10^decimals (6 for BENFIT coins) for token-days.
    set('points', s.pointsTotal > 0n ? compactNum(Number(s.pointsTotal / 10n ** 6n)) : '0');
    set('owed', `${sol(lamportsToSol(s.owedLamports), 3)} SOL`);
    set('dust', `${sol(lamportsToSol(s.dustLamports), 3)} SOL`);
    const host = page.querySelector('[data-coins]')!;
    for (const c of s.coins) host.append(coinHolders(c));
    drawBars(page);
  });
  if (config.payroll_wallet) {
    solBalance(config.payroll_wallet)
      .then((b) => set('wallet', `${sol(b, 3)} SOL`))
      .catch(() => toast(copy.toast.rpc));
  }
}

export function coinHolders(c: CoinPayroll): HTMLElement {
  const rows = (c.result?.rows ?? []).filter((r) => r.points > 0n).sort((a, b) => (b.points > a.points ? 1 : -1));
  const max = Math.max(1, ...rows.map((r) => r.tenureDays));
  const unit = 10n ** BigInt(c.state?.decimals ?? 6);
  const t = copy.statement.lines;
  return h(`<section style="margin-top:32px">
    <h2 style="font-size:var(--f20)"><a href="#/coin/${c.coin.mint}">$${c.coin.ticker}</a></h2>
    <div class="data-wrap"><table class="data">
      <thead><tr><th scope="col">${copy.rule.cols.holder}</th><th scope="col">${t.counted}</th><th scope="col">${t.tenure}</th><th scope="col">${t.points}</th><th scope="col">${t.expected}</th></tr></thead>
      <tbody>${rows
        .slice(0, 200)
        .map(
          (r) => `<tr><td class="num"><a href="${explorerAccount(r.wallet)}" target="_blank" rel="noopener">${short(r.wallet)}</a></td>
        <td class="num">${int(Number(r.counted / unit))}</td>
        <td><div class="tenure"><span class="num">${r.tenureDays} ${copy.ui.days}</span><span class="bar" aria-hidden="true"><i style="width:${(r.tenureDays / max) * 100}%"></i></span></div></td>
        <td class="num">${int(Number(r.points / unit))}</td>
        <td class="num">${sol(lamportsToSol(r.shareLamports), 4)} SOL</td></tr>`,
        )
        .join('')}</tbody>
    </table></div>
  </section>`);
}
