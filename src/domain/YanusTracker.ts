import type { TimerReading } from '../analysis/timerReading';
export type TrackingPhase = 'confirming' | 'active' | 'renewing' | 'uncertain' | 'absent';
export interface TrackingStatus { phase: TrackingPhase; seconds: number | null; cycle: number; alerted: boolean; alert: boolean; estimated: boolean }
interface TimedReading { seconds: number; at: number }
/** Confirmed readings anchor a monotonic countdown, independent of OCR completion. */
export class YanusTracker {
  private last: TimedReading | null = null;
  private candidate: TimedReading | null = null;
  private missingSince: number | null = null;
  private misses = 0;
  private cycle = 0;
  private alerted = false;
  private lastTimestamp = -Infinity;
  private phase: TrackingPhase = 'confirming';
  private remaining(at: number) {
    return this.last ? Math.max(0, this.last.seconds - Math.max(0, at - this.last.at) / 1000) : null;
  }
  tick(at: number): TrackingStatus {
    const remaining = Number.isFinite(at) ? this.remaining(at) : null;
    const seconds = remaining === null ? null : Math.ceil(remaining);
    const alert = !this.alerted && seconds !== null && seconds > 0 && seconds <= 13;
    if (alert) this.alerted = true;
    return { phase: this.phase, seconds, cycle: this.cycle, alerted: this.alerted, alert, estimated: this.last !== null && at !== this.last.at };
  }
  private consistent(previous: TimedReading, next: TimedReading) {
    const elapsed = (next.at - previous.at) / 1000;
    return elapsed >= 0.2 && elapsed <= 4 && next.seconds <= previous.seconds && Math.abs((previous.seconds - next.seconds) - elapsed) <= 1.5;
  }
  update(reading: TimerReading | null, iconPresent: boolean, at: number): TrackingStatus {
    const status = () => this.tick(at);
    if (!Number.isFinite(at) || at <= this.lastTimestamp) return { phase: this.phase, seconds: null, cycle: this.cycle, alerted: this.alerted, alert: false, estimated: false };
    this.lastTimestamp = at;
    if (!iconPresent) {
      this.missingSince ??= at; this.misses++; this.candidate = null;
      this.phase = this.misses >= 3 && at - this.missingSince >= 3000 ? 'absent' : 'uncertain';
      // Retain the cycle latch through disappearance/occlusion to avoid duplicate low-time alerts.
      return status();
    }
    this.missingSince = null; this.misses = 0;
    if (!reading || reading.confidence < 40 || !Number.isInteger(reading.seconds) || reading.seconds < 0 || reading.seconds > 599) {
      this.candidate = null; this.phase = 'uncertain'; return status();
    }
    const next = { seconds: reading.seconds, at };
    const renewal = this.last !== null && next.seconds > this.remaining(at)! + 3;
    const followsLast = this.last !== null && this.consistent(this.last, next);
    if (!followsLast) {
      this.phase = renewal ? 'renewing' : 'confirming';
      const followsCandidate = this.candidate !== null && this.consistent(this.candidate, next);
      if (!followsCandidate) { this.candidate = next; return status(); }
      if (renewal || this.cycle === 0) { this.cycle++; this.alerted = false; }
    }
    this.candidate = null; this.last = next; this.phase = 'active';
    return status();
  }
}
