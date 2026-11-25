// 5-second opening: coins fly out of the distance toward the viewer, the BENFIT coin settles,
// then the camera zooms through it into the site. Plays once per browser session, can be
// skipped (click, any key, or the Skip button), and never runs for reduced motion or automation.
import { gsap } from 'gsap';
import { copy } from './copy';

const KEY = 'benfit-intro-seen';
const COINS = 64;

function shouldPlay(): boolean {
  if (navigator.webdriver) return false;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    if (sessionStorage.getItem(KEY)) return false;
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* storage blocked: play anyway */
  }
  return true;
}

export function playIntro(): Promise<void> {
  if (!shouldPlay()) return Promise.resolve();
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'intro';
    el.setAttribute('role', 'presentation');
    el.innerHTML = `
      <div class="intro-stage">
        <div class="intro-coins"></div>
        <div class="intro-hero">
          <img class="intro-logo" src="./brand/benfit-logo-512.png" alt="" width="140" height="140">
          <p class="intro-word">${copy.nav.logo}</p>
          <p class="intro-tag">${copy.intro.tagline}</p>
        </div>
      </div>
      <button class="intro-skip" type="button">${copy.intro.skip}</button>`;
    document.body.append(el);
    document.documentElement.style.overflow = 'hidden';

    const field = el.querySelector('.intro-coins') as HTMLElement;
    const coins: HTMLElement[] = [];
    for (let i = 0; i < COINS; i++) {
      const c = document.createElement('i');
      c.className = 'intro-coin';
      field.append(c);
      coins.push(c);
    }
    const logo = el.querySelector('.intro-logo') as HTMLElement;
    const word = el.querySelector('.intro-word') as HTMLElement;
    const tag = el.querySelector('.intro-tag') as HTMLElement;
    const stage = el.querySelector('.intro-stage') as HTMLElement;
    const app = document.getElementById('app')!;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      tl.kill();
      gsap.killTweensOf([el, app, ...coins]);
      gsap.set(app, { clearProps: 'all' });
      el.remove();
      document.documentElement.style.overflow = '';
      window.removeEventListener('keydown', finish);
      resolve();
    };

    gsap.set(field, { perspective: 700 });
    gsap.set(app, { transformOrigin: '50% 30%' });
    gsap.set([word, tag], { opacity: 0, y: 12 });
    gsap.set(logo, { scale: 0, opacity: 0, transformOrigin: '50% 32%' });

    const tl = gsap.timeline({ onComplete: finish });
    // 0 – 2.8s: coins rush out of the centre toward the camera, spinning.
    coins.forEach((c, i) => {
      const a = Math.random() * Math.PI * 2;
      const r = 80 + Math.random() * 480;
      const t = (i / COINS) * 2.0;
      gsap.set(c, { x: 0, y: 0, z: -2400, opacity: 0, rotationX: Math.random() * 360, rotationY: Math.random() * 360 });
      tl.to(c, { opacity: 1, duration: 0.2, ease: 'none' }, t);
      tl.to(
        c,
        {
          x: Math.cos(a) * r * 2.2,
          y: Math.sin(a) * r * 1.3,
          z: 780,
          rotationY: '+=' + (360 + Math.random() * 540),
          rotationX: '+=' + (120 + Math.random() * 240),
          duration: 1.5 + Math.random() * 0.6,
          ease: 'power2.in',
        },
        t,
      );
      tl.set(c, { opacity: 0 }, t + 2.2);
    });
    // 1.9 – 3.6s: the BENFIT coin settles in the middle and names itself.
    tl.to(logo, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.8)' }, 1.9);
    tl.to(logo, { rotationY: 360, duration: 0.9, ease: 'power3.out' }, 1.9);
    tl.to(word, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 2.5);
    tl.to(tag, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 2.8);
    // 3.7 – 5.0s: camera zooms through the coin; the page settles in behind it.
    tl.to([word, tag], { opacity: 0, duration: 0.25 }, 3.6);
    tl.to(logo, { scale: 46, duration: 1.3, ease: 'power3.in' }, 3.7);
    tl.fromTo(app, { scale: 1.08, opacity: 0.6 }, { scale: 1, opacity: 1, duration: 1.3, ease: 'power2.out' }, 3.7);
    tl.to(stage, { opacity: 0, duration: 0.5, ease: 'power1.in' }, 4.5);
    tl.to(el, { opacity: 0, duration: 0.25 }, 4.75);

    el.addEventListener('click', finish);
    window.addEventListener('keydown', finish);
  });
}
