// Render the workshop print pieces to A4 PDFs.
//   node food-web/workshop/make-pdf.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const JOBS = [
  { src: 'guide.html',          out: 'PEBL-workshop-guide-seaweed-farm.pdf', margin: { top:'14mm', bottom:'12mm', left:'14mm', right:'14mm' } },
  { src: 'evidence-cards.html', out: 'PEBL-workshop-evidence-cards.pdf',     margin: { top:'0', bottom:'0', left:'0', right:'0' } },
  { src: 'cards.html',          out: 'PEBL-species-cards-review.pdf',       margin: { top:'0', bottom:'0', left:'0', right:'0' } },
  // the real print artwork: true A6, 4-up, fronts and backs on alternating sheets
  { src: 'cards-print.html',    out: 'PEBL-species-cards-PRINT-A6-4up.pdf', margin: { top:'0', bottom:'0', left:'0', right:'0' } },
];

const b = await chromium.launch();
for (const j of JOBS) {
  const p = await b.newPage();
  await p.goto(pathToFileURL(join(HERE, j.src)).href, { waitUntil: 'networkidle' });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: join(HERE, j.out), format: 'A4', printBackground: true, margin: j.margin });
  await p.close();
  console.log('wrote', j.out);
}
await b.close();
