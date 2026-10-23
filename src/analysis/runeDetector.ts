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
      // Rune purple has more blue than red; pink/red player dots do not.
      mask[i] = +(r > 90 && b > 90 && r - g > 25 && b - g > 15 && b - r > 8);
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
      if (w < 5 || h < 5 || w > 32 || h > 32 || w / h < 0.6 || w / h > 1.67) continue;
      let intersection = 0, union = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const diamond = Math.abs((x - (w - 1) / 2) / (w / 2)) + Math.abs((y - (h - 1) / 2) / (h / 2)) <= 1;
        const pixel = !!mask[(top + y) * width + left + x];
        if (diamond && pixel) intersection++;
        if (diamond || pixel) union++;
      }
      const score = intersection / union;
      if (score >= 0.86 && (!best || score > best.score)) best = { x: left, y: top, width: w, height: h, score };
      // Captured frames can lose a tip or gain adjacent purple pixels. Fit a
      // square diamond locally instead of stretching its mask to the damaged box.
      // Penalize ALL component pixels outside the template, so a small diamond
      // inside a circle/square does not become an automatic match.
      for (let size = Math.max(7, Math.max(w, h) - 2); size <= Math.min(32, Math.max(w, h) + 2); size++) {
        const radius = size / 2, center = (size - 1) / 2;
        let expected = 0;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (Math.abs(x - center) + Math.abs(y - center) <= radius) expected++;
        for (let y0 = top - 2; y0 <= top + 1; y0++) for (let x0 = left - 2; x0 <= left + 1; x0++) {
          if (x0 < 0 || y0 < 0 || x0 + size > width || y0 + size > height) continue;
          let overlap = 0;
          for (const p of queue) {
            const x = p % width - x0, y = Math.floor(p / width) - y0;
            if (x >= 0 && y >= 0 && x < size && y < size && Math.abs(x - center) + Math.abs(y - center) <= radius) overlap++;
          }
          const fittedScore = overlap / (queue.length + expected - overlap);
          if (fittedScore >= 0.8 && (!best || fittedScore > best.score)) best = { x: x0, y: y0, width: size, height: size, score: fittedScore };
        }
      }
    }
    return best;
  }
}
