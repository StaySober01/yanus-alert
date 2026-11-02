export const DEFAULT_YANUS_ALERT_SECONDS = 13;
export function validAlertSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 120;
}
