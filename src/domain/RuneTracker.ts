export class RuneTracker {
  private present = false;
  private count = 0;
  private since = 0;
  private previous: boolean | null = null;
  private lastTime = -Infinity;
  update(found: boolean, now: number) {
    // Slow sampling must not keep the first rune latched forever. Absence
    // still needs five actual observations; elapsed time alone never clears it.
    // Appearance keeps the tighter gap check to avoid stale positive alerts.
    if (found !== this.previous || (found && now - this.lastTime > 2000)) { this.count = 0; this.since = now; }
    this.previous = found; this.lastTime = now; this.count++;
    let alert = false;
    if (found && !this.present && this.count >= 3 && now - this.since >= 800) { this.present = true; alert = true; }
    if (!found && this.present && this.count >= 5 && now - this.since >= 2000) this.present = false;
    return { present: this.present, confirming: found !== this.present, alert };
  }
}
