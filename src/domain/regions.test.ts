import { expect, it } from 'vitest';
import { pixelRegion, regionFromPoints, validRegion } from './regions';
import { parseSettings } from '../settings/storage';
it('supports reverse drags and clamps outside the frame', () => {
  expect(regionFromPoints({ x: 0.8, y: 0.9 }, { x: -0.2, y: 0.1 })).toEqual({ x: 0, y: 0.1, width: 0.8, height: 0.8 });
});
it('preserves proportional position across resolutions', () => {
  const r = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
  expect(pixelRegion(r, 1920, 1080)).toEqual({ x: 480, y: 270, width: 960, height: 540 });
  expect(pixelRegion(r, 1280, 720)).toEqual({ x: 320, y: 180, width: 640, height: 360 });
});
it('keeps fractional edge crops inside the source', () => {
  const crop = pixelRegion({ x: 0.999, y: 0.999, width: 0.001, height: 0.001 }, 1920, 1080);
  expect(crop.x + crop.width).toBe(1920); expect(crop.y + crop.height).toBe(1080);
});
it('rejects empty, nonfinite and out of frame regions', () => {
  for (const r of [null, {}, { x: 0, y: 0, width: 0, height: 1 }, { x: 0.9, y: 0, width: 0.2, height: 1 }, { x: NaN, y: 0, width: 1, height: 1 }]) expect(validRegion(r)).toBe(false);
});
it('recovers malformed and unsupported settings', () => {
  for (const raw of ['{', 'null', '{"version":2}']) expect(parseSettings(raw).regions).toEqual({ yanus: null, rune: null });
});
it('restores valid properties and bounds volume', () => {
  const s = parseSettings(JSON.stringify({ version: 1, regions: { yanus: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }, rune: { x: -1 } }, enabled: { yanus: false, rune: 'yes' }, volume: 8 }));
  expect(s.regions.yanus?.x).toBe(0.1); expect(s.regions.rune).toBeNull(); expect(s.enabled).toEqual({ yanus: false, rune: true }); expect(s.volume).toBe(1);
});
