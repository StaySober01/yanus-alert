import { readFileSync, existsSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, it } from 'vitest';
import { YanusLocator } from './yanusLocator';
const locator = new YanusLocator(PNG.sync.read(readFileSync('public/templates/sol-yanus.png')));
it.each(['11','10','9','before','after','absent'])('new sample %s', name => {
  const result = locator.locate(PNG.sync.read(readFileSync(`samples/fixtures/buffs-${name}.png`)));
  if (name === 'absent') expect(result.icon).toBeNull(); else expect(result.icon).not.toBeNull();
});
for (const [name,x,y] of [['11',1042,5],['10',1043,5],['9',1040,6],['before',1042,4],['after',1001,5],['absent',0,0]] as const) {
  const path=`samples/private/yanus-${name}.png`;
  it.skipIf(!existsSync(path))(`full-screen private sample ${name}`, () => {
  const result=locator.locate(PNG.sync.read(readFileSync(path)));
  if(name==='absent') expect(result.icon).toBeNull(); else expect(result.icon?.bounds).toEqual({x,y,width:18,height:20});
  });
}
