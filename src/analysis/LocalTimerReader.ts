import { createWorker, PSM, type Worker as OcrWorker } from 'tesseract.js';
import { parseTimer, type TimerReading } from './timerReading';
import type { Pixels } from './yanusLocator';

export interface TimerReader { read(image: Pixels, wideLayout: boolean): Promise<TimerReading | null>; close(): void }
export class LocalTimerReader implements TimerReader {
  private worker: Promise<OcrWorker> | null = null;
  private stopped = false;
  private async getWorker() {
    if (this.stopped) throw new Error('판독이 종료되었습니다.');
    if (!this.worker) {
      const base = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href;
      this.worker = createWorker('eng', 0, { workerPath: `${base}worker.min.js`, corePath: base, langPath: base.replace(/\/$/, ''), legacyCore: true, legacyLang: true, workerBlobURL: false, cacheMethod: 'none' }).then(async worker => {
        if (this.stopped) { await worker.terminate(); throw new Error('판독이 종료되었습니다.'); }
        await worker.setParameters({ classify_enable_learning: '0', classify_enable_adaptive_matcher: '0', tessedit_char_whitelist: '0123456789:', tessedit_pageseg_mode: PSM.SINGLE_LINE, user_defined_dpi: '300' });
        return worker;
      });
    }
    return this.worker;
  }
  async read(image: Pixels, wideLayout: boolean) {
    const worker = await this.getWorker();
    if (this.stopped) return null;
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('숫자 판독용 Canvas를 사용할 수 없습니다.');
    context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
    const { data } = await worker.recognize(canvas);
    return this.stopped ? null : parseTimer(data.text, data.confidence, wideLayout);
  }
  close() { this.stopped = true; void this.worker?.then(worker => worker.terminate()).catch(() => {}); }
}

