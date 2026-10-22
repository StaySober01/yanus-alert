import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { YanusSession } from './YanusSession';
import type { TimerReader } from './LocalTimerReader';

class FakeWorker {
  static current: FakeWorker;
  onmessage: ((event: { data: unknown }) => void | Promise<void>) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { FakeWorker.current = this; }
}
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('Worker', FakeWorker); vi.stubGlobal('window', { location: { href: 'http://localhost:5173/' } }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function setup(continuous = true) {
  const read = vi.fn(() => ({ image: { width: 100, height: 100, data: new Uint8ClampedArray(40000), colorSpace: 'srgb' } as ImageData, timestampMs: 0 }));
  const publish = vi.fn(); const session = new YanusSession({ read }, continuous, publish); session.start();
  return { session, publish, read, worker: FakeWorker.current };
}
it('waits for completion before scheduling another frame', () => {
  const { session, read, worker, publish } = setup(); vi.advanceTimersByTime(10000); expect(read).toHaveBeenCalledTimes(1);
  worker.onmessage!({ data: { id: 1, result: { icon: { bounds: { x: 10, y: 20, width: 29, height: 32 }, score: 0.9 }, ambiguous: false, candidates: 1 }, durationMs: 50 } });
  expect(publish.mock.lastCall![0]).toMatchObject({ state: 'found', region: { x: 0.1, y: 0.2, width: 0.29, height: 0.32 }, score: 0.9, durationMs: 50 });
  vi.advanceTimersByTime(1000); expect(read).toHaveBeenCalledTimes(2); session.stop();
});
it('terminates work and ignores late replies after stop', () => {
  const { session, publish, read, worker } = setup(); session.stop();
  worker.onmessage!({ data: { id: 1, result: { icon: null, ambiguous: false, candidates: 0 } } });
  vi.advanceTimersByTime(10000); expect(worker.terminate).toHaveBeenCalledOnce(); expect(read).toHaveBeenCalledOnce(); expect(publish).toHaveBeenCalledOnce();
});
it('analyzes still images only once', () => {
  const { session, read, worker } = setup(false);
  worker.onmessage!({ data: { id: 1, result: { icon: null, ambiguous: false, candidates: 0 } } });
  vi.advanceTimersByTime(10000); expect(read).toHaveBeenCalledOnce(); session.stop();
});
it('surfaces worker errors and stops scheduling', () => {
  const { session, read, worker, publish } = setup();
  worker.onmessage!({ data: { id: 1, error: 'template missing' } });
  expect(publish).toHaveBeenLastCalledWith({ state: 'error', region: null, error: 'template missing' });
  vi.advanceTimersByTime(10000); expect(read).toHaveBeenCalledOnce(); expect(worker.terminate).toHaveBeenCalledOnce(); session.stop();
});
it('connects confirmed 11→10→9 to exactly one live alert', async () => {
  const alert=vi.fn(),publish=vi.fn(); let seconds=11;
  const reader: TimerReader={read:vi.fn(async()=>({seconds,confidence:90,raw:String(seconds),separatorInferred:false})),close:vi.fn()};
  const source={read:()=>({image:{width:100,height:100,data:new Uint8ClampedArray(40000),colorSpace:'srgb'} as ImageData,timestampMs:performance.now()})};
  const session=new YanusSession(source,true,publish,alert,reader);session.start();const worker=FakeWorker.current;
  const reply=(id:number)=>worker.onmessage!({data:{id,result:{icon:{bounds:{x:0,y:0,width:29,height:32},score:0.9},ambiguous:false,candidates:1},timer:{width:1,height:1,data:new Uint8ClampedArray(4)}}});
  await reply(1);expect(alert).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1000);seconds=10;await reply(2);expect(alert).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(1000);seconds=9;await reply(3);expect(alert).toHaveBeenCalledOnce();
  session.stop();expect(reader.close).toHaveBeenCalledOnce();
});
it('drops an OCR result that arrives after stop', async () => {
  let resolve!: (value: null)=>void;const alert=vi.fn(),publish=vi.fn();
  const reader:TimerReader={read:()=>new Promise(r=>{resolve=r;}),close:vi.fn()};
  const source={read:()=>({image:{width:100,height:100,data:new Uint8ClampedArray(40000),colorSpace:'srgb'}as ImageData,timestampMs:performance.now()})};
  const session=new YanusSession(source,true,publish,alert,reader);session.start();
  const pending=FakeWorker.current.onmessage!({data:{id:1,result:{icon:{bounds:{x:0,y:0,width:29,height:32},score:0.9},ambiguous:false,candidates:1},timer:{width:1,height:1,data:new Uint8ClampedArray(4)}}});
  session.stop();resolve(null);await pending;expect(alert).not.toHaveBeenCalled();expect(publish).toHaveBeenCalledOnce();
});
it('keeps counting and alerts while the next worker result is pending', async () => {
  let seconds = 16;
  const alert = vi.fn(), publish = vi.fn();
  const reader: TimerReader = { read: async () => ({ seconds, confidence: 90, raw: String(seconds), separatorInferred: false }), close: vi.fn() };
  const source = { read: () => ({ image: { width: 100, height: 100, data: new Uint8ClampedArray(40000) } as ImageData, timestampMs: performance.now() }) };
  const session = new YanusSession(source, true, publish, alert, reader); session.start();
  const reply = (id: number) => FakeWorker.current.onmessage!({ data: { id, result: { icon: { bounds: { x: 0, y: 0, width: 29, height: 32 }, score: 0.9 }, ambiguous: false }, timer: { width: 1, height: 1, data: new Uint8ClampedArray(4) } } });
  await reply(1); vi.advanceTimersByTime(1000); seconds = 15; await reply(2);
  vi.advanceTimersByTime(2000);
  expect(alert).toHaveBeenCalledOnce();
  expect(publish.mock.lastCall![0].tracking).toMatchObject({ seconds: 13, estimated: true });
  vi.advanceTimersByTime(3000); expect(alert).toHaveBeenCalledOnce();
  session.stop(); const count = publish.mock.calls.length;
  vi.advanceTimersByTime(5000); expect(publish).toHaveBeenCalledTimes(count);
});
