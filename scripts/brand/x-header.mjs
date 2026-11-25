// node scripts/brand/x-header.mjs
// Renders the X (Twitter) header, 1500x500, from the logo and brand colours only.
// Output: docs/brand/benfit-x-header.png (1500x500) and benfit-x-header@2x.png (3000x1000).
//
// Layout notes for X's crop: the profile picture covers the bottom-left and phones crop the sides,
// so everything that matters sits in the middle band (about x 250 to 1260).
// No "benefit"/"reward"/return claims as text (docs/benfit-image-prompts.md rules).
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const logo = 'data:image/png;base64,' + readFileSync(resolve(root, 'docs/brand/benfit-logo.png')).toString('base64');
const font = (w) =>
  'data:font/woff2;base64,' +
  readFileSync(resolve(root, `node_modules/@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-${w}-normal.woff2`)).toString('base64');

// The logo's own background, so it blends in with no visible box.
const BG = '#0b1c2d';
const HIVIS = '#F2E600';
const RING = '#12273b';

// Tenure bars: each one longer than the last, like days held. Right ends are rounded like the logo's.
const bars = [150, 290, 470, 690].map(
  (w, i) => `<rect x="580" y="${346 + i * 28}" width="${w}" height="16" rx="8" fill="${HIVIS}" opacity="${0.45 + i * 0.18}"/>`,
).join('');

// Faint concentric rings behind the right side: coins / wheels, kept barely above the background.
const rings = [90, 170, 250, 330, 410, 490]
  .map((r) => `<circle cx="1330" cy="250" r="${r}" fill="none" stroke="${RING}" stroke-width="${r % 180 === 90 ? 5 : 3}"/>`)
  .join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:SG;font-weight:700;src:url(${font(700)}) format('woff2')}
@font-face{font-family:SG;font-weight:500;src:url(${font(500)}) format('woff2')}
*{margin:0;box-sizing:border-box}
body{width:1500px;height:500px;background:${BG};position:relative;overflow:hidden;font-family:SG,system-ui,sans-serif}
svg{position:absolute;left:0;top:0}
.tape{position:absolute;left:0;right:0;height:16px;background:repeating-linear-gradient(-45deg,${HIVIS} 0 16px,${BG} 16px 32px)}
.tape.t{top:0}.tape.b{bottom:0}
.logo{position:absolute;left:250px;top:62px;width:290px;height:290px;-webkit-mask-image:radial-gradient(circle farthest-corner,#000 62%,transparent 74%);mask-image:radial-gradient(circle farthest-corner,#000 62%,transparent 74%)}
.copy{position:absolute;left:580px;top:76px;width:860px;color:#F8F9F9}
h1{font-size:112px;line-height:1;font-weight:700;letter-spacing:-.028em;white-space:nowrap}
p{margin-top:22px;font-size:36px;line-height:1.28;font-weight:500;color:#aebbc6}
p b{color:${HIVIS};font-weight:700}
</style></head><body>
<svg width="1500" height="500" viewBox="0 0 1500 500">${rings}${bars}</svg>
<div class="tape t"></div><div class="tape b"></div>
<img class="logo" src="${logo}" alt="">
<div class="copy"><h1>Paid by tenure.</h1><p>Fees in. <b>Payday Friday.</b><br>Sell and the clock restarts.</p></div>
</body></html>`;

mkdirSync(resolve(root, 'docs/brand'), { recursive: true });
const b = await chromium.launch();
for (const [scale, name] of [[1, 'benfit-x-header.png'], [2, 'benfit-x-header@2x.png']]) {
  const p = await b.newPage({ viewport: { width: 1500, height: 500 }, deviceScaleFactor: scale });
  await p.setContent(html);
  await p.evaluate(() => document.fonts.ready);
  writeFileSync(resolve(root, 'docs/brand', name), await p.screenshot({ type: 'png' }));
  await p.close();
}
await b.close();
console.log('wrote docs/brand/benfit-x-header.png and @2x');
