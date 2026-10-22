import { readFileSync, existsSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, it } from 'vitest';
import { YanusLocator, type Pixels } from './yanusLocator';

const png = (path: string): Pixels => PNG.sync.read(readFileSync(path));
const template = png('public/templates/sol-yanus.png');
const locator = new YanusLocator(template);
const buffs = png('samples/fixtures/buffs-47.png');
function blank(width: number, height: number): Pixels { return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(35) }; }
function paste(target: Pixels, source: Pixels, x: number, y: number) {
  for (let row = 0; row < source.height; row++) target.data.set(source.data.subarray(row * source.width * 4, (row + 1) * source.width * 4), ((y + row) * target.width + x) * 4);
}
it('locates the labeled icon among adjacent buffs without reading the 47 label', () => {
  const result = locator.locate(buffs);
  expect(result.icon?.bounds).toEqual({ x: 133, y: 3, width: 29, height: 32 });
  expect(result.icon!.score).toBeGreaterThan(0.85);
});
it('searches beyond the top right and does not hardcode a screen location', () => {
  const moved = blank(900, 400); paste(moved, buffs, 42, 210);
  expect(locator.locate(moved).icon?.bounds).toEqual({ x: 175, y: 213, width: 29, height: 32 });
});
it('does not accept the unnumbered reference or the real skill hotbar', () => {
  expect(locator.locate(template).icon).toBeNull();
  expect(locator.locate(png('samples/fixtures/hotbar.png')).icon).toBeNull();
});
it('does not hallucinate a result on a blank frame', () => { expect(locator.locate(blank(320, 180)).icon).toBeNull(); });
it('rejects the same buff strip after the labeled icon is removed', () => {
  const missing = { ...buffs, data: new Uint8ClampedArray(buffs.data) };
  paste(missing, blank(29, 32), 133, 3);
  expect(locator.locate(missing).icon).toBeNull();
});
it('finds a synthetic 2x UI scale without changing the reference', () => {
  const scaled = blank(buffs.width * 2, buffs.height * 2);
  for (let y = 0; y < scaled.height; y++) for (let x = 0; x < scaled.width; x++) {
    const index = (Math.floor(y / 2) * buffs.width + Math.floor(x / 2)) * 4;
    scaled.data.set(buffs.data.subarray(index, index + 4), (y * scaled.width + x) * 4);
  }
  const bounds = locator.locate(scaled).icon?.bounds;
  expect(bounds?.width).toBe(58); expect(Math.abs(bounds!.x - 266)).toBeLessThanOrEqual(1); expect(Math.abs(bounds!.y - 6)).toBeLessThanOrEqual(1);
});
it('reports ambiguity when two equally good icons are present', () => {
  const duplicate = blank(900, 250); paste(duplicate, buffs, 0, 0); paste(duplicate, buffs, 450, 150);
  const result = locator.locate(duplicate); expect(result.ambiguous).toBe(true); expect(result.icon).toBeNull();
});
it.skipIf(!existsSync('samples/private/yanus-47.png'))('locates the original full screenshot (private local fixture)', () => {
  const result = locator.locate(png('samples/private/yanus-47.png'));
  expect(result.icon?.bounds).toEqual({ x: 1631, y: 3, width: 29, height: 32 });
}, 30000);
