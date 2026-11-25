// "Current holders": the biggest wallets of the selected coin.
//   BENFIT coins   -> payroll data: tokens counted, days held, expected pay. Click a row to print its payslip.
//   Market coins   -> live from RugCheck: tokens and share of supply. Days are only tracked on payroll.
import { copy, fill } from '../copy';
import { explorerAccount } from '../config';
import type { CoinRow } from '../lib/coins';
import { compactNum, esc, int, short, sol } from '../lib/format';
import { liveHolders } from '../lib/holders';
import type { PayrollSummary } from '../lib/payroll';
import { lamportsToSol } from '../lib/rule';
import { h } from '../lib/ui';
import type { Slip } from './payslip';

const SHOWN = 8;

export function mountHolders(host: HTMLElement, rows: CoinRow[], summary: PayrollSummary, onPrint: (slip: Slip) => void) {
  const t = copy.holders;
  const first = rows.find((r) => r.kind === 'payroll') ?? rows[0];
  const el = h(`
  <section class="panel rule-card holders" aria-labelledby="hold-h">
    <h2 id="hold-h">${t.heading}</h2>
    <p class="lede">${t.lede}</p>
    <label class="field">${t.coin}
      <select name="coin">${rows.map((r) => `<option value="${r.mint}" ${r === first ? 'selected' : ''}>${esc(r.symbol)}</option>`).join('')}</select>
    </label>
    <table class="mini holders-t"><thead></thead><tbody aria-live="polite"></tbody></table>
    <p class="caption" data-note></p>
  </section>`);
  host.append(el);
  const select = el.querySelector('select')!;
  const thead = el.querySelector('thead')!;
  const tbody = el.querySelector('tbody')!;
  const note = el.querySelector('[data-note]') as HTMLElement;
  let token = 0;

  const head = (cols: string[]) =>
    (thead.innerHTML = `<tr>${cols.map((c, i) => `<th scope="col"${i === 0 ? '' : ''}>${c}</th>`).join('')}</tr>`);
  const wallet = (addr: string, label: string | null) =>
    `<a href="${explorerAccount(addr)}" target="_blank" rel="noopener" class="num">${short(addr)}</a>${label ? `<span class="badge">${esc(label)}</span>` : ''}`;

  function payrollView(mint: string) {
    const c = summary.coins.find((x) => x.coin.mint === mint)!;
    const unit = 10n ** BigInt(c.state?.decimals ?? 6);
    const list = (c.result?.rows ?? []).filter((r) => r.points > 0n).sort((a, b) => (b.points > a.points ? 1 : -1));
    head([t.cols.holder, t.cols.tokens, t.cols.days, t.cols.pay]);
    tbody.innerHTML = list
      .slice(0, SHOWN)
      .map(
        (r, i) => `<tr class="pick" tabindex="0" data-i="${i}">
          <td>${wallet(r.wallet, null)}</td><td class="num">${compactNum(Number(r.counted / unit))}</td>
          <td class="num">${r.tenureDays}</td><td class="num">${sol(lamportsToSol(r.shareLamports), 3)}</td></tr>`,
      )
      .join('');
    note.textContent = fill(t.notePayroll, { total: int(list.length) });
    const print = (i: number) => {
      const r = list[i];
      if (!r) return;
      const L = copy.statement.lines;
      const pct = c.result && c.result.totalPoints > 0n ? (Number(r.points) / Number(c.result.totalPoints)) * 100 : 0;
      onPrint({
        title: short(r.wallet),
        sub: `$${c.coin.ticker}`,
        lines: [
          [L.counted, int(Number(r.counted / unit))],
          [L.tenure, `${r.tenureDays} ${copy.ui.days}`],
          [L.points, int(Number(r.points / unit))],
          [L.share, `${pct.toFixed(2)}%`],
        ],
        total: { label: L.expected, note: L.expectedNote, value: `${sol(lamportsToSol(r.shareLamports), 4)} SOL` },
      });
    };
    tbody.onclick = (e) => {
      if ((e.target as HTMLElement).closest('a')) return;
      const tr = (e.target as HTMLElement).closest<HTMLElement>('tr.pick');
      if (tr) print(Number(tr.dataset.i));
    };
    tbody.onkeydown = (e) => {
      const tr = (e.target as HTMLElement).closest<HTMLElement>('tr.pick');
      if (tr && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        print(Number(tr.dataset.i));
      }
    };
  }

  async function marketView(mint: string) {
    const mine = ++token;
    head([t.cols.holder, t.cols.tokens, t.cols.supply]);
    tbody.onclick = tbody.onkeydown = null;
    tbody.innerHTML = Array.from({ length: SHOWN }, () => `<tr><td colspan="3"><span class="skeleton" style="width:100%"></span></td></tr>`).join('');
    note.textContent = t.loading;
    const data = await liveHolders(mint, SHOWN);
    if (mine !== token) return; // the visitor picked another coin meanwhile
    if (!data) {
      tbody.innerHTML = `<tr><td colspan="3" class="muted">${t.failed}</td></tr>`;
      note.textContent = '';
      return;
    }
    tbody.innerHTML = data.rows
      .map((r) => `<tr><td>${wallet(r.owner, r.label)}</td><td class="num">${compactNum(r.tokens)}</td><td class="num">${r.pct.toFixed(2)}%</td></tr>`)
      .join('');
    note.textContent = data.total !== null ? fill(t.noteMarket, { total: int(data.total) }) : t.noteMarketNoTotal;
  }

  function show(mint: string) {
    token++;
    if (summary.coins.some((c) => c.coin.mint === mint)) payrollView(mint);
    else void marketView(mint);
  }
  select.addEventListener('change', () => show(select.value));
  if (first) show(first.mint);
  return el;
}
