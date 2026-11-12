import './styles.css';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { copy } from './copy';
import { mountShell, setActiveNav } from './shell';

gsap.registerPlugin(Flip);

type View = (root: HTMLElement, arg?: string) => void | (() => void);

const routes: Record<string, () => Promise<{ default: View }>> = {
  '': () => import('./views/dashboard'),
  payroll: () => import('./views/payroll'),
  statement: () => import('./views/statement'),
  book: () => import('./views/book'),
  how: () => import('./views/how'),
  launch: () => import('./views/launch'),
  coin: () => import('./views/coin'),
};

document.title = copy.meta.title;
const main = mountShell(document.getElementById('app')!);
let cleanup: void | (() => void);
let seq = 0;

async function route() {
  const hash = location.hash || '#/';
  const [, name = '', arg] = hash.replace(/^#\/?/, '#/').split('/');
  const key = name in routes ? name : '';
  const n = ++seq;
  const mod = await routes[key]();
  if (n !== seq) return;
  if (typeof cleanup === 'function') cleanup();
  main.innerHTML = '';
  setActiveNav(hash);
  cleanup = mod.default(main, arg ? decodeURIComponent(arg) : undefined);
  if (!hash.includes('#how-anchor')) window.scrollTo({ top: 0 });
}

window.addEventListener('hashchange', route);
route();
