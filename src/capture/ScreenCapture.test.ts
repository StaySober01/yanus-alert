import { afterEach, expect, it, vi } from 'vitest';
import { ScreenCapture } from './ScreenCapture';
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const track = new EventTarget(); Object.assign(track, { stop: vi.fn() });
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  return { track: track as EventTarget & { stop: ReturnType<typeof vi.fn> }, stream };
}
it('releases a stream returned after stop while picker was open', async () => {
  const { track, stream } = fixture(); let resolve!: (s: MediaStream) => void;
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: () => new Promise<MediaStream>(r => { resolve = r; }) } });
  const capture = new ScreenCapture(); const pending = capture.start(vi.fn()); capture.stop(); resolve(stream);
  expect(await pending).toBeNull(); expect(track.stop).toHaveBeenCalledOnce();
});
it('handles browser termination once and stops tracks', async () => {
  const { track, stream } = fixture();
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: vi.fn().mockResolvedValue(stream) } });
  const capture = new ScreenCapture(); const ended = vi.fn(); await capture.start(ended);
  track.dispatchEvent(new Event('ended')); track.dispatchEvent(new Event('ended'));
  expect(ended).toHaveBeenCalledOnce(); expect(track.stop).toHaveBeenCalledOnce();
});
