// Render the facilitator guide to a print-ready A4 PDF.
//   node food-web/workshop/make-pdf.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = join(HERE, 'guide.html');
const out = join(HERE, 'PEBL-workshop-guide-seaweed-farm.pdf');

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(pathToFileURL(src).href, { waitUntil: 'networkidle' });
await p.emulateMedia({ media: 'print' });
await p.pdf({ path: out, format: 'A4', printBackground: true,
  margin: { top: '14mm', bottom: '12mm', left: '14mm', right: '14mm' } });
await b.close();
console.log('wrote', out);
