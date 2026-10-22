import { validRegion, type Region, type RegionKey } from '../domain/regions';
export interface Settings { version: 1; regions: Record<RegionKey, Region | null>; enabled: Record<RegionKey, boolean>; volume: number }
export const defaultSettings = (): Settings => ({ version: 1, regions: { yanus: null, rune: null }, enabled: { yanus: true, rune: true }, volume: 0.35 });
export const STORAGE_KEY = 'maple-alert.settings.v1';
export function parseSettings(raw: string | null): Settings {
  const result = defaultSettings();
  if (!raw) return result;
  try {
    const s = JSON.parse(raw);
    if (s?.version !== 1) return result;
    for (const key of ['yanus', 'rune'] as const) {
      if (validRegion(s.regions?.[key])) result.regions[key] = s.regions[key];
      if (typeof s.enabled?.[key] === 'boolean') result.enabled[key] = s.enabled[key];
    }
    if (Number.isFinite(s.volume)) result.volume = Math.max(0, Math.min(1, s.volume));
  } catch { /* Invalid saved data falls back to safe defaults. */ }
  return result;
}
export function loadSettings(): Settings { try { return parseSettings(localStorage.getItem(STORAGE_KEY)); } catch { return defaultSettings(); } }
export function saveSettings(settings: Settings): boolean { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); return true; } catch { return false; } }
