// "Try the rule": the fixed worked example plus a fourth holder the visitor controls.
import { config } from '../config';
import { copy, fill } from '../copy';
import { computePayroll, lamportsToSol, solToLamports, toBase } from '../lib/rule';
import { int, sol } from '../lib/format';
import { h } from '../lib/ui';
import type { Slip } from './payslip';

const DEC = 6;

export function mountTryRule(host: HTMLElement, onChange: (slip: Slip, mine: boolean) => void) {
  const r = copy.rule;
  const el = h(`
  <section class="panel rule-card" aria-labelledby="try-h">
    <h2 id="try-h">${r.heading}</h2>
    <p class="lede">${r.lede}</p>
    <table class="mini">
      <thead><tr><th scope="col">${r.cols.holder}</th><th scope="col">${r.cols.tokens}</th><th scope="col">${r.cols.days}</th><th scope="col">${r.cols.points}</th><th scope="col">${r.cols.share}</th></tr></thead>
      <tbody></tbody>
    </table>
    <div class="inputs">
      <label class="field">${r.inputs.tokens}<input name="tokens" type="number" inputmode="decimal" min="0" step="0.1"></label>
      <label class="field">${r.inputs.days}<input name="days" type="number" inputmode="numeric" min="0" step="1"></label>
    </div>
    <p class="result num" aria-live="polite"></p>
    <p class="caption">${r.caption}</p>
    <p class="rule-line">${r.line}</p>
  </section>`);
  host.append(el);
  const tbody = el.querySelector('tbody')!;
  const tokensIn = el.querySelector<HTMLInputElement>('input[name=tokens]')!;
  const daysIn = el.querySelector<HTMLInputElement>('input[name=days]')!;
  const result = el.querySelector('.result') as HTMLElement;

  function update(fromUser: boolean) {
    const t = Math.max(0, Number(tokensIn.value) || 0);
    const d = Math.max(0, Math.floor(Number(daysIn.value) || 0));
    const you = tokensIn.value !== '' && daysIn.value !== '';
    const holders = r.holders.map((x) => ({ wallet: x.name, balance: toBase(x.tokens * 1e6, DEC), tenureDays: x.days }));
    if (you) holders.push({ wallet: copy.ui.you, balance: toBase(+(t * 1e6).toFixed(DEC), DEC), tenureDays: d });
    // The worked example has no supply, so no wallet cap; the minimum still applies.
    const res = computePayroll(holders, {
      poolLamports: solToLamports(r.pool),
      decimals: DEC,
      capPct: config.wallet_cap_pct,
      minTokens: config.min_tokens,
      dustLamports: solToLamports(config.dust_sol),
    });
    const unit = toBase(1e6, DEC);
    tbody.innerHTML = res.rows
      .map((row, i) => {
        const tokensM = i < 3 ? `${r.holders[i].tokens}M` : `${+t.toFixed(2)}M`;
        const pts = Number(row.points / unit);
        return `<tr class="${i === 3 ? 'you' : ''}"><td>${row.wallet}</td><td class="num">${tokensM}</td><td class="num">${row.tenureDays}</td><td class="num">${int(pts)}M</td><td class="num">${sol(lamportsToSol(row.shareLamports))} SOL</td></tr>`;
      })
      .join('');
    const mine = res.rows[3];
    const mPts = mine ? Number(mine.points / unit) : 0;
    const mShare = mine ? lamportsToSol(mine.shareLamports) : 0;
    result.textContent = you ? fill(r.result, { points: int(mPts), share: sol(mShare) }) : '';

    const focus = mine ?? res.rows[0];
    const s = copy.statement.lines;
    const slip: Slip = {
      title: focus.wallet,
      sub: `${r.pool} SOL`,
      lines: [
        [s.coin, copy.rule.caption.split('.')[0]],
        [s.counted, `${int(Number(focus.counted / toBase(1, DEC)))}`],
        [s.tenure, `${focus.tenureDays} ${copy.ui.days}`],
        [s.points, `${int(Number(focus.points / unit))}M`],
        [s.share, res.totalPoints > 0n ? `${((Number(focus.points) / Number(res.totalPoints)) * 100).toFixed(2)}%` : '0.00%'],
      ],
      total: { label: s.expected, note: s.expectedNote, value: `${sol(lamportsToSol(focus.shareLamports))} SOL` },
    };
    onChange(slip, fromUser);
  }
  tokensIn.addEventListener('input', () => update(true));
  daysIn.addEventListener('input', () => update(true));
  update(false);
  return { el, update };
}
