export type AlertKind = 'yanus' | 'rune';
export interface AlertSound { id: string; kind: AlertKind; label: string; file: string }
// Add MP3s under public/audio and register them here to extend the selectors.
// Keep IDs stable so saved selections survive label/file changes.
export const ALERT_SOUNDS: readonly AlertSound[] = [
  { id: 'yanus', kind: 'yanus', label: '야누스 10초 남았어요', file: 'audio/yanus.mp3' },
  { id: 'yanus-disappearing', kind: 'yanus', label: '야누스가 사라져', file: 'audio/yanus-disappearing.mp3' },
  { id: 'rune', kind: 'rune', label: '룬 나왔어요', file: 'audio/rune.mp3' },
];
export const DEFAULT_SOUNDS: Record<AlertKind, string> = { yanus: 'yanus', rune: 'rune' };
export function resolveSound(kind: AlertKind, id?: string): AlertSound {
  return ALERT_SOUNDS.find(sound => sound.kind === kind && sound.id === id)
    ?? ALERT_SOUNDS.find(sound => sound.id === DEFAULT_SOUNDS[kind])!;
}
