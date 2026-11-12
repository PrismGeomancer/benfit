import { gsap } from 'gsap';
import { config } from '../config';
import { copy, fill } from '../copy';
import { esc } from '../lib/format';
import { h, reduced } from '../lib/ui';
import { icons } from '../ui/icons';
import { animateHow } from '../lib/reveal';

const STEP_ICONS = [icons.launch, icons.hold, icons.payday, icons.reset];

export function howSection(asPage = false): HTMLElement {
  const w = copy.how;
  const Tag = asPage ? 'h1' : 'h2';
  const steps = w.steps
    .map((s, i) => {
      const body = 'verify' in s && s.verify && !config.verified[s.verify] ? s.fallback : s.body;
      return `<li class="step">
        <div class="step-art">${STEP_ICONS[i]}<span class="step-no">${i + 1}</span></div>
        <h3>${s.title}</h3>
        <p>${body}</p>
      </li>`;
    })
    .join('');
  const split = config.verified.feeRouting
    ? `<div><div class="splitbar" role="list">
        ${w.split.map((x, i) => `<div role="listitem" class="${i === 0 ? 'full' : 'zero'}"><span>${x}</span></div>`).join('')}
      </div><p class="note split-note">${w.splitNote}</p></div>`
    : `<div class="note-card"><span class="note-ic">${icons.ledger}</span><p>${w.splitFallback}</p></div>`;
  const more = asPage
    ? ''
    : `<p class="how-more"><a class="btn btn-ghost" href="#/how/faq">${copy.help.tabs.faq}</a><a class="btn btn-ghost" href="#/how/docs">${copy.help.tabs.docs}</a></p>`;
  const el = h(`<section class="section how" id="how" aria-labelledby="how-h">
    <${Tag} id="how-h">${w.heading}</${Tag}>
    <ol class="steps">${steps}</ol>
    <div class="how-foot">
      ${split}
      <div class="note-card dark"><span class="note-ic">${icons.shield}</span><p>${w.trust}</p></div>
    </div>
    ${more}
  </section>`);
  animateHow(el);
  return el;
}

function faqSection(): HTMLElement {
  const c = copy.help;
  const cost = config.launch_cost_sol !== null && config.verified.launchCost ? String(config.launch_cost_sol) : '0.025';
  const el = h(`<section class="section help-faq" id="faq" aria-labelledby="faq-h">
    <h2 id="faq-h">${c.faqHeading}</h2>
    <div class="faq">
      ${c.faq
        .map(
          ([q, a], i) => `<details class="qa" ${i === 0 ? 'open' : ''}>
            <summary><span>${esc(q)}</span><i aria-hidden="true"></i></summary>
            <div class="qa-a"><p>${esc(fill(a, { launch_cost: cost }))}</p></div>
          </details>`,
        )
        .join('')}
    </div>
  </section>`);
  // Subtle open/close: the answer's height eases instead of snapping.
  el.querySelectorAll<HTMLDetailsElement>('details').forEach((d) => {
    const summary = d.querySelector('summary')!;
    const body = d.querySelector('.qa-a') as HTMLElement;
    summary.addEventListener('click', (e) => {
      if (reduced()) return;
      e.preventDefault();
      if (d.open) {
        gsap.to(body, {
          height: 0,
          opacity: 0,
          duration: 0.22,
          ease: 'power2.in',
          onComplete: () => {
            d.open = false;
            gsap.set(body, { clearProps: 'all' });
          },
        });
      } else {
        d.open = true;
        gsap.fromTo(body, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.28, ease: 'power2.out', clearProps: 'height' });
      }
    });
  });
  return el;
}

function docsSection(): HTMLElement {
  const c = copy.help;
  const files: Record<string, string> = {
    'registry.json': `./data/${config.dataDir}registry.json`,
    'payroll/<date>.json': `./data/${config.dataDir}payroll/index.json`,
  };
  const link = (line: string) => {
    const f = Object.keys(files).find((k) => line.startsWith(k));
    return f ? `${esc(line)} <a href="${files[f]}" target="_blank" rel="noopener">${c.dataLink}</a>` : esc(line);
  };
  return h(`<section class="section help-docs" id="docs" aria-labelledby="docs-h">
    <h2 id="docs-h">${c.docsHeading}</h2>
    <p class="lede">${c.docsLede}</p>
    <div class="docs">
      <nav class="docs-toc" aria-label="${c.docsHeading}">
        ${c.docs.map((d) => `<a href="#/how/docs" data-doc="${d.id}">${d.title}</a>`).join('')}
        <a href="#/how/docs" data-doc="glossary">${c.glossaryHeading}</a>
      </nav>
      <div class="docs-body">
        ${c.docs
          .map(
            (d) => `<article class="doc" id="doc-${d.id}">
              <h3>${d.title}</h3>
              <ul>${d.body.map((b) => `<li>${link(b)}</li>`).join('')}</ul>
            </article>`,
          )
          .join('')}
        <article class="doc" id="doc-glossary">
          <h3>${c.glossaryHeading}</h3>
          <dl class="glossary">${c.glossary.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        </article>
      </div>
    </div>
  </section>`);
}

export default function how(root: HTMLElement, arg?: string) {
  const c = copy.help.tabs;
  const wrap = h(`<div class="wrap how-page">
    <nav class="subnav" aria-label="${copy.how.heading}">
      <button type="button" data-go="how">${c.overview}</button>
      <button type="button" data-go="faq">${c.faq}</button>
      <button type="button" data-go="docs">${c.docs}</button>
    </nav>
  </div>`);
  wrap.append(howSection(true), faqSection(), docsSection());
  root.append(wrap);

  const go = (id: string, smooth = true) => {
    const target = wrap.querySelector(`#${id}`) as HTMLElement | null;
    if (!target) return;
    const y = target.getBoundingClientRect().top + window.scrollY - 128;
    window.scrollTo({ top: id === 'how' ? 0 : y, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  };
  wrap.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go!)));
  wrap.querySelectorAll<HTMLAnchorElement>('[data-doc]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      go(`doc-${a.dataset.doc}`);
    }),
  );

  // Highlight the section in view.
  const buttons = Array.from(wrap.querySelectorAll<HTMLButtonElement>('[data-go]'));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        buttons.forEach((b) => b.setAttribute('aria-current', String(b.dataset.go === e.target.id)));
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  ['how', 'faq', 'docs'].forEach((id) => io.observe(wrap.querySelector(`#${id}`)!));
  if (arg === 'faq' || arg === 'docs') requestAnimationFrame(() => go(arg, false));
  return () => io.disconnect();
}
