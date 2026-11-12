// Small, once-only motion for sections below the fold. Everything is skipped when the
// visitor prefers reduced motion; content is fully visible without it.
import { gsap } from 'gsap';
import { reduced } from './ui';

function onReveal(el: Element, cb: () => void, threshold = 0.25) {
  if (!('IntersectionObserver' in window)) return cb();
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      cb();
    },
    { threshold },
  );
  io.observe(el);
}

/** Each step icon's own gesture. Also replayed on hover. */
function iconGesture(art: Element): gsap.core.Timeline {
  const tl = gsap.timeline();
  const svg = art.querySelector('svg');
  if (!svg) return tl;
  const coin = svg.querySelector('.i-coin');
  const fri = svg.querySelector('.i-fri');
  const hand = svg.querySelector('.i-hand');
  if (coin && art.closest('.step:first-child')) {
    // A coin drops into the payslip slot.
    tl.fromTo(coin, { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'bounce.out' });
  } else if (coin) {
    // A coin settles into the wallet.
    tl.fromTo(coin, { y: -6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out' });
  }
  if (fri) {
    // The Friday column fills, bottom up.
    tl.fromTo(fri, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.4, ease: 'steps(4)' });
  }
  if (hand) {
    // The stopwatch hand sweeps round and resets to the top.
    tl.fromTo(hand, { rotation: -300, svgOrigin: '32 36' }, { rotation: 0, svgOrigin: '32 36', duration: 0.7, ease: 'power3.out' });
  }
  return tl;
}

export function animateHow(section: HTMLElement) {
  if (reduced()) return;
  const steps = Array.from(section.querySelectorAll<HTMLElement>('.step'));
  const line = section.querySelector('.steps');
  const notes = section.querySelectorAll('.note-card, .splitbar');
  gsap.set(steps.map((s) => s.querySelector('.step-art')), { scale: 0.86, opacity: 0 });
  gsap.set(steps.map((s) => s.querySelector('.step-no')), { scale: 0 });
  gsap.set(notes, { opacity: 0 });
  line?.classList.add('line-hidden');

  onReveal(section.querySelector('.steps') ?? section, () => {
    line?.classList.remove('line-hidden');
    line?.classList.add('line-draw');
    steps.forEach((step, i) => {
      const art = step.querySelector('.step-art')!;
      const tl = gsap.timeline({ delay: 0.15 + i * 0.22 });
      tl.to(art, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(1.6)' });
      tl.to(step.querySelector('.step-no'), { scale: 1, duration: 0.25, ease: 'back.out(2.2)' }, '-=0.1');
      tl.add(iconGesture(art), '-=0.15');
    });
    gsap.to(notes, { opacity: 1, duration: 0.5, delay: 0.15 + steps.length * 0.22, stagger: 0.12 });
  });

  // Hover (or focus within) replays the icon's gesture. Subtle, and only after the intro.
  for (const step of steps) {
    const art = step.querySelector('.step-art')!;
    let playing: gsap.core.Timeline | null = null;
    step.addEventListener('pointerenter', () => {
      if (playing?.isActive()) return;
      playing = iconGesture(art);
    });
  }
}

/** Rule figures count up once (1%, 100,000, 0.001). Symbols (+, 0) stay as they are. */
export function animateRules(band: HTMLElement) {
  if (reduced()) return;
  const figs = Array.from(band.querySelectorAll<HTMLElement>('.rule-big'));
  onReveal(band, () => {
    figs.forEach((el, i) => {
      const text = el.textContent ?? '';
      const m = text.match(/^([\d,]*\.?\d+)(.*)$/);
      if (!m || Number(m[1].replace(/,/g, '')) <= 1 && !text.includes('.')) {
        gsap.fromTo(el, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, delay: i * 0.08, ease: 'power2.out' });
        return;
      }
      const target = Number(m[1].replace(/,/g, ''));
      const dp = (m[1].split('.')[1] ?? '').length;
      const o = { v: 0 };
      gsap.to(o, {
        v: target,
        duration: 0.9,
        delay: i * 0.08,
        ease: 'power2.out',
        onUpdate: () => (el.textContent = (dp ? o.v.toFixed(dp) : Math.round(o.v).toLocaleString('en-US')) + m[2]),
        onComplete: () => (el.textContent = text),
      });
    });
    gsap.fromTo(band.querySelector('.formula'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
  });
}

/** The empty-ledger notice lands like a stamp. */
export function animateLedger(root: HTMLElement) {
  if (reduced()) return;
  const stamp = root.querySelector('.ledger-body p');
  const ic = root.querySelector('.ledger-ic');
  if (!stamp) return;
  gsap.set([stamp, ic], { opacity: 0 });
  onReveal(root, () => {
    gsap.fromTo(ic, { y: -8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out' });
    gsap.fromTo(
      stamp,
      { scale: 1.12, rotation: -2.5, opacity: 0 },
      { scale: 1, rotation: 0, opacity: 1, duration: 0.32, delay: 0.15, ease: 'power4.in' },
    );
  });
}
