import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, it } from 'vitest';
import { PurpleDiamondDetector } from './runeDetector';
import { RuneTracker } from '../domain/RuneTracker';
const detector = new PurpleDiamondDetector();
it('finds the supplied rune among player markers', () => {
  const image = PNG.sync.read(readFileSync('samples/fixtures/rune-present.png'));
  expect(detector.detect(image)).toMatchObject({ x: 93, y: 41, width: 7, height: 7 });
  // Remove only the labeled rune; the surrounding map and players remain.
  for (let y = 39; y < 50; y++) for (let x = 91; x < 102; x++) image.data.fill(0, (y * image.width + x) * 4, (y * image.width + x) * 4 + 4);
  expect(detector.detect(image)).toBeNull();
});
it('rejects solid purple squares and accepts a scaled diamond', () => {
  const image = { width: 30, height: 30, data: new Uint8ClampedArray(3600) };
  for (let y = 8; y <= 20; y++) for (let x = 8; x <= 20; x++) image.data.set([180, 60, 200, 255], (y * 30 + x) * 4);
  expect(detector.detect(image)).toBeNull();
  for (let y = 8; y <= 20; y++) for (let x = 8; x <= 20; x++) if (Math.abs(x - 14) + Math.abs(y - 14) > 6) image.data.fill(0, (y * 30 + x) * 4, (y * 30 + x) * 4 + 4);
  expect(detector.detect(image)).not.toBeNull();
});
it('alerts once, tolerates occlusion, and rearms only after sustained absence', () => {
  const tracker = new RuneTracker();
  expect(tracker.update(true, 0).alert).toBe(false);
  expect(tracker.update(true, 500).alert).toBe(false);
  expect(tracker.update(true, 1000).alert).toBe(true);
  tracker.update(false, 1500);
  for (const t of [2000, 2500, 3000]) expect(tracker.update(true, t).alert).toBe(false);
  for (const t of [3500, 4000, 4500, 5000, 5500]) tracker.update(false, t);
  tracker.update(true, 6000); tracker.update(true, 6500);
  expect(tracker.update(true, 7000).alert).toBe(true);
});
it('does not treat observations across a suspended tab as consecutive', () => {
  const tracker = new RuneTracker();
  tracker.update(true, 0); tracker.update(true, 500);
  expect(tracker.update(true, 10000).alert).toBe(false);
});
it('rearms after repeated absence even when analysis intervals exceed two seconds', () => {
  const tracker = new RuneTracker();
  tracker.update(true, 0); tracker.update(true, 500);
  expect(tracker.update(true, 1000).alert).toBe(true);
  for (const t of [4000, 7000, 10000, 13000]) expect(tracker.update(false, t).present).toBe(true);
  expect(tracker.update(false, 16000).present).toBe(false);
  tracker.update(true, 19000); tracker.update(true, 19500);
  expect(tracker.update(true, 20000).alert).toBe(true);
});
it('does not clear presence from one delayed absence or accumulated intermittent misses', () => {
  const tracker = new RuneTracker();
  tracker.update(true, 0); tracker.update(true, 500); tracker.update(true, 1000);
  expect(tracker.update(false, 61000).present).toBe(true);
  tracker.update(false, 64000); tracker.update(false, 67000); tracker.update(false, 70000);
  tracker.update(true, 73000);
  expect(tracker.update(false, 76000).present).toBe(true);
});
