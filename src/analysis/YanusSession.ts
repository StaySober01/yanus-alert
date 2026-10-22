import type { FrameSource } from './contracts';
import type { Region } from '../domain/regions';
import type { LocateResult, Pixels } from './yanusLocator';
import { LocalTimerReader, type TimerReader } from './LocalTimerReader';
import type { TimerReading } from './timerReading';
import { YanusTracker, type TrackingStatus } from '../domain/YanusTracker';

export interface YanusStatus {
  state: 'idle' | 'searching' | 'found' | 'not-found' | 'ambiguous' | 'error';
  region: Region | null;
  score?: number;
  durationMs?: number;
  error?: string;
  reading?: TimerReading | null;
  tracking?: TrackingStatus;
}
export const IDLE_YANUS: YanusStatus = { state: 'idle', region: null };

/** One request at a time. Worker termination cancels even synchronous matching. */
export class YanusSession {
  private worker: Worker | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private requestId = 0;
  private lastWidth = 0;
  private lastHeight = 0;
  private frameTime = 0;
  private tracker = new YanusTracker();
  private clock: ReturnType<typeof setInterval> | null = null;
  private latest: YanusStatus = { state: 'searching', region: null };
  constructor(private source: FrameSource, private continuous: boolean, private publish: (status: YanusStatus) => void, private onAlert: () => void = () => {}, private reader: TimerReader = new LocalTimerReader()) {}
  start() {
    this.publish({ state: 'searching', region: null });
    if (this.continuous) this.clock = setInterval(() => {
      if (this.stopped) return;
      const tracking = this.tracker.tick(performance.now());
      this.latest = { ...this.latest, tracking };
      this.publish(this.latest);
      if (tracking.alert && !this.stopped) this.onAlert();
    }, 250);
    try {
      this.worker = new Worker(new URL('./yanus.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = async (event: MessageEvent<{ id: number; result?: LocateResult; durationMs?: number; error?: string; timer?: Pixels | null; wideLayout?: boolean }>) => {
        if (this.stopped || event.data.id !== this.requestId) return;
        const { result, durationMs, error } = event.data;
        if (error || !result) { this.fail(error ?? '잘못된 탐색 응답입니다.'); return; }
        const bounds = result.icon?.bounds;
        let reading: TimerReading | null = null;
        try {
          if (event.data.timer && bounds) reading = await this.reader.read(event.data.timer, event.data.wideLayout ?? false);
        } catch (error) { if (!this.stopped) this.fail(error instanceof Error ? error.message : '시간 판독에 실패했습니다.'); return; }
        if (this.stopped) return;
        // Late OCR must not produce an alert from an obsolete frame.
        if (this.continuous && performance.now() - this.frameTime > 5000) reading = null;
        const tracking = this.continuous ? this.tracker.update(reading, !!bounds || result.ambiguous, this.frameTime) : undefined;
        this.latest = { state: result.ambiguous ? 'ambiguous' : bounds ? 'found' : 'not-found', region: bounds ? { x: bounds.x / this.lastWidth, y: bounds.y / this.lastHeight, width: bounds.width / this.lastWidth, height: bounds.height / this.lastHeight } : null, score: result.icon?.score, durationMs, reading, tracking };
        this.publish(this.latest);
        if (tracking?.alert && !this.stopped) this.onAlert();
        if (this.continuous) this.timer = setTimeout(() => this.read(), 1000);
      };
      this.worker.onerror = () => this.fail('분석 작업을 시작하지 못했습니다. 브라우저와 기준 이미지 경로를 확인해 주세요.');
      this.read();
    } catch (error) { this.fail(error instanceof Error ? error.message : '분석 작업을 시작하지 못했습니다.'); }
  }
  private read() {
    if (this.stopped) return;
    try {
      const frame = this.source.read();
      if (!frame) { this.timer = setTimeout(() => this.read(), 250); return; }
      const { width, height, data } = frame.image;
      // Explicit bound, rather than quietly downsampling away small UI details.
      if (width * height > 3840 * 2160) { this.fail('현재 자동 탐색은 최대 3840 × 2160 픽셀 수의 입력을 지원합니다. 더 작은 게임 창을 공유해 주세요.'); return; }
      this.lastWidth = width; this.lastHeight = height;
      this.frameTime = frame.timestampMs;
      this.worker!.postMessage({ id: ++this.requestId, width, height, buffer: data.buffer, templateUrl: new URL(`${import.meta.env.BASE_URL}templates/sol-yanus.png`, window.location.href).href }, [data.buffer]);
    } catch (error) { this.fail(error instanceof Error ? error.message : '화면을 읽지 못했습니다.'); }
  }
  private fail(error: string) { if (!this.stopped) this.publish({ state: 'error', region: null, error }); this.stop(); }
  stop() { this.stopped = true; if (this.clock !== null) clearInterval(this.clock); if (this.timer !== null) clearTimeout(this.timer); this.worker?.terminate(); this.worker = null; this.reader.close(); }
}
