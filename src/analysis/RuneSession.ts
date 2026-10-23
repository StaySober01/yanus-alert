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
  private lastCheckAt: number | null = null;
  constructor(private source: FrameSource, private region: Region, private live: boolean, private publish: (s: RuneStatus) => void, private alert: () => void, private detector: RuneDetector = new PurpleDiamondDetector(), private snapshot?: (image: ImageData, found: boolean, hidden: boolean, at: number, time: string) => void) {}
  start() { this.read(); }
  stop() { this.stopped = true; clearTimeout(this.timer); }
  private read = () => {
    if (this.stopped) return;
    const now = performance.now();
    const diagnostic = {
      시간: new Date().toISOString(),
      간격초: this.lastCheckAt === null ? null : Number(((now - this.lastCheckAt) / 1000).toFixed(3)),
      백그라운드: typeof document !== 'undefined' ? document.visibilityState === 'hidden' : null,
      프레임읽음: false,
      룬검출: null as boolean | null,
      상태: '프레임 대기',
      알림요청: false,
      오류: null as string | null,
    };
    this.lastCheckAt = now;
    try {
      const frame = this.source.read(this.region);
      if (frame) {
        diagnostic.프레임읽음 = true;
        if (frame.image.width * frame.image.height > 1000000) throw new Error('미니맵 영역이 너무 큽니다. 지도 부분만 지정해 주세요.');
        const found = !!this.detector.detect(frame.image);
        diagnostic.룬검출 = found;
        const result = this.live ? this.tracker.update(found, frame.timestampMs) : { present: found, confirming: false, alert: false };
        diagnostic.상태 = result.confirming ? 'confirming' : result.present ? 'present' : 'absent';
        diagnostic.알림요청 = result.alert && !this.stopped;
        this.publish({ state: result.confirming ? 'confirming' : result.present ? 'present' : 'absent' });
        if (result.alert && !this.stopped) this.alert();
        // Use exactly the pixels supplied to the detector, not a second video read.
        if (!this.stopped) this.snapshot?.(frame.image, found, diagnostic.백그라운드 === true, now, diagnostic.시간);
      }
      if (this.live && !this.stopped) this.timer = setTimeout(this.read, 500);
    } catch (error) {
      diagnostic.오류 = error instanceof Error ? error.message : '룬 분석 실패';
      diagnostic.상태 = 'error';
      this.publish({ state: 'error', error: diagnostic.오류 }); this.stop();
    } finally {
      // Log scalar snapshots only; never include captured image data.
      console.info('[룬 검사]', JSON.stringify({ ...diagnostic, 처리시간ms: Math.round(performance.now() - now) }));
    }
  };
}
