import type { FrameSource } from '../analysis/contracts';
import { pixelRegion, type Region } from '../domain/regions';
/** The same crop path supports a live video or a decoded local screenshot. */
export class CanvasFrameSource implements FrameSource {
  private canvas = document.createElement('canvas');
  constructor(private source: HTMLVideoElement | HTMLImageElement) {}
  read(region?: Region) {
    const s = this.source;
    const width = s instanceof HTMLVideoElement ? s.videoWidth : s.naturalWidth;
    const height = s instanceof HTMLVideoElement ? s.videoHeight : s.naturalHeight;
    if (!width || !height || (s instanceof HTMLVideoElement && s.readyState < 2)) return null;
    const r = region ? pixelRegion(region, width, height) : { x: 0, y: 0, width, height };
    this.canvas.width = r.width; this.canvas.height = r.height;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(s, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
    return { image: ctx.getImageData(0, 0, r.width, r.height), timestampMs: performance.now() };
  }
}
