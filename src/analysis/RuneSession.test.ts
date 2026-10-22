import { afterEach, expect, it, vi } from 'vitest';
import { RuneSession } from './RuneSession';
const region = { x: 0, y: 0, width: 0.1, height: 0.1 };
afterEach(() => vi.useRealTimers());
it('uses the selected crop, alerts once in live mode, and stops all polling', () => {
  vi.useFakeTimers(); let timestampMs = 0;
  const source = { read: vi.fn(() => ({ image: { width: 10, height: 10 } as ImageData, timestampMs: timestampMs += 500 })) };
  const detector = { detect: vi.fn(() => ({ x: 0, y: 0, width: 7, height: 7, score: 1 })) };
  const alert = vi.fn(); const session = new RuneSession(source, region, true, vi.fn(), alert, detector);
  session.start(); vi.advanceTimersByTime(3000);
  expect(source.read).toHaveBeenCalledWith(region); expect(alert).toHaveBeenCalledTimes(1);
  session.stop(); const count = source.read.mock.calls.length; vi.advanceTimersByTime(5000);
  expect(source.read).toHaveBeenCalledTimes(count);
});
it('reports a positive image without playing sound or scheduling analysis', () => {
  vi.useFakeTimers(); const alert = vi.fn(), publish = vi.fn();
  const session = new RuneSession({ read: () => ({ image: { width: 10, height: 10 } as ImageData, timestampMs: 0 }) }, region, false, publish, alert, { detect: () => ({ x: 0, y: 0, width: 7, height: 7, score: 1 }) });
  session.start(); expect(publish).toHaveBeenCalledWith({ state: 'present' }); expect(alert).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
