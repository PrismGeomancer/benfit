// The payslip card. It prints: the paper feeds out of a slot with a ratchet ease, then the
// line items land one at a time, 40ms apart. Off when the user prefers reduced motion.
import { gsap } from 'gsap';
import { esc } from '../lib/format';
import { h, reduced } from '../lib/ui';

export interface Slip {
  title: string;
  sub: string;
  lines: [string, string][];
  total: { label: string; value: string; note?: string };
  foot?: string;
}

export function slipHtml(s: Slip): string {
  return `
  <div class="slip">
    <div class="slip-head" data-line><b>${esc(s.title)}</b><span class="num">${esc(s.sub)}</span></div>
    ${s.lines.map(([k, v]) => `<div class="slip-line" data-line><span>${esc(k)}</span><span class="num">${esc(v)}</span></div>`).join('')}
    <div class="slip-line total" data-line><span>${esc(s.total.label)}${s.total.note ? `<small>${esc(s.total.note)}</small>` : ''}</span><span class="num">${esc(s.total.value)}</span></div>
    ${s.foot ? `<p class="slip-foot num" data-line>${esc(s.foot)}</p>` : ''}
  </div>`;
}

export function createPrinter(host: HTMLElement) {
  const wrap = h(`<div class="slot-wrap"><div class="slot" aria-hidden="true"></div><div class="slip-clip" aria-live="polite"></div></div>`);
  host.append(wrap);
  const clip = wrap.querySelector('.slip-clip') as HTMLElement;
  let tl: gsap.core.Timeline | null = null;
  let lastKey = '';

  return {
    el: wrap,
    print(s: Slip, force = false) {
      const key = JSON.stringify(s);
      if (key === lastKey && !force) return;
      lastKey = key;
      clip.innerHTML = slipHtml(s);
      const paper = clip.firstElementChild as HTMLElement;
      if (reduced()) return;
      tl?.kill();
      const lines = paper.querySelectorAll('[data-line]');
      tl = gsap.timeline();
      // Ratchet feed: stepped, slightly mechanical.
      tl.fromTo(paper, { yPercent: -100 }, { yPercent: 0, duration: 0.56, ease: 'steps(9)' });
      tl.fromTo(
        lines,
        { autoAlpha: 0, y: -4 },
        { autoAlpha: 1, y: 0, duration: 0.08, ease: 'steps(2)', stagger: 0.04 },
        0.18,
      );
    },
  };
}
