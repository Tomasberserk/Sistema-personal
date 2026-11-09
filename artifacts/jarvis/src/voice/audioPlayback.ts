// Audio Playback Manager for 24kHz PCM from Gemini Live API
export class AudioPlayback {
  private context: AudioContext;
  private analyser: AnalyserNode;
  private nextPlayTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private isMuted = false;

  constructor(context: AudioContext, analyser: AnalyserNode) {
    this.context = context;
    this.analyser = analyser;
  }

  getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.interrupt();
    }
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  isPlaying(): boolean {
    return this.activeSources.size > 0;
  }

  // Play incoming Base64-encoded PCM 16-bit 24kHz chunk
  playPcm24k(base64: string) {
    if (this.isMuted) return;

    try {
      if (this.context.state === 'suspended') {
        void this.context.resume();
      }

      const binary = atob(base64);
      const samples = binary.length / 2;
      const bytes = new Uint8Array(binary.length);

      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const view = new DataView(bytes.buffer);
      const buffer = this.context.createBuffer(1, samples, 24000);
      const channel = buffer.getChannelData(0);

      for (let i = 0; i < samples; i++) {
        channel[i] = view.getInt16(i * 2, true) / 32768;
      }

      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.analyser);

      const currentTime = this.context.currentTime;
      const startAt = Math.max(this.nextPlayTime, currentTime + 0.02);

      source.start(startAt);
      this.nextPlayTime = startAt + buffer.duration;

      this.activeSources.add(source);
      source.onended = () => {
        this.activeSources.delete(source);
        source.disconnect();
      };
    } catch (err) {
      console.error('[AudioPlayback] Error decoding/playing PCM chunk:', err);
    }
  }

  // Barge-in / Stop: immediately cancel all queued and playing audio
  interrupt() {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Source might have already ended
      }
    }
    this.activeSources.clear();
    this.nextPlayTime = this.context.currentTime;
  }

  stop() {
    this.interrupt();
  }
}
