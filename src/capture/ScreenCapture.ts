export class ScreenCapture {
  private stream: MediaStream | null = null;
  private generation = 0;
  async start(onEnded: () => void): Promise<MediaStream | null> {
    this.stop();
    const generation = this.generation;
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('화면 공유를 지원하는 Chrome 또는 Edge에서 localhost로 실행해 주세요.');
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); return null; }
    this.stream = stream;
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (this.stream !== stream) return;
      this.stop();
      onEnded();
    }, { once: true });
    return stream;
  }
  stop() { this.generation++; this.stream?.getTracks().forEach(t => t.stop()); this.stream = null; }
}
