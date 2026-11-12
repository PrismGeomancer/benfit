import { config } from './config';

const mark = '<img src="./brand/benfit-logo-64.png" alt="" width="32" height="32">';
import { copy } from './copy';
import { short } from './lib/format';
import { $, copyText, h, toast } from './lib/ui';
import * as wallet from './lib/wallet';

const ICON = {
  x: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/></svg>',
  telegram:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.4 4.3 2.9 11.4c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.4-1.5ZM8.6 14.1l9.9-6.3c.5-.3.9-.1.5.2l-8.5 7.7-.3 3.5-1.6-5.1Z"/></svg>',
  github:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .6 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
  menu: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

export const ROUTES = [
  ['#/', copy.nav.links.coins],
  ['#/payroll', copy.nav.links.payroll],
  ['#/statement', copy.nav.links.statement],
  ['#/book', copy.nav.links.book],
  ['#/how', copy.nav.links.how],
] as const;

function socials() {
  const items = [
    [config.x_url, copy.ui.social.x, ICON.x],
    [config.telegram_url, copy.ui.social.telegram, ICON.telegram],
    [config.repo_url, copy.ui.social.github, ICON.github],
  ].filter(([url]) => url);
  if (!items.length) return '';
  return `<div class="social">${items
    .map(([url, label, icon]) => `<a href="${url}" target="_blank" rel="noopener" aria-label="${label}">${icon}</a>`)
    .join('')}</div>`;
}

export function mountShell(app: HTMLElement) {
  app.innerHTML = '';
  const header = h(`
  <header class="top">
    <div class="wrap">
      <a class="brand" href="#/">${mark}<span>${copy.nav.logo}</span></a>
      ${config.network !== 'mainnet' ? `<span class="net-chip">${copy.ui.network[config.network]}</span>` : ''}
      <nav class="nav" id="nav" aria-label="Main">
        ${ROUTES.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
      </nav>
      <div class="top-actions">
        ${
          config.benfit_ca
            ? `<span class="ca-chip num">${copy.nav.ca} ${short(config.benfit_ca)}<button type="button" data-copy-ca aria-label="${copy.ui.copyCa}">${ICON.copy}</button></span>`
            : ''
        }
        ${socials()}
        <div class="rel" id="wallet-slot"></div>
        <a class="btn btn-primary btn-launch" href="#/launch">${copy.nav.launch}</a>
        <button class="btn btn-ghost menu-btn" type="button" aria-controls="nav" aria-expanded="false" aria-label="${copy.ui.menu}">${ICON.menu}</button>
      </div>
    </div>
  </header>`);
  const main = h('<main id="view"></main>');
  const footer = h(`
  <footer class="foot">
    <div class="wrap">
      <div class="foot-top">
        <div class="foot-brand">
          <img src="./brand/benfit-logo-180.png" alt="" width="72" height="72">
          <div>
            <p class="foot-name">${copy.footer.left}</p>
            <p class="foot-hooks">${copy.core.hooks.slice(1).join(' ')}</p>
          </div>
        </div>
        <nav aria-label="Footer">${ROUTES.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}<a href="#/launch">${copy.nav.launch}</a></nav>
      </div>
      <div class="foot-bottom">
        <p class="risk">${copy.footer.risk}</p>
        ${socials()}
      </div>
    </div>
  </footer>`);
  app.append(header, main, footer);

  header.querySelector('[data-copy-ca]')?.addEventListener('click', () => {
    copyText(config.benfit_ca);
    toast(copy.toast.copied);
  });
  const menuBtn = $('.menu-btn', header)!;
  const nav = $('#nav', header)!;
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', () => {
    nav.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  });

  renderWallet();
  wallet.subscribe(renderWallet);
  wallet.onWallets(() => {
    tryReconnect();
  });
  tryReconnect();
  return main;
}

let reconnecting = false;
async function tryReconnect() {
  const name = wallet.lastWalletName();
  if (!name || wallet.address() || reconnecting) return;
  const w = wallet.solanaWallets().find((x) => x.name === name);
  if (!w) return;
  reconnecting = true;
  try {
    await wallet.connect(w);
  } catch {
    /* silent: the user can connect again */
  }
  reconnecting = false;
}

function renderWallet() {
  const slot = document.getElementById('wallet-slot');
  if (!slot) return;
  const addr = wallet.address();
  slot.innerHTML = '';
  if (addr) {
    const b = h(`<button class="btn btn-ghost num" type="button" aria-haspopup="true" aria-expanded="false">${short(addr)}</button>`);
    slot.append(b);
    b.addEventListener('click', () => {
      const open = slot.querySelector('.popover');
      if (open) return closePop(slot, b);
      const pop = h(`<div class="popover"><button type="button">${copy.ui.disconnect}</button></div>`);
      pop.querySelector('button')!.addEventListener('click', async () => {
        await wallet.disconnect();
        toast(copy.toast.disconnected);
      });
      slot.append(pop);
      b.setAttribute('aria-expanded', 'true');
    });
    return;
  }
  const b = h(`<button class="btn btn-ghost" type="button">${copy.nav.connect}</button>`);
  slot.append(b);
  b.addEventListener('click', () => openConnect(slot, b));
}

function closePop(slot: HTMLElement, b: HTMLElement) {
  slot.querySelector('.popover')?.remove();
  b.setAttribute('aria-expanded', 'false');
}

export async function openConnect(slot?: HTMLElement, anchor?: HTMLElement) {
  const list = wallet.solanaWallets();
  if (!list.length) {
    toast(copy.toast.noWallet);
    return;
  }
  const doConnect = async (w: (typeof list)[number]) => {
    try {
      await wallet.connect(w);
      toast(copy.toast.connected);
    } catch (e) {
      if (wallet.isRejection(e)) toast(copy.toast.refused);
    }
  };
  if (list.length === 1 || !slot || !anchor) return doConnect(list[0]);
  if (slot.querySelector('.popover')) return closePop(slot, anchor);
  const pop = h(`<div class="popover" role="menu" aria-label="${copy.ui.chooseWallet}"></div>`);
  for (const w of list) {
    const item = h(`<button type="button" role="menuitem"><img alt="" src="${w.icon}"><span></span></button>`);
    item.querySelector('span')!.textContent = w.name;
    item.addEventListener('click', () => {
      pop.remove();
      doConnect(w);
    });
    pop.append(item);
  }
  slot.append(pop);
  anchor.setAttribute('aria-expanded', 'true');
}

export function setActiveNav(hash: string) {
  document.querySelectorAll<HTMLAnchorElement>('.nav a').forEach((a) => {
    const href = a.getAttribute('href')!;
    const active = href === '#/' ? hash === '#/' || hash === '' || hash.startsWith('#/coin') : hash.startsWith(href);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}
