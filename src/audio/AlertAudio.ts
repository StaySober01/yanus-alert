import { resolveSound, type AlertKind, type AlertSound } from './sounds';
export type { AlertKind } from './sounds';
export const ALERT_FILES: Record<AlertKind, string> = {
  yanus: `${import.meta.env.BASE_URL}${resolveSound('yanus').file}`,
  rune: `${import.meta.env.BASE_URL}${resolveSound('rune').file}`,
};

export class AlertAudio {
  private context: AudioContext | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private generation = 0;
  async prepare() { this.context ??= new AudioContext(); await this.context.resume(); }
  async test(volume: number, kind: AlertKind = 'yanus', soundId?: string) {
    const generation = this.generation;
    await this.prepare();
    if (generation === this.generation) await this.play(volume, kind, soundId);
  }
  private load(sound: AlertSound, context: AudioContext): Promise<AudioBuffer> {
    const kind = sound.id;
    const cached = this.buffers.get(kind);
    if (cached) return cached;
    const pending = fetch(`${import.meta.env.BASE_URL}${sound.file}`).then(async response => {
      if (!response.ok) throw new Error(`${sound.kind === 'yanus' ? '야누스' : '룬'} 알림 파일을 불러오지 못했습니다.`);
      return context.decodeAudioData(await response.arrayBuffer());
    }).catch(error => {
      if (this.buffers.get(kind) === pending) this.buffers.delete(kind);
      throw error;
    });
    this.buffers.set(kind, pending);
    return pending;
  }
  async play(volume: number, kind: AlertKind = 'yanus', soundId?: string) {
    if (!Number.isFinite(volume) || volume <= 0) return;
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running') throw new Error('알림음 테스트를 눌러 브라우저 오디오를 활성화해 주세요.');
    const generation = this.generation;
    const buffer = await this.load(resolveSound(kind, soundId), ctx);
    // Loading/decoding can finish after stop, OFF, or a closed session.
    if (generation !== this.generation || ctx !== this.context) return;
    if (ctx.state !== 'running') throw new Error('알림음 테스트로 오디오를 다시 활성화해 주세요.');
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = Math.min(1, volume);
    source.connect(gain); gain.connect(ctx.destination); this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); gain.disconnect(); };
    source.start();
  }
  stop() {
    this.generation++;
    for (const source of this.sources) { try { source.stop(); } catch { /* Already ended. */ } }
    this.sources.clear();
  }
  close() { this.stop(); this.buffers.clear(); void this.context?.close().catch(() => {}); this.context = null; }
}
