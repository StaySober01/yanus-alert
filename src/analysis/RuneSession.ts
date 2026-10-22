import type { FrameSource } from './contracts';
import type { Region } from '../domain/regions';
import { PurpleDiamondDetector, type RuneDetector } from './runeDetector';
import { RuneTracker } from '../domain/RuneTracker';
export interface RuneStatus { state: 'idle' | 'absent' | 'confirming' | 'present' | 'error'; error?: string }
export const IDLE_RUNE: RuneStatus = { state: 'idle' };
export class RuneSession {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private tracker = new RuneTracker();
  constructor(private source: FrameSource, private region: Region, private live: boolean, private publish: (s: RuneStatus) => void, private alert: () => void, private detector: RuneDetector = new PurpleDiamondDetector()) {}
  start() { this.read(); }
  stop() { this.stopped = true; clearTimeout(this.timer); }
  private read = () => {
    if (this.stopped) return;
    try {
      const frame = this.source.read(this.region);
      if (frame) {
        if (frame.image.width * frame.image.height > 1000000) throw new Error('미니맵 영역이 너무 큽니다. 지도 부분만 지정해 주세요.');
        const found = !!this.detector.detect(frame.image);
        const result = this.live ? this.tracker.update(found, frame.timestampMs) : { present: found, confirming: false, alert: false };
        this.publish({ state: result.confirming ? 'confirming' : result.present ? 'present' : 'absent' });
        if (result.alert && !this.stopped) this.alert();
      }
      if (this.live && !this.stopped) this.timer = setTimeout(this.read, 500);
    } catch (error) { this.publish({ state: 'error', error: error instanceof Error ? error.message : '룬 분석 실패' }); this.stop(); }
  };
}
