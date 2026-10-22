export interface TimerReading { seconds: number; confidence: number; raw: string; separatorInferred: boolean }
/** Reject unrestricted integers and malformed m:ss, rather than guessing missing digits. */
export function parseTimer(raw: string, confidence: number, wideLayout = false): TimerReading | null {
  if (!Number.isFinite(confidence) || confidence < 40) return null;
  const text = raw.trim();
  let seconds: number, separatorInferred = false;
  if (/^\d{1,2}$/.test(text) && !wideLayout) {
    seconds = Number(text);
    if (seconds > 59) return null;
  } else {
    const exact = /^(\d):([0-5]\d)$/.exec(text);
    // At reduced resolution the colon can vanish or become a space. Require a wide footprint and stronger score.
    const inferred = wideLayout && confidence >= 55 ? /^(\d)\s*([0-5]\d)$/.exec(text) : null;
    const match = exact ?? inferred;
    if (!match) return null;
    seconds = Number(match[1]) * 60 + Number(match[2]); separatorInferred = !exact;
  }
  return { seconds, confidence, raw: text, separatorInferred };
}
