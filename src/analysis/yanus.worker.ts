/// <reference lib="webworker" />
import { YanusLocator } from './yanusLocator';
import { timerImage, hasWideTimer } from './timerImage';
let locator: Promise<YanusLocator> | null = null;
async function load(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('기준 이미지를 불러오지 못했습니다.');
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas를 사용할 수 없습니다.');
    context.drawImage(bitmap, 0, 0);
    return new YanusLocator(context.getImageData(0, 0, bitmap.width, bitmap.height));
  } finally { bitmap.close(); }
}
self.onmessage = async (event: MessageEvent<{ id: number; templateUrl: string; width: number; height: number; buffer: ArrayBuffer }>) => {
  const { id, templateUrl, width, height, buffer } = event.data;
  try {
    locator ??= load(templateUrl);
    const detector = await locator;
    const start = performance.now();
    const frame = { width, height, data: new Uint8ClampedArray(buffer) };
    const result = detector.locate(frame);
    const timer = result.icon ? timerImage(frame, result.icon.bounds) : null;
    const wideLayout = result.icon ? hasWideTimer(frame, result.icon.bounds) : false;
    self.postMessage({ id, result, timer, wideLayout, durationMs: performance.now() - start });
  } catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : '아이콘 탐색에 실패했습니다.' }); }
};
