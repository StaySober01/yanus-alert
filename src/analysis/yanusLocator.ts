import type { Region } from '../domain/regions';

export interface Pixels { width: number; height: number; data: Uint8ClampedArray | Uint8Array }
export interface LocatedIcon { bounds: Region; score: number }
export interface LocateResult { icon: LocatedIcon | null; ambiguous: boolean; candidates: number }
export interface IconLocator { locate(frame: Pixels): LocateResult }
interface Sample { dx: number; dy: number; value: number }
interface Pattern { width: number; height: number; coarse: Sample[]; fine: Sample[] }

/** Sample-based baseline, not a trained classifier. Scores are correlations, not probabilities. */
export const ICON_WIDTHS = [17, 18, 19, 20, 22, 24, 26, 29, 32, 36, 40, 44, 48, 58];
const MIN_SCORE = 0.78;
function intensity(data: Pixels['data'], index: number) { return (data[index] + data[index + 1] + data[index + 2]) / 3; }
function samples(template: Pixels, width: number, height: number, step: number): Sample[] {
  const result: Sample[] = [];
  if (width < 29) {
    // Antialias when reducing the reference; repeated original pixels do not match a reduced screenshot.
    for (let y = 2; y < height - 2; y += step === 1 ? 1 : 2) for (let x = 2; x < width - 2; x += step === 1 ? 1 : 2) {
      if (y >= height * 0.3 && y < height * 0.8) continue;
      const sx = (x + 0.5) * template.width / width - 0.5, sy = (y + 0.5) * template.height / height - 0.5;
      const rx = template.width / width, ry = template.height / height;
      let sum = 0, weights = 0;
      for (let iy = Math.max(0, Math.ceil(sy - ry)); iy <= Math.min(template.height - 1, Math.floor(sy + ry)); iy++) for (let ix = Math.max(0, Math.ceil(sx - rx)); ix <= Math.min(template.width - 1, Math.floor(sx + rx)); ix++) {
        const weight = (1 - Math.abs(ix - sx) / rx) * (1 - Math.abs(iy - sy) / ry);
        sum += intensity(template.data, (iy * template.width + ix) * 4) * weight; weights += weight;
      }
      result.push({ dx: x, dy: y, value: sum / weights });
    }
    return result;
  }
  for (let y = 2; y < template.height - 2; y += step) for (let x = 2; x < template.width - 2; x += step) {
    // Observed timer/outline occupies the central band. UI outer borders are excluded too.
    if (y >= 10 && y < 25 && x >= 5 && x < 25) continue;
    result.push({ dx: Math.floor((x + 0.5) * width / template.width), dy: Math.floor((y + 0.5) * height / template.height), value: intensity(template.data, (y * template.width + x) * 4) });
  }
  return result;
}
function correlation(gray: Float32Array, stride: number, x: number, y: number, points: Sample[]): number {
  let a = 0, b = 0, aa = 0, bb = 0, ab = 0;
  for (const p of points) {
    const value = gray[(y + p.dy) * stride + x + p.dx];
    a += value; b += p.value; aa += value * value; bb += p.value * p.value; ab += value * p.value;
  }
  const n = points.length;
  const denominator = (aa - a * a / n) * (bb - b * b / n);
  return denominator > 1 ? (ab - a * b / n) / Math.sqrt(denominator) : 0;
}
function overlap(a: Region, b: Region) {
  const area = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return area / Math.min(a.width * a.height, b.width * b.height);
}

export class YanusLocator implements IconLocator {
  private patterns: Pattern[];
  constructor(template: Pixels) {
    if (template.width !== 29 || template.height !== 32) throw new Error('지원하는 솔 야누스 기준 이미지는 29 × 32 픽셀입니다.');
    this.patterns = ICON_WIDTHS.map(width => {
      const height = Math.round(width * template.height / template.width);
      return { width, height, coarse: samples(template, width, height, 3), fine: samples(template, width, height, 1) };
    });
  }
  locate(frame: Pixels): LocateResult {
    const { width, height, data } = frame;
    const gray = new Float32Array(width * height);
    const stride = width + 1;
    const yellow = new Uint32Array(stride * (height + 1));
    for (let y = 0; y < height; y++) {
      let row = 0;
      for (let x = 0; x < width; x++) {
        const pixel = y * width + x, index = pixel * 4;
        gray[pixel] = intensity(data, index);
        if (data[index] > 95 && data[index + 1] > 90 && data[index + 2] < 140 && Math.min(data[index], data[index + 1]) - data[index + 2] > 35) row++;
        yellow[(y + 1) * stride + x + 1] = yellow[y * stride + x + 1] + row;
      }
    }
    const matches: LocatedIcon[] = [];
    for (const pattern of this.patterns) {
      const { width: w, height: h } = pattern;
      const left = Math.floor(w * 0.2), right = Math.ceil(w * 0.8);
      const top = Math.floor(h * 0.3), bottom = Math.ceil(h * 0.8);
      const minYellow = Math.max(2, Math.round(w * h * 0.005));
      const maxYellow = w * h * 0.3;
      for (let y = 0; y <= height - h; y++) for (let x = 0; x <= width - w; x++) {
        // Yellow timer evidence filters out the same skill icon on the hotbar.
        const count = yellow[(y + bottom) * stride + x + right] - yellow[(y + top) * stride + x + right] - yellow[(y + bottom) * stride + x + left] + yellow[(y + top) * stride + x + left];
        if (count < minYellow || count > maxYellow) continue;
        if (correlation(gray, width, x, y, pattern.coarse) < 0.58) continue;
        const score = correlation(gray, width, x, y, pattern.fine);
        if (score >= MIN_SCORE) matches.push({ bounds: { x, y, width: w, height: h }, score });
      }
    }
    matches.sort((a, b) => b.score - a.score);
    const unique: LocatedIcon[] = [];
    for (const match of matches) if (!unique.some(other => overlap(other.bounds, match.bounds) > 0.4)) unique.push(match);
    const ambiguous = unique.length > 1 && unique[0].score - unique[1].score < 0.06;
    return { icon: ambiguous ? null : unique[0] ?? null, ambiguous, candidates: unique.length };
  }
}

