import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AlertAudio, ALERT_FILES } from './AlertAudio';
class FakeContext {
  state='running'; destination={};
  resume=vi.fn(async()=>{}); close=vi.fn(async()=>{});
  decodeAudioData=vi.fn(async()=>({} as AudioBuffer));
  created: {stop:ReturnType<typeof vi.fn>; start:ReturnType<typeof vi.fn>; buffer:AudioBuffer|null}[]=[];
  createBufferSource(){const node={buffer:null as AudioBuffer|null,connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null};this.created.push(node);return node;}
  createGain(){return {gain:{value:0},connect:vi.fn(),disconnect:vi.fn()};}
}
let context:FakeContext;
beforeEach(()=>{
 context=new FakeContext();vi.stubGlobal('AudioContext',class{constructor(){return context;}});
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})));
});
afterEach(()=>vi.unstubAllGlobals());
it('keeps zero volume silent and stops the MP3 on stop',async()=>{
 const audio=new AlertAudio();await audio.prepare();await audio.play(0);expect(context.created).toHaveLength(0);expect(fetch).not.toHaveBeenCalled();
 await audio.play(.5);expect(context.created).toHaveLength(1);expect(context.created[0].start).toHaveBeenCalledOnce();audio.stop();expect(context.created[0].stop).toHaveBeenCalledOnce();audio.close();
});
it('loads the assigned file for each alert and caches decoded audio',async()=>{
 const audio=new AlertAudio();await audio.prepare();await audio.play(.5,'yanus');await audio.play(.5,'rune');await audio.play(.5,'yanus');
 expect(fetch).toHaveBeenNthCalledWith(1,ALERT_FILES.yanus);expect(fetch).toHaveBeenNthCalledWith(2,ALERT_FILES.rune);expect(fetch).toHaveBeenCalledTimes(2);expect(context.decodeAudioData).toHaveBeenCalledTimes(2);audio.close();
});
it('does not replay a test if stopped during audio preparation',async()=>{
 let resume!:()=>void;context.resume=vi.fn(()=>new Promise<void>(r=>{resume=r;}));
 const audio=new AlertAudio();const pending=audio.test(.5,'rune');audio.stop();resume();await pending;expect(context.created).toHaveLength(0);audio.close();
});
it('discards decoded MP3 playback after stop',async()=>{
 let decode!:(buffer:AudioBuffer)=>void;context.decodeAudioData=vi.fn(()=>new Promise<AudioBuffer>(r=>{decode=r;}));
 const audio=new AlertAudio();await audio.prepare();const pending=audio.play(.5,'yanus');
 await vi.waitFor(()=>expect(context.decodeAudioData).toHaveBeenCalledOnce());audio.stop();decode({}as AudioBuffer);await pending;expect(context.created).toHaveLength(0);audio.close();
});
it('surfaces missing audio and retries instead of caching failures',async()=>{
 vi.mocked(fetch).mockResolvedValueOnce({ok:false}as Response);
 const audio=new AlertAudio();await audio.prepare();await expect(audio.play(.5,'rune')).rejects.toThrow('룬 알림 파일');await audio.play(.5,'rune');expect(context.created).toHaveLength(1);audio.close();
});
