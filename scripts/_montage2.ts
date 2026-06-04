import sharp from "sharp";
import { readFileSync } from "fs";
const OUT="implementation/2026-06-04/mark-renders-2";
const m=JSON.parse(readFileSync(`${OUT}/manifest.json`,"utf8")) as any[];
const TW=380,LBL=26,COLS=3;const rows=Math.ceil(m.length/COLS);
(async()=>{
  const tiles=await Promise.all(m.map(async e=>{
    const img=await sharp(`${OUT}/${e.slug}-marked.png`).resize(TW,null,{fit:"inside"}).toBuffer();
    const meta=await sharp(img).metadata();const h=(meta.height??260)+LBL;
    const label=`<svg width="${TW}" height="${h}"><rect width="${TW}" height="${h}" fill="#17252A"/><text x="8" y="18" font-family="sans-serif" font-size="15" font-weight="700" fill="#5eead4">${e.common}</text></svg>`;
    return {buf:await sharp(Buffer.from(label)).composite([{input:img,top:LBL,left:0}]).png().toBuffer(),h};
  }));
  const cellH=Math.max(...tiles.map(t=>t.h));const W=TW*COLS,H=cellH*rows;
  const comp=tiles.map((t,i)=>({input:t.buf,left:(i%COLS)*TW,top:Math.floor(i/COLS)*cellH}));
  await sharp({create:{width:W,height:H,channels:3,background:"#0b1416"}}).composite(comp).png().toFile(`${OUT}/_CONTACT-SHEET.png`);
  console.log(`montage ${W}x${H} -> ${OUT}/_CONTACT-SHEET.png`);
})();
