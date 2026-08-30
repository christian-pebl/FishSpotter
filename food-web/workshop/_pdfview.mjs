import { chromium } from 'playwright'; import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 2 });
await p.setViewportSize({ width: 1100, height: 1400 });
await p.goto(pathToFileURL(join(HERE,'PEBL-species-cards-PRINT-A6-4up.pdf')).href);
await p.waitForTimeout(6000);
await p.screenshot({ path: join(HERE,'_pdfpage.png') });
await b.close(); console.log('pdf page captured');
