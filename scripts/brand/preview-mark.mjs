import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const [,, out, ...files] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 320 } });
const items = files.map(f => readFileSync(f, 'utf8'));
const html = `<body style="margin:0;background:#E7ECEE;display:flex;gap:24px;align-items:center;padding:24px;font:12px sans-serif">
${items.map(s => [256,64,32,16].map(n=>`<div style="width:${n}px;height:${n}px">${s.replace('<svg ', `<svg width="${n}" height="${n}" `)}</div>`).join('')).join('<div style="width:30px"></div>')}
<div style="width:96px;height:96px;border-radius:50%;overflow:hidden">${items[0].replace('<svg ','<svg width="96" height="96" ')}</div></body>`;
await p.setContent(html);
await p.screenshot({ path: out });
await b.close();
