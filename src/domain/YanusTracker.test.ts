import { expect, it } from 'vitest';
import { YanusTracker } from './YanusTracker';
const value = (seconds: number, confidence = 90) => ({ seconds,confidence,raw:String(seconds),separatorInferred:false });
it('compensates latency by alerting at 13 seconds, but not at 14', () => {
 const t = new YanusTracker();
 t.update(value(15), true, 0);
 expect(t.update(value(14), true, 1000)).toMatchObject({phase:'active',alert:false});
 expect(t.update(value(13), true, 2000).alert).toBe(true);
 expect(t.update(value(12), true, 3000).alert).toBe(false);
 expect(t.update(value(10), true, 5000).alert).toBe(false);
});
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
 expect(t.update(value(10),true,71000).alert).toBe(true);
 expect(t.update(value(9),true,72000)).toMatchObject({cycle:2,alert:false});
});
it('does not let a single false renewal re-arm the alarm', () => {
 const t=new YanusTracker(); t.update(value(11),true,0);t.update(value(10),true,1000);
 t.update(value(79),true,2000);expect(t.update(value(8),true,3000)).toMatchObject({cycle:1,alert:false,alerted:true});
});
it('retains the alert latch through OCR failures and disappearance', () => {
 const t=new YanusTracker();t.update(value(11),true,0);t.update(value(10),true,1000);
 expect(t.update(null,true,2000)).toMatchObject({phase:'uncertain',seconds:9,estimated:true});
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
it('continues the countdown while reacquisition is being confirmed', () => {
 const t=new YanusTracker();t.update(value(15),true,0);t.update(value(14),true,1000);
 expect(t.update(value(5),true,10000)).toMatchObject({phase:'confirming',alert:true,seconds:5});
 expect(t.update(value(4),true,11000)).toMatchObject({cycle:1,alert:false,seconds:4});
});
it('alerts on the clock during missing icons without duplicate alerts on recovery', () => {
 const t = new YanusTracker(); t.update(value(20),true,0); t.update(value(19),true,1000);
 t.update(null,false,2000); t.update(null,false,4000); t.update(null,false,5000);
 expect(t.tick(6000)).toMatchObject({seconds:14,alert:false,estimated:true});
 expect(t.tick(7000)).toMatchObject({seconds:13,alert:true});
 expect(t.tick(10000)).toMatchObject({seconds:10,alert:false});
 t.update(value(10),true,10000);
 expect(t.update(value(9),true,11000)).toMatchObject({seconds:9,cycle:1,alert:false,estimated:false});
 expect(t.tick(30000)).toMatchObject({seconds:0,alert:false});
});
it('does not invent a countdown from an unconfirmed first reading', () => {
 const t = new YanusTracker(); t.update(value(20),true,0);
 expect(t.tick(7000)).toMatchObject({seconds:null,alert:false});
});
it('recognizes a renewal relative to elapsed time, even below the old reading', () => {
 const t = new YanusTracker(); t.update(value(60),true,0);t.update(value(59),true,1000);
 expect(t.tick(47000).alert).toBe(true);
 t.update(value(50),true,48000);
 expect(t.update(value(49),true,49000)).toMatchObject({cycle:2,seconds:49,alerted:false});
 expect(t.tick(85000)).toMatchObject({seconds:13,alert:true});
});
