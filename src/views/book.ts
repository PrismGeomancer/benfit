import { config, explorerTx } from '../config';
import { copy } from '../copy';
import { nextPayday } from '../lib/time';
import { icons } from '../ui/icons';
import { allRuns, registry, type PayrollRun } from '../lib/data';
import { dateOnly, sol } from '../lib/format';
import { lamportsToSol } from '../lib/rule';
import { h } from '../lib/ui';
import { animateLedger } from '../lib/reveal';

let tickers: Map<string, string> = new Map();
registry().then((r) => (tickers = new Map(r.map((c) => [c.mint, c.ticker]))));

export function bookTable(runs: PayrollRun[]): HTMLElement {
  const b = copy.book;
  if (!runs.length) {
    const next = dateOnly(nextPayday(new Date(), config.payday), config.payday.tz);
    return h(`<div class="ledger">
      <div class="ledger-cols" aria-hidden="true">${Object.values(b.cols).map((c) => `<span>${c}</span>`).join('')}</div>
      <div class="ledger-body">
        <span class="ledger-ic">${icons.ledger}</span>
        <p>${b.empty}</p>
      </div>
      <div class="ledger-foot"><span>${copy.dashboard.payday.label}</span><span class="chip">${next}</span></div>
    </div>`);
  }
  const rows = runs.flatMap((run) =>
    run.coins.map((c) => {
      const paid = c.rows.filter((r) => BigInt(r.share_lamports) > 0n).length;
      const txs = c.txs
        .map((sig, i) => `<a href="${explorerTx(sig)}" target="_blank" rel="noopener">${i === 0 ? b.view : i + 1}</a>`)
        .join(' ');
      return `<tr><td>${dateOnly(run.period)}</td><td>${tickers.get(c.mint) ?? c.mint.slice(0, 4)}</td><td class="num">${sol(lamportsToSol(BigInt(c.pool_lamports)))} SOL</td><td class="num">${paid}</td><td>${txs || '–'}</td></tr>`;
    }),
  );
  return h(`<div class="data-wrap"><table class="data">
    <thead><tr><th scope="col">${b.cols.date}</th><th scope="col">${b.cols.coin}</th><th scope="col">${b.cols.pool}</th><th scope="col">${b.cols.paid}</th><th scope="col">${b.cols.txs}</th></tr></thead>
    <tbody>${rows.join('')}</tbody></table></div>`);
}

export default function book(root: HTMLElement) {
  const page = h(`<div class="wrap page"><h1>${copy.book.heading}</h1><p class="lede">${copy.book.lede}</p><div data-b></div></div>`);
  root.append(page);
  allRuns().then((runs) => {
    const host = page.querySelector('[data-b]') as HTMLElement;
    host.append(bookTable(runs));
    animateLedger(host);
  });
}
