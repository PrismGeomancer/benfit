import { gsap } from 'gsap';

export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function h(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

export function $(sel: string, root: ParentNode = document) {
  return root.querySelector(sel) as HTMLElement | null;
}
export function $$(sel: string, root: ParentNode = document) {
  return Array.from(root.querySelectorAll(sel)) as HTMLElement[];
}

export function toast(text: string) {
  let host = document.querySelector('.toasts');
  if (!host) {
    host = h('<div class="toasts" role="status" aria-live="polite"></div>');
    document.body.append(host);
  }
  const t = h(`<div class="toast"></div>`);
  t.textContent = text;
  host.append(t);
  setTimeout(() => t.remove(), 4200);
}

const counted = new WeakSet<Element>();
/** Count a number up once, on first load. `fmt` formats the in-between values. */
export function countUp(el: HTMLElement, to: number, fmt: (n: number) => string) {
  if (reduced() || counted.has(el) || !isFinite(to) || to === 0) {
    el.textContent = fmt(to);
    counted.add(el);
    return;
  }
  counted.add(el);
  const o = { v: 0 };
  gsap.to(o, { v: to, duration: 0.9, ease: 'power2.out', onUpdate: () => (el.textContent = fmt(o.v)) });
}

export function sparkSvg(values: number[] | null, w = 88, hgt = 28): string {
  if (!values || values.length < 2) return `<svg class="spark" viewBox="0 0 ${w} ${hgt}" aria-hidden="true"></svg>`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(hgt - 3 - ((v - min) / span) * (hgt - 6)).toFixed(1)}`);
  const up = values[values.length - 1] >= values[0];
  return `<svg class="spark" viewBox="0 0 ${w} ${hgt}" aria-hidden="true"><polyline fill="none" stroke="${up ? '#0A7A4A' : '#B3261E'}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" points="${pts.join(' ')}"/></svg>`;
}

export function copyText(text: string) {
  return navigator.clipboard?.writeText(text);
}

export async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

const drawn = new WeakSet<Element>();
/** Tenure bars draw in once, on first reveal. */
export function drawBars(root: ParentNode) {
  const bars = $$('.bar i', root).filter((b) => !drawn.has(b));
  if (!bars.length) return;
  if (reduced() || !('IntersectionObserver' in window)) {
    bars.forEach((b) => drawn.add(b));
    return;
  }
  bars.forEach((b) => gsap.set(b, { scaleX: 0 }));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      drawn.add(e.target);
      gsap.to(e.target, { scaleX: 1, duration: 0.6, ease: 'power2.out' });
    }
  });
  bars.forEach((b) => io.observe(b));
}
