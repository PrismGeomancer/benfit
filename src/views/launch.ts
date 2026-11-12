import { config } from '../config';
import { copy, fill } from '../copy';
import { registry } from '../lib/data';
import { h, toast } from '../lib/ui';
import * as wallet from '../lib/wallet';
import { openConnect } from '../shell';

const MAX_IMG = 2 * 1024 * 1024;

export default function launch(root: HTMLElement) {
  const l = copy.launch;
  const f = l.fields;
  // The button needs a BENFIT config on chain and somewhere to host metadata. Empty config hides it.
  const canLaunch = !!(config.dbc_config_key && config.metadata_upload_url);
  const cost =
    config.verified.launchCost && config.launch_cost_sol !== null
      ? `<p class="note">${fill(l.cost, { launch_cost: config.launch_cost_sol })}</p>`
      : '';
  const page = h(`<div class="wrap page">
    <h1>${l.heading}</h1>
    <p class="lede">${l.lede}</p>
    <div class="two">
      <form class="form" novalidate>
        <label class="field">${f.name}<input name="name" maxlength="32" autocomplete="off"></label>
        <p class="err" data-err="name" hidden></p>
        <label class="field">${f.ticker}<input name="ticker" maxlength="10" autocomplete="off" style="text-transform:uppercase"></label>
        <p class="err" data-err="ticker" hidden></p>
        <label class="field">${f.image}<input name="image" type="file" accept="image/png,image/jpeg,image/gif" style="padding-top:10px"></label>
        <p class="err" data-err="image" hidden></p>
        <label class="field">${f.description}<textarea name="description" maxlength="500"></textarea></label>
        <label class="field">${f.firstBuy}<input name="firstBuy" type="number" min="0" step="0.01" inputmode="decimal"></label>
        ${cost}
        ${canLaunch ? `<div class="rel"><button class="btn btn-primary" type="submit">${l.submit}</button></div>` : ''}
        <p class="note" data-done hidden></p>
      </form>
      <aside class="panel rule-card">
        <h2>${l.ruleCard}</h2>
        <table class="mini"><tbody>
          ${copy.payroll.rules.map(([k, v]) => `<tr><td style="text-align:left;font-weight:700;padding-right:12px">${k}</td><td style="text-align:left">${v}</td></tr>`).join('')}
        </tbody></table>
      </aside>
    </div>
  </div>`);
  root.append(page);
  const form = page.querySelector('form')!;
  const err = (k: string, msg: string | null) => {
    const e = form.querySelector(`[data-err="${k}"]`) as HTMLElement;
    e.hidden = !msg;
    e.textContent = msg ?? '';
  };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get('name') ?? '').trim();
    const ticker = String(fd.get('ticker') ?? '').trim().toUpperCase();
    const image = fd.get('image') as File | null;
    const firstBuy = Math.max(0, Number(fd.get('firstBuy')) || 0);
    const taken = (await registry()).some((c) => c.ticker.toUpperCase() === ticker);
    const errors = {
      name: name ? null : l.errors.name,
      ticker: !/^[A-Z0-9]{2,10}$/.test(ticker) ? l.errors.ticker : taken ? l.errors.tickerTaken : null,
      image: !image || !image.size || !/^image\/(png|jpeg|gif)$/.test(image.type) || image.size > MAX_IMG ? l.errors.image : null,
    };
    Object.entries(errors).forEach(([k, v]) => err(k, v));
    if (Object.values(errors).some(Boolean)) return;

    const me = wallet.address();
    if (!me) {
      const btn = form.querySelector('button[type=submit]') as HTMLElement;
      return openConnect(btn.parentElement as HTMLElement, btn);
    }
    const submit = form.querySelector('button[type=submit]') as HTMLButtonElement;
    submit.disabled = true;
    try {
      // Metadata host (configured by the owner) returns a public metadata URI.
      const up = new FormData();
      up.set('image', image!);
      up.set('name', name);
      up.set('symbol', ticker);
      up.set('description', String(fd.get('description') ?? ''));
      const res = await fetch(config.metadata_upload_url, { method: 'POST', body: up });
      if (!res.ok) throw new Error('upload');
      const { uri } = (await res.json()) as { uri: string };

      const { buildLaunchTx, confirmed } = await import('../launch/dbc');
      const { bytes, mint, connection } = await buildLaunchTx({
        rpcUrl: config.rpc_url,
        configKey: config.dbc_config_key,
        creator: me,
        name,
        symbol: ticker,
        uri,
        firstBuySol: firstBuy,
      });
      const sigBytes = await wallet.signAndSend(bytes);
      const bs58 = (await import('bs58')).default;
      const sig = bs58.encode(sigBytes);
      if (!(await confirmed(connection, sig))) {
        toast(copy.toast.unconfirmed);
        return;
      }
      const done = form.querySelector('[data-done]') as HTMLElement;
      done.hidden = false;
      done.innerHTML = `${l.success} <a href="#/coin/${mint}">${l.open}</a>`;
    } catch (e) {
      console.warn('launch failed:', e);
      toast(wallet.isRejection(e) ? copy.toast.refused : copy.toast.unconfirmed);
    } finally {
      submit.disabled = false;
    }
  });
}
