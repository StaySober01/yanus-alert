import { expect, it } from 'vitest';
import { parseSettings } from './storage';
it('restores a custom threshold and migrates old settings without losing preferences', () => {
  expect(parseSettings(JSON.stringify({ version: 1, yanusAlertSeconds: 25 })).yanusAlertSeconds).toBe(25);
  expect(parseSettings(JSON.stringify({ version: 1, volume: 0.7, enabled: { rune: false } }))).toMatchObject({ volume: 0.7, enabled: { rune: false }, yanusAlertSeconds: 13 });
  for (const invalid of [0, 121, 1.5, '20', null]) expect(parseSettings(JSON.stringify({ version: 1, yanusAlertSeconds: invalid })).yanusAlertSeconds).toBe(13);
});
