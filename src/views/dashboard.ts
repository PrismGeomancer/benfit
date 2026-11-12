import { gsap } from 'gsap';
import { config } from '../config';
import { copy, fill } from '../copy';
import { loadCoins } from '../lib/coins';
import { dateOnly, int, short, sol, usdCompact } from '../lib/format';
import { payrollSummary, type PayrollSummary } from '../lib/payroll';
import { lamportsToSol } from '../lib/rule';
import { nextPayday, splitDuration } from '../lib/time';
import { countUp, h, reduced } from '../lib/ui';
import * as wallet from '../lib/wallet';
import { createPrinter, type Slip } from './payslip';
import { mountTable } from './table';
import { mountTryRule } from './tryrule';
import { bookTable } from './book';
import { howSection } from './how';
import { statementSlips } from './statement';
import { animateLedger, animateRules } from '../lib/reveal';

// Big figure per rule, taken from config so it can never disagree with the rule text's source.
const RULE_FIGURES = [
  `${config.wallet_cap_pct}%`,
  config.min_tokens.toLocaleString('en-US'),
  `${config.dust_sol}`,
  '+',
  '0',
];

export default function dashboard(root: HTMLElement) {
  const d = copy.dashboard;
  const page = h(`<div>
    <div class="wrap">
      <div class="head">
        <div>
          <h1>${d.h1}</h1>
          <p class="sub">${d.sub}</p>
        </div>
        <div data-payday></div>
      </div>
      <div class="tiles" data-tiles>${'<div class="tile"><span class="k">&nbsp;</span><span class="v">&nbsp;</span></div>'.repeat(4)}</div>
      <div class="main">
        <div data-table><div class="panel" style="min-height:${56 * 10 + 120}px"></div></div>
        <aside class="side" data-side></aside>
      </div>
    </div>
    <div class="band rules-band">
      <div class="wrap">
        <p class="formula" aria-label="${copy.payroll.rules[0][0]}: ${copy.payroll.rules[0][1]}">
          <span class="f-term">${copy.payroll.rules[0][0]}</span><span class="f-op">=</span>
          <span class="f-chip">${copy.statement.lines.counted}</span><span class="f-op">×</span>
          <span class="f-chip">${copy.rule.inputs.days}</span>
        </p>
        <div class="rules-grid">
          ${copy.payroll.rules
            .slice(1)
            .map(([k, v], i) => `<div class="rule-cell"><span class="rule-big">${RULE_FIGURES[i]}</span><b>${k}</b><span>${v}</span></div>`)
            .join('')}
        </div>
      </div>
    </div>
    <div class="wrap">
      <section class="section" aria-labelledby="book-h">
        <h2 id="book-h">${copy.book.heading}</h2>
        <p class="lede">${copy.book.lede}</p>
        <div data-book></div>
      </section>
      <div data-how></div>
    </div>
  </div>`);
  root.append(page);

  animateRules(page.querySelector('.rules-band') as HTMLElement);
  const stopClock = mountPayday(page.querySelector('[data-payday]')!);

  // Right column: Try the rule + the payslip printer.
  const side = page.querySelector('[data-side]') as HTMLElement;
  const printer = createPrinter(document.createElement('div'));
  let walletSlip = false;
  mountTryRule(side, (slip: Slip, fromUser) => {
    if (walletSlip && !fromUser) return;
    walletSlip = false;
    printer.print(slip);
  });
  side.append(printer.el);

  const unsub = wallet.subscribe(async (acc) => {
    if (!acc) return;
    const slips = await statementSlips(acc.address);
    if (slips?.length) {
      walletSlip = true;
      printer.print(slips[0], true);
    } else {
      printer.print({ ...lastTry(side), title: short(acc.address) }, true);
    }
  });

  page.querySelector('[data-how]')!.append(howSection());

  let stopTable: void | (() => void);
  Promise.all([loadCoins(), payrollSummary()]).then(([coins, summary]) => {
    const live = summary.coins.length > 0;
    renderTiles(page.querySelector('[data-tiles]')!, summary, coins.rows, live);
    const host = page.querySelector('[data-table]') as HTMLElement;
    host.innerHTML = '';
    stopTable = mountTable(host, coins.rows, summary, live ? 'all' : 'market');
    page.querySelector('[data-pool]')!.textContent = `${sol(lamportsToSol(summary.poolLamports))} SOL`;
    const bookEl = page.querySelector('[data-book]') as HTMLElement;
    bookEl.append(bookTable(summary.runs.slice(0, 5)));
    animateLedger(bookEl);
  });

  return () => {
    stopClock();
    unsub();
    if (typeof stopTable === 'function') stopTable();
  };
}

function lastTry(side: HTMLElement): Slip {
  const lines = Array.from(side.querySelectorAll('.slip-line:not(.total)')).map(
    (l) => [l.children[0].textContent ?? '', l.children[1].textContent ?? ''] as [string, string],
  );
  const total = side.querySelector('.slip-line.total');
  return {
    title: '',
    sub: copy.rule.caption,
    lines,
    total: {
      label: copy.statement.lines.expected,
      note: copy.statement.lines.expectedNote,
      value: total?.children[1].textContent ?? '',
    },
  };
}

function renderTiles(host: HTMLElement, s: PayrollSummary, rows: { kind: string; m: { volume24: number | null } | null; weeklyPoolUsd: number | null }[], live: boolean) {
  const tiles: { k: string; u: string; to: number; fmt: (n: number) => string }[] = [];
  if (live) {
    const t = copy.dashboard.tilesLive;
    tiles.push(
      { k: t.paid[0], u: t.paid[1], to: lamportsToSol(s.paidAllLamports), fmt: (n) => sol(n) },
      { k: t.coins[0], u: t.coins[1], to: s.coins.length, fmt: (n) => int(Math.round(n)) },
      { k: t.holders[0], u: t.holders[1], to: s.holdersOnPayroll, fmt: (n) => int(Math.round(n)) },
      { k: t.longest[0], u: t.longest[1], to: s.longestTenure, fmt: (n) => int(Math.round(n)) },
    );
  } else {
    const t = copy.dashboard.tilesMarket;
    const market = rows.filter((r) => r.kind === 'market');
    const vol = market.reduce((a, r) => a + (r.m?.volume24 ?? 0), 0);
    const pool = market.reduce((a, r) => a + (r.weeklyPoolUsd ?? 0), 0);
    tiles.push(
      { k: t.tracked[0], u: t.tracked[1], to: market.length, fmt: (n) => int(Math.round(n)) },
      { k: t.volume[0], u: t.volume[1], to: vol, fmt: (n) => usdCompact(n) },
      { k: t.pool[0], u: t.pool[1], to: pool, fmt: (n) => usdCompact(n) },
    );
  }
  host.innerHTML = tiles
    .map((t) => `<div class="tile"><span class="k">${t.k}</span><span class="v num"></span>${t.u ? `<span class="u">${t.u}</span>` : ''}</div>`)
    .join('');
  if (!live) {
    const t = copy.dashboard.tilesMarket;
    host.append(
      h(`<div class="tile"><span class="k">${t.payday[0]}</span><span class="v num">${dateOnly(s.payday, config.payday.tz)}</span><span class="u">${copy.dashboard.payday.value}, ${copy.dashboard.payday.tz}</span></div>`),
    );
  }
  host.querySelectorAll<HTMLElement>('.tile .v:empty').forEach((v, i) => countUp(v, tiles[i].to, tiles[i].fmt));
}

function mountPayday(host: HTMLElement) {
  const p = copy.dashboard.payday;
  const payday = nextPayday(new Date(), config.payday);
  const localFmt = payday.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const sthlmFmt = payday.toLocaleString(undefined, { timeZone: config.payday.tz, weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const differs = localFmt !== sthlmFmt;
  const el = h(`
  <div class="payday">
    <span class="label">${p.label}</span>
    <span class="chip">${dateOnly(payday, config.payday.tz)}</span>
    <div class="when" style="grid-column:1/-1">${p.value}<small>${p.tz}${differs ? `, ${fill(p.yourTime, { local: localFmt })}` : ''}</small></div>
    <div class="countdown num" aria-live="off" aria-hidden="true">
      ${(['d', 'h', 'm', 's'] as const).map((u) => `<span class="unit" data-u="${u}"><span class="digits"></span><small>${p.units[u]}</small></span>`).join('')}
    </div>
    <p class="sr-only">${fill(copy.ui.countdownAlt, { date: payday.toLocaleString('en-GB', { timeZone: config.payday.tz, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}</p>
    <div class="pool"><span>${p.pool} <b class="num" data-pool>0.00 SOL</b></span><a href="#/how">${p.howLink}</a></div>
  </div>`);
  host.append(el);

  const state: Record<string, string> = {};
  function setUnit(u: string, text: string) {
    const holder = el.querySelector(`[data-u="${u}"] .digits`) as HTMLElement;
    const prev = state[u] ?? '';
    if (prev.length !== text.length) {
      holder.innerHTML = text.split('').map((c) => `<span class="digit"><span>${c}</span></span>`).join('');
      state[u] = text;
      return;
    }
    const cells = holder.querySelectorAll<HTMLElement>('.digit');
    text.split('').forEach((c, i) => {
      if (prev[i] === c) return;
      const cell = cells[i];
      // Keep exactly one digit per cell: finish and drop anything still rolling out. Background
      // tabs pause animation frames while this interval keeps ticking, which used to stack digits.
      const spans = Array.from(cell.children) as HTMLElement[];
      gsap.killTweensOf(spans);
      const old = spans.pop()!;
      spans.forEach((s) => s.remove());
      gsap.set(old, { yPercent: 0 });
      const next = h(`<span>${c}</span>`);
      cell.append(next);
      if (reduced() || document.hidden) {
        old.remove();
        return;
      }
      gsap.fromTo(next, { yPercent: 100 }, { yPercent: 0, duration: 0.12, ease: 'power1.out' });
      gsap.to(old, { yPercent: -100, duration: 0.12, ease: 'power1.out', onComplete: () => old.remove() });
    });
    state[u] = text;
  }
  let target = payday;
  function tick() {
    let ms = target.getTime() - Date.now();
    if (ms <= 0) {
      target = nextPayday(new Date(), config.payday);
      ms = target.getTime() - Date.now();
    }
    const t = splitDuration(ms);
    setUnit('d', String(t.d));
    setUnit('h', String(t.h).padStart(2, '0'));
    setUnit('m', String(t.m).padStart(2, '0'));
    setUnit('s', String(t.s).padStart(2, '0'));
  }
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}
