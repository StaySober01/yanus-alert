export class RuneTracker {
  private present = false;
  private count = 0;
  private since = 0;
  private previous: boolean | null = null;
  private lastTime = -Infinity;
  update(found: boolean, now: number) {
    // Count actual observations, not timer punctuality: background scheduling
    // can delay both appearance and absence samples. Never infer either from time alone.
    if (!Number.isFinite(now) || now <= this.lastTime) return { present: this.present, confirming: this.previous !== null && this.previous !== this.present, alert: false };
    if (found !== this.previous) { this.count = 0; this.since = now; }
    this.previous = found; this.lastTime = now; this.count++;
    let alert = false;
    if (found && !this.present && this.count >= 3 && now - this.since >= 800) { this.present = true; alert = true; }
    if (!found && this.present && this.count >= 5 && now - this.since >= 2000) this.present = false;
    return { present: this.present, confirming: found !== this.present, alert };
  }
}
