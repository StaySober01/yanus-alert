export type RegionKey = 'yanus' | 'rune';
export interface Point { x: number; y: number }
export interface Region extends Point { width: number; height: number }
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export function regionFromPoints(a: Point, b: Point): Region {
  return { x: Math.min(clamp(a.x), clamp(b.x)), y: Math.min(clamp(a.y), clamp(b.y)), width: Math.abs(clamp(a.x) - clamp(b.x)), height: Math.abs(clamp(a.y) - clamp(b.y)) };
}
export function validRegion(value: unknown): value is Region {
  if (!value || typeof value !== 'object') return false;
  const r = value as Region;
  return [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0 && r.x + r.width <= 1.000001 && r.y + r.height <= 1.000001;
}
export function pixelRegion(r: Region, width: number, height: number): Region {
  const x = Math.min(width - 1, Math.floor(r.x * width));
  const y = Math.min(height - 1, Math.floor(r.y * height));
  return { x, y, width: Math.min(width - x, Math.max(1, Math.ceil((r.x + r.width) * width) - x)), height: Math.min(height - y, Math.max(1, Math.ceil((r.y + r.height) * height) - y)) };
}
