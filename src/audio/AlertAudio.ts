export class AlertAudio {
  private context: AudioContext | null = null;
  async test(volume: number) {
    this.context ??= new AudioContext();
    const ctx = this.context;
    await ctx.resume();
    for (const [offset, frequency] of [[0, 660], [0.2, 880]]) {
      const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, ctx.currentTime + offset);
      gain.gain.linearRampToValueAtTime(volume * 0.25, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.18);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(ctx.currentTime + offset); oscillator.stop(ctx.currentTime + offset + 0.2);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
  }
  close() { void this.context?.close(); this.context = null; }
}
