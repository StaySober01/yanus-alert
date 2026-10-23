import { expect, it } from 'vitest';
import { RuneSnapshots } from './RuneSnapshots';
const pixels = () => ({ width: 1, height: 1, colorSpace: 'srgb', data: new Uint8ClampedArray([120, 30, 140, 255]) } as ImageData);
it('copies detector pixels, bounds history, and preserves it after returning', () => {
  const buffer = new RuneSnapshots(); const input = pixels();
  buffer.add(input, false, true, 0, 'first'); input.data[0] = 0;
  expect(buffer.items[0].image.data[0]).toBe(120);
  expect(buffer.add(input, false, true, 1000, 'skip')).toBe(false);
  for (let i = 1; i <= 15; i++) buffer.add(input, false, true, i * 5000, String(i));
  expect(buffer.items).toHaveLength(10);
  buffer.add(input, true, false, 75100, 'return');
  expect(buffer.items.at(-1)).toMatchObject({ returned: true, found: true });
  expect(buffer.add(input, true, false, 90000, 'foreground')).toBe(false);
  expect(buffer.items).toHaveLength(10);
  buffer.clear(); expect(buffer.items).toHaveLength(0);
  expect(buffer.add(input, false, false, 91000, 'new')).toBe(true);
});
