// The coin table: the hero of the dashboard.
import { Flip } from 'gsap/Flip';
import { config } from '../config';
import { copy, fill } from '../copy';
import { isMint, lookupMint, solPrice, type CoinRow } from '../lib/coins';
import { dateOnly, esc, pct, pctLabel, sol, usdCompact, usdPrice } from '../lib/format';
import { mintInfo } from '../lib/rpc';
import { lamportsToSol } from '../lib/rule';
import type { PayrollSummary } from '../lib/payroll';
import { h, reduced, sparkSvg } from '../lib/ui';

type Mode = 'all' | 'payroll' | 'market';
type SortKey = 'coin' | 'price' | 'ch24' | 'mcap' | 'vol' | 'pool' | 'holders';

const SEARCH_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>';

export function mountTable(host: HTMLElement, rows: CoinRow[], summary: PayrollSummary, initialMode: Mode) {
  const t = copy.table;
  let mode: Mode = initialMode;
  let sort: { key: SortKey; dir: 1 | -1 } = { key: 'vol', dir: -1 };
  let query = '';
  let expanded: string | null = null;
  let extra: CoinRow | null = null; // a pasted contract address looked up live

  const el = h(`
  <section class="panel" aria-label="${t.cols.coin}">
    <div class="toolbar">
      <div class="seg" role="group" aria-label="${copy.dashboard.modes.all}">
        <button type="button" data-mode="all">${copy.dashboard.modes.all}</button>
        <button type="button" data-mode="payroll">${copy.dashboard.modes.payroll}</button>
        <span class="tip"><button type="button" data-mode="market" aria-describedby="mv-tip">${copy.dashboard.modes.market}</button><span class="tip-body" role="tooltip" id="mv-tip">${copy.dashboard.marketTip}</span></span>
      </div>
      <label class="search"><span class="sr-only">${t.search}</span>${SEARCH_ICON}<input type="search" placeholder="${t.search}" autocomplete="off" spellcheck="false"></label>
    </div>
    <div class="tbl-wrap">
      <table class="coins">
        <thead><tr>
          ${th('coin', t.cols.coin)}${th('price', t.cols.price)}${th('ch24', t.cols.ch24)}
          ${th('mcap', t.cols.mcap, 'only-wide')}${th('vol', t.cols.vol, 'only-wide')}${th('pool', t.cols.pool)}
          ${th('holders', t.cols.holders, 'only-wide col-holders')}<th scope="col" class="only-wide"><button type="button" tabindex="-1" disabled>${t.cols.spark}</button></th>
        </tr></thead>
        <tbody></tbody>
      </table>
      <div class="empty" hidden></div>
    </div>
    <p class="basis">${fill(t.basis, { fee_rate: pctLabel(config.fee_rate) })}</p>
  </section>`);
  host.append(el);
  const tbody = el.querySelector('tbody')!;
  const empty = el.querySelector('.empty') as HTMLElement;
  const input = el.querySelector('input')!;

  function th(key: SortKey, label: string, cls = '') {
    return `<th scope="col" class="${cls}" data-key="${key}" aria-sort="none"><button type="button" aria-label="${fill(copy.ui.sortBy, { col: label })}">${label}<span class="arrow" aria-hidden="true"></span></button></th>`;
  }

  const payrollOf = (mint: string) => summary.coins.find((c) => c.coin.mint === mint);
  const holdersOf = (mint: string) => payrollOf(mint)?.result?.rows.filter((r) => r.points > 0n).length ?? null;
  const poolSolOf = (mint: string) => {
    const c = payrollOf(mint);
    return c ? lamportsToSol(c.poolLamports + c.carryLamports) : null;
  };

  function value(r: CoinRow, k: SortKey): number | string {
    switch (k) {
      case 'coin': return r.symbol.toLowerCase();
      case 'price': return r.m?.priceUsd ?? r.curve?.priceSol ?? -Infinity;
      case 'ch24': return r.m?.change24 ?? -Infinity;
      case 'mcap': return r.m?.marketCap ?? r.curve?.mcapSol ?? -Infinity;
      case 'vol': return r.m?.volume24 ?? -Infinity;
      case 'pool': return r.kind === 'market' ? (r.weeklyPoolUsd ?? -Infinity) : (poolSolOf(r.mint) ?? -Infinity);
      case 'holders': return r.kind === 'payroll' ? (holdersOf(r.mint) ?? -1) : -1;
    }
  }

  function visible(): CoinRow[] {
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => mode === 'all' || r.kind === mode);
    if (q) list = list.filter((r) => r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.mint.toLowerCase() === q);
    if (extra && q && extra.mint.toLowerCase() === q && !list.some((r) => r.mint === extra!.mint)) list = [extra];
    return list.slice().sort((a, b) => {
      const va = value(a, sort.key);
      const vb = value(b, sort.key);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }

  function poolCell(r: CoinRow) {
    if (r.kind === 'market') return r.weeklyPoolUsd == null ? '–' : `${usdCompact(r.weeklyPoolUsd)}<span class="est">${t.est}</span>`;
    const v = poolSolOf(r.mint);
    return v == null ? '–' : `${sol(v)} SOL`;
  }

  function coinCell(r: CoinRow) {
    const img = r.imageUrl
      ? `<img src="${esc(r.imageUrl)}" alt="" loading="lazy" width="28" height="28">`
      : `<span class="ph" aria-hidden="true">${esc(r.symbol.slice(0, 2).toUpperCase())}</span>`;
    const badge = r.kind === 'payroll' ? `<span class="badge on">${t.badgePayroll}</span>` : `<span class="badge">${t.badgeMarket}</span>`;
    return `<div class="coin-cell">${img}<div class="names"><span><span class="sym">${esc(r.symbol)}</span>${badge}</span><span class="nm">${esc(r.name)}</span></div></div>`;
  }

  function rowHtml(r: CoinRow) {
    const ch = pct(r.m?.change24 ?? null);
    const holders = r.kind === 'payroll' ? (holdersOf(r.mint)?.toLocaleString('en-US') ?? '–') : '–';
    const open = expanded === r.mint;
    return `<tr class="row" tabindex="0" data-mint="${r.mint}" aria-expanded="${open}" data-flip-id="${r.mint}">
      <td>${coinCell(r)}</td>
      <td class="num">${r.m ? usdPrice(r.m.priceUsd) : r.curve ? solPrice(r.curve.priceSol) : '–'}</td>
      <td class="num ${ch.cls}">${ch.text}</td>
      <td class="num only-wide">${r.m ? usdCompact(r.m.marketCap) : r.curve ? `${sol(r.curve.mcapSol, 1)} SOL` : '–'}</td>
      <td class="num only-wide">${usdCompact(r.m?.volume24 ?? null)}</td>
      <td class="num">${poolCell(r)}</td>
      <td class="num only-wide col-holders">${holders}</td>
      <td class="only-wide" data-spark>${sparkSvg(r.m?.spark ?? null)}</td>
    </tr>${open ? detailHtml(r) : ''}`;
  }

  function detailHtml(r: CoinRow) {
    const e = t.expand;
    const c = payrollOf(r.mint);
    const pool = poolCell(r);
    const counted = r.kind === 'payroll' ? (holdersOf(r.mint)?.toLocaleString('en-US') ?? '–') : '–';
    let avg = '–';
    if (c?.result) {
      const on = c.result.rows.filter((x) => x.points > 0n);
      if (on.length) avg = `${Math.round(on.reduce((s, x) => s + x.tenureDays, 0) / on.length)} ${copy.ui.days}`;
    }
    const last = c?.lastPaid ? `${dateOnly(c.lastPaid.period)}, ${sol(lamportsToSol(c.lastPaid.lamports))} SOL` : '–';
    return `<tr class="detail" data-detail="${r.mint}"><td colspan="8"><div class="detail-in">
      <h3><a href="#/coin/${r.mint}">${t.expandLabel}</a></h3>
      <div>
        <div class="kv"><span>${e.pool}</span><span class="num">${pool}</span></div>
        <div class="kv"><span>${e.counted}</span><span class="num">${counted}</span></div>
      </div>
      <div>
        <div class="kv"><span>${e.avgTenure}</span><span class="num">${avg}</span></div>
        <div class="kv"><span>${e.lastPayday}</span><span class="num">${last}</span></div>
      </div>
      <div>
        <div class="kv"><span>${e.mint}</span><span class="num" data-auth="mint"><span class="skeleton"></span></span></div>
        <div class="kv"><span>${e.freeze}</span><span class="num" data-auth="freeze"><span class="skeleton"></span></span></div>
      </div>
      <div class="only-narrow">
        <div class="kv"><span>${t.cols.mcap}</span><span class="num">${usdCompact(r.m?.marketCap ?? null)}</span></div>
        <div class="kv"><span>${t.cols.vol}</span><span class="num">${usdCompact(r.m?.volume24 ?? null)}</span></div>
        <div class="kv"><span>${t.cols.holders}</span><span class="num">${counted}</span></div>
        <div class="kv"><span>${t.cols.spark}</span><span>${sparkSvg(r.m?.spark ?? null)}</span></div>
      </div>
    </div></td></tr>`;
  }

  function render(flip = false) {
    const state = flip && !reduced() ? Flip.getState(tbody.querySelectorAll('tr.row')) : null;
    const list = visible();
    tbody.innerHTML = list.map(rowHtml).join('');
    el.querySelector('table')!.classList.toggle('no-badges', mode !== 'all');
    el.querySelector('table')!.classList.toggle('no-holders', mode === 'market');
    empty.hidden = list.length > 0;
    empty.textContent = list.length ? '' : t.emptySearch;
    el.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    el.querySelectorAll<HTMLElement>('th[data-key]').forEach((thEl) => {
      const on = thEl.dataset.key === sort.key;
      thEl.setAttribute('aria-sort', on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none');
      thEl.querySelector('.arrow')!.textContent = on ? (sort.dir === 1 ? '▲' : '▼') : '';
    });
    if (state) Flip.from(state, { duration: 0.32, ease: 'power2.inOut', targets: tbody.querySelectorAll('tr.row') });
    if (expanded) fillAuthorities(expanded);
    fitDetail();
  }

  // The expanded payslip spans the visible panel, not the full scrollable table width.
  const wrapEl = el.querySelector('.tbl-wrap') as HTMLElement;
  function fitDetail() {
    const d = tbody.querySelector<HTMLElement>('.detail-in');
    if (d) d.style.width = `${wrapEl.clientWidth}px`;
  }
  window.addEventListener('resize', fitDetail);

  async function fillAuthorities(mint: string) {
    const info = await mintInfo(mint);
    const d = tbody.querySelector(`[data-detail="${mint}"]`);
    if (!d) return;
    // "none" only when read live from chain and null. A failed read shows a dash.
    const show = (v: string | null | undefined) => (info ? (v === null ? copy.ui.none : `${v!.slice(0, 4)}…${v!.slice(-4)}`) : '–');
    d.querySelector('[data-auth=mint]')!.textContent = show(info?.mintAuthority);
    d.querySelector('[data-auth=freeze]')!.textContent = show(info?.freezeAuthority);
  }

  function toggle(mint: string) {
    expanded = expanded === mint ? null : mint;
    render();
    (tbody.querySelector(`tr.row[data-mint="${mint}"]`) as HTMLElement | null)?.focus();
  }

  el.querySelector('.seg')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-mode]');
    if (!b) return;
    mode = b.dataset.mode as Mode;
    expanded = null;
    render();
  });
  el.querySelector('thead')!.addEventListener('click', (e) => {
    const thEl = (e.target as HTMLElement).closest<HTMLElement>('th[data-key]');
    if (!thEl) return;
    const key = thEl.dataset.key as SortKey;
    sort = sort.key === key ? { key, dir: (sort.dir * -1) as 1 | -1 } : { key, dir: key === 'coin' ? 1 : -1 };
    render(true);
  });
  input.addEventListener('input', async () => {
    query = input.value;
    render();
    const q = query.trim();
    if (isMint(q) && !rows.some((r) => r.mint === q)) {
      const found = await lookupMint(q);
      if (found && input.value.trim() === q) {
        extra = found;
        render();
      }
    }
  });
  tbody.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) return;
    const tr = (e.target as HTMLElement).closest<HTMLElement>('tr.row');
    if (tr) toggle(tr.dataset.mint!);
  });
  tbody.addEventListener('keydown', (e) => {
    const tr = (e.target as HTMLElement).closest<HTMLElement>('tr.row');
    if (!tr) return;
    const all = Array.from(tbody.querySelectorAll<HTMLElement>('tr.row'));
    const i = all.indexOf(tr);
    if (e.key === 'ArrowDown' && all[i + 1]) { e.preventDefault(); all[i + 1].focus(); }
    else if (e.key === 'ArrowUp' && all[i - 1]) { e.preventDefault(); all[i - 1].focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(tr.dataset.mint!); }
  });

  render();
  // 7d candles come from GeckoTerminal via the hourly cache (data/market-cache.json). Fetching them
  // live from every visitor's browser trips GeckoTerminal's rate limit, whose errors carry no CORS header.
}
