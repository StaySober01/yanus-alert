import type { Pixels } from './yanusLocator';

export interface RuneMatch { x: number; y: number; width: number; height: number; score: number }
export interface RuneDetector { detect(image: Pixels): RuneMatch | null }
/** Purple connected components matched against a normalized filled-diamond mask.
 * Thresholds calibrated on the supplied screenshot, not a measured accuracy claim. */
export class PurpleDiamondDetector implements RuneDetector {
  detect({ width, height, data }: Pixels): RuneMatch | null {
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      mask[i] = +(r > 90 && b > 90 && r - g > 25 && b - g > 15);
    }
    const visited = new Uint8Array(mask.length);
    let best: RuneMatch | null = null;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i] || visited[i]) continue;
      const queue = [i]; visited[i] = 1;
      let left = width, right = 0, top = height, bottom = 0;
      for (let n = 0; n < queue.length; n++) {
        const p = queue[n], x = p % width, y = Math.floor(p / width);
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, next = ny * width + nx;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || visited[next] || !mask[next]) continue;
          visited[next] = 1; queue.push(next);
        }
      }
      const w = right - left + 1, h = bottom - top + 1;
      if (w < 5 || h < 5 || w > 32 || h > 32 || w / h < 0.75 || w / h > 1.33) continue;
      let intersection = 0, union = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const diamond = Math.abs((x - (w - 1) / 2) / (w / 2)) + Math.abs((y - (h - 1) / 2) / (h / 2)) <= 1;
        const pixel = !!mask[(top + y) * width + left + x];
        if (diamond && pixel) intersection++;
        if (diamond || pixel) union++;
      }
      const score = intersection / union;
      if (score >= 0.86 && (!best || score > best.score)) best = { x: left, y: top, width: w, height: h, score };
    }
    return best;
  }
}
