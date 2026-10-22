export type AlertKind = 'yanus' | 'rune';
export const ALERT_FILES: Record<AlertKind, string> = {
  yanus: `${import.meta.env.BASE_URL}audio/yanus.mp3`,
  rune: `${import.meta.env.BASE_URL}audio/rune.mp3`,
};

export class AlertAudio {
  private context: AudioContext | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private buffers = new Map<AlertKind, Promise<AudioBuffer>>();
  private generation = 0;
  async prepare() { this.context ??= new AudioContext(); await this.context.resume(); }
  async test(volume: number, kind: AlertKind = 'yanus') {
    const generation = this.generation;
    await this.prepare();
    if (generation === this.generation) await this.play(volume, kind);
  }
  private load(kind: AlertKind, context: AudioContext): Promise<AudioBuffer> {
    const cached = this.buffers.get(kind);
    if (cached) return cached;
    const pending = fetch(ALERT_FILES[kind]).then(async response => {
      if (!response.ok) throw new Error(`${kind === 'yanus' ? '야누스' : '룬'} 알림 파일을 불러오지 못했습니다.`);
      return context.decodeAudioData(await response.arrayBuffer());
    }).catch(error => {
      if (this.buffers.get(kind) === pending) this.buffers.delete(kind);
      throw error;
    });
    this.buffers.set(kind, pending);
    return pending;
  }
  async play(volume: number, kind: AlertKind = 'yanus') {
    if (!Number.isFinite(volume) || volume <= 0) return;
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running') throw new Error('알림음 테스트를 눌러 브라우저 오디오를 활성화해 주세요.');
    const generation = this.generation;
    const buffer = await this.load(kind, ctx);
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
