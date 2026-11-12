// Generates the BENFIT mark variants. Geometry in a 128 grid.
import { writeFileSync, mkdirSync } from 'node:fs';
const Y = '#F2E600', N = '#0F1E2E';
const stem = { x: 34, w: 11, top: 20, bot: 108 };
const tyre = 7.5;
const up = { cx: 66, cy: 40.5, R: 20.5 };   // outer radius
const lo = { cx: 69, cy: 85, R: 23 };
const r = (w) => w.R - tyre / 2;           // stroke centre radius
function spokes(w, n) {
  const inner = 3.4, outer = w.R - tyre + 0.5;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 2 ? 0.06 : -0.06); // slight cross-lacing
    const b = (i / n) * Math.PI * 2;
    d += `M${(w.cx + Math.cos(b) * inner).toFixed(2)} ${(w.cy + Math.sin(b) * inner).toFixed(2)}L${(w.cx + Math.cos(a) * outer).toFixed(2)} ${(w.cy + Math.sin(a) * outer).toFixed(2)}`;
  }
  return d;
}
function wheel(w, detail) {
  let s = `<circle cx="${w.cx}" cy="${w.cy}" r="${r(w)}" stroke-width="${tyre}"/>`;
  if (detail) {

    s += `<path d="${spokes(w, 12)}" stroke-width="1.15"/>`;
  }
  return s;
}
function mark({ detail, bg }) {
  // arms: flat top and bottom strokes from the stem to each wheel's tangent, like a set B
  const arms = `<rect x="${stem.x}" y="${up.cy - up.R}" width="${up.cx - stem.x}" height="${tyre}"/>` +
               `<rect x="${stem.x}" y="${lo.cy + lo.R - tyre}" width="${lo.cx - stem.x}" height="${tyre}"/>` +
               `<rect x="${stem.x}" y="${up.cy + up.R - tyre}" width="${up.cx - stem.x}" height="${tyre}"/>`;
  const hub = (w, rr) => `<circle cx="${w.cx}" cy="${w.cy}" r="${rr}"/>`;
  return `${bg}
  <g fill="${Y}">
    <rect x="${stem.x}" y="${stem.top}" width="${stem.w}" height="${stem.bot - stem.top}" rx="2"/>
    ${arms}
    ${hub(up, detail ? 3.6 : 4.2)}${hub(lo, detail ? 3.9 : 4.6)}
  </g>
  <g fill="none" stroke="${Y}" stroke-linecap="round">${wheel(up, detail)}${wheel(lo, detail)}</g>`;
}
const svg = (inner, label = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"${label ? ' role="img" aria-label="BENFIT"' : ''}>${label ? '<title>BENFIT</title>' : ''}${inner}\n</svg>\n`;
const square = `<rect width="128" height="128" rx="28" fill="${N}"/>`;
const round = `<circle cx="64" cy="64" r="64" fill="${N}"/>`;
const none = '';
mkdirSync('public/brand', { recursive: true });
writeFileSync('public/brand/benfit-mark.svg', svg(mark({ detail: true, bg: square })));
writeFileSync('public/brand/benfit-mark-small.svg', svg(mark({ detail: false, bg: square })));
// Token avatar: mark scaled to ~58% of the circle so a circular crop never clips it.
writeFileSync('public/brand/benfit-avatar.svg', svg(`${round}<g transform="translate(64 64) scale(0.78) translate(-63.5 -64)">${mark({ detail: true, bg: none })}</g>`));
writeFileSync('public/brand/benfit-mark-bare.svg', svg(mark({ detail: true, bg: none })));
writeFileSync('public/favicon.svg', svg(mark({ detail: false, bg: square })));
// Inline copy for the header and footer (decorative there; the wordmark text carries the name).
writeFileSync('src/ui/mark.svg', svg(mark({ detail: false, bg: square }), false).replace('<svg ', '<svg aria-hidden="true" focusable="false" '));
console.log('ok');
