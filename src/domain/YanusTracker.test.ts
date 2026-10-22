import { expect, it } from 'vitest';
import { YanusTracker } from './YanusTracker';
const value = (seconds: number, confidence = 90) => ({ seconds,confidence,raw:String(seconds),separatorInferred:false });
it('confirms 11→10 and alerts only once through 10→9→5', () => {
 const t=new YanusTracker(); expect(t.update(value(11),true,0).alert).toBe(false);
 expect(t.update(value(10),true,1000)).toMatchObject({seconds:10,cycle:1,alert:true});
 expect(t.update(value(10),true,1500).alert).toBe(false); expect(t.update(value(9),true,2000).alert).toBe(false);
 expect(t.update(value(5),true,6000).alert).toBe(false);
});
it('requires consecutive observations for initial low time and renewal', () => {
 const t=new YanusTracker(); expect(t.update(value(9),true,0).alert).toBe(false);
 expect(t.update(value(8),true,1000).alert).toBe(true);
 expect(t.update(value(79),true,2000)).toMatchObject({phase:'renewing',cycle:1,alert:false});
 expect(t.update(value(78),true,3000)).toMatchObject({phase:'active',cycle:2,alerted:false});
 expect(t.update(value(10),true,71000).alert).toBe(false);
 expect(t.update(value(9),true,72000)).toMatchObject({cycle:2,alert:true});
});
it('does not let a single false renewal re-arm the alarm', () => {
 const t=new YanusTracker(); t.update(value(11),true,0);t.update(value(10),true,1000);
 t.update(value(79),true,2000);expect(t.update(value(8),true,3000)).toMatchObject({cycle:1,alert:false,alerted:true});
});
it('retains the alert latch through OCR failures and disappearance', () => {
 const t=new YanusTracker();t.update(value(11),true,0);t.update(value(10),true,1000);
 expect(t.update(null,true,2000)).toMatchObject({phase:'uncertain',seconds:null});
 t.update(null,false,3000);t.update(null,false,4000);
 expect(t.update(null,false,6000)).toMatchObject({phase:'absent',alerted:true});
 t.update(value(5),true,7000); expect(t.update(value(4),true,8000).alert).toBe(false);
});
it('rejects low confidence, stale order, and zero-time alerts', () => {
 const t=new YanusTracker();t.update(value(11),true,1000);
 expect(t.update(value(10,10),true,2000).alert).toBe(false);
 expect(t.update(value(10),true,900).alert).toBe(false);
 t.update(value(0),true,3000);expect(t.update(value(0),true,3500).alert).toBe(false);
});
it('reconfirms after a long sampling pause rather than extrapolating an alarm', () => {
 const t=new YanusTracker();t.update(value(15),true,0);t.update(value(14),true,1000);
 expect(t.update(value(9),true,10000)).toMatchObject({phase:'confirming',alert:false});
 expect(t.update(value(8),true,11000).alert).toBe(true);
});
