import { mkdir, readdir, copyFile } from 'node:fs/promises';
const output = new URL('../public/ocr/', import.meta.url);
await mkdir(output, { recursive: true });
const core = new URL('../node_modules/tesseract.js-core/', import.meta.url);
for (const file of await readdir(core)) if (file.endsWith('.wasm') || file.endsWith('.wasm.js')) await copyFile(new URL(file, core), new URL(file, output));
await copyFile(new URL('../node_modules/tesseract.js/dist/worker.min.js', import.meta.url), new URL('worker.min.js', output));
await copyFile(new URL('../node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz', import.meta.url), new URL('eng.traineddata.gz', output));
console.log('Local OCR worker, WASM and language assets prepared. No runtime CDN required.');
