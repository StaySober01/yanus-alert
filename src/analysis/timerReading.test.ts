import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { createWorker, PSM } from 'tesseract.js';
import { expect, it } from 'vitest';
import { YanusLocator } from './yanusLocator';
import { hasWideTimer, timerImage } from './timerImage';
import { parseTimer } from './timerReading';
it('reads pixels in the supplied labeled fixtures using the same local OCR model', async () => {
 const worker = await createWorker('eng',0,{langPath:resolve('node_modules/@tesseract.js-data/eng/4.0.0'),cacheMethod:'none',legacyCore:true,legacyLang:true});
 const locator = new YanusLocator(PNG.sync.read(readFileSync('public/templates/sol-yanus.png')));
 try {
  await worker.setParameters({classify_enable_learning: '0', classify_enable_adaptive_matcher: '0', tessedit_char_whitelist:'0123456789:',tessedit_pageseg_mode:PSM.SINGLE_LINE,user_defined_dpi:'300'});
  for (const [name, seconds] of [['11',11],['10',10],['9',9],['before',5],['after',79],['47',47],['after',79],['before',5],['9',9],['10',10],['11',11]] as const) {
   const frame = PNG.sync.read(readFileSync(`samples/fixtures/buffs-${name}.png`));
   const bounds = locator.locate(frame).icon!.bounds;
   const image = timerImage(frame,bounds); const buffer = PNG.sync.write({...image,data:Buffer.from(image.data)} as PNG);
   const {data} = await worker.recognize(buffer);
   const reading = parseTimer(data.text,data.confidence,hasWideTimer(frame,bounds));
   expect(reading?.seconds, `${name}: OCR=${data.text}, confidence=${data.confidence}`).toBe(seconds);
  }
 } finally { await worker.terminate(); }
},30000);
it('strictly parses supported time formats and exposes inferred punctuation', () => {
 expect(parseTimer('1:19\n',80)?.seconds).toBe(79);
 expect(parseTimer('1 19',57,true)).toMatchObject({seconds:79,separatorInferred:true});
 for (const text of ['119','111','1:99','1 19','abc','99','-1','1:1','9:60','']) expect(parseTimer(text,90)).toBeNull();
 expect(parseTimer('10',39)).toBeNull(); expect(parseTimer('10',NaN)).toBeNull();
});

