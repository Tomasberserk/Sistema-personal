// Microphone Capture & Resampler to 16kHz PCM 16-bit Mono with Pre-Roll & Noise Gate
export interface AudioCaptureCallbacks {
  onChunk: (buffer: ArrayBuffer) => void;
  onVolume?: (volume: number) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

export class AudioCapture {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private isCapturing = false;
  private isUserSpeaking = false;
  private isMuted = false;
  private speechTimeout: number | null = null;
  private preRollBuffer: ArrayBuffer[] = [];
  private readonly MAX_PRE_ROLL_CHUNKS = 8; // 8 * 40ms = 320ms pre-roll

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.stream) {
      this.stream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    if (muted && this.isUserSpeaking) {
      this.isUserSpeaking = false;
      this.preRollBuffer = [];
      if (this.speechTimeout) {
        window.clearTimeout(this.speechTimeout);
        this.speechTimeout = null;
      }
    }
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  // Force-close current speech turn (useful in very noisy environments)
  forceSpeechEnd(callbacks?: AudioCaptureCallbacks): void {
    if (this.speechTimeout) {
      window.clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
    if (this.isUserSpeaking) {
      this.isUserSpeaking = false;
      if (callbacks?.onSpeechEnd) {
        callbacks.onSpeechEnd();
      }
    }
  }

  async start(callbacks: AudioCaptureCallbacks): Promise<void> {
    if (this.isCapturing) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    if (this.isMuted) {
      this.stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioContextClass({ latencyHint: 'interactive' });
    await this.audioContext.resume();

    const source = this.audioContext.createMediaStreamSource(this.stream);

    // Try loading AudioWorklet processor first
    let workletLoaded = false;
    try {
      await this.audioContext.audioWorklet.addModule('/pcm-processor.js');
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
      this.workletNode.port.onmessage = (event) => {
        if (this.isMuted) return;
        const buffer = event.data as ArrayBuffer;
        this.processPcmChunk(buffer, callbacks);
      };
      source.connect(this.workletNode);
      workletLoaded = true;
    } catch (err) {
      console.warn('[AudioCapture] AudioWorklet could not be loaded, using ScriptProcessor fallback', err);
    }

    // Fallback if AudioWorklet fails or not supported
    if (!workletLoaded) {
      const sampleRate = this.audioContext.sampleRate;
      const bufferSize = 4096;
      this.scriptNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      let tail = new Float32Array(0);
      let phase = 0;
      const chunkSize = 640;
      let output = new Int16Array(chunkSize);
      let offset = 0;

      this.scriptNode.onaudioprocess = (e) => {
        if (this.isMuted) return;
        const input = e.inputBuffer.getChannelData(0);
        if (!input || input.length === 0) return;

        const merged = new Float32Array(tail.length + input.length);
        merged.set(tail);
        merged.set(input, tail.length);

        const step = sampleRate / 16000;
        let position = phase;

        while (position + 1 < merged.length) {
          const idx = Math.floor(position);
          const frac = position - idx;
          const sample = merged[idx] * (1 - frac) + merged[idx + 1] * frac;
          const clamped = Math.max(-1, Math.min(1, sample));

          output[offset++] = clamped < 0 ? clamped * 32768 : clamped * 32767;
          position += step;

          if (offset === chunkSize) {
            const buf = output.buffer.slice(0);
            this.processPcmChunk(buf, callbacks);
            output = new Int16Array(chunkSize);
            offset = 0;
          }
        }

        const consumed = Math.floor(position);
        tail = merged.slice(consumed);
        phase = position - consumed;
      };

      source.connect(this.scriptNode);
      const silentGain = this.audioContext.createGain();
      silentGain.gain.value = 0;
      this.scriptNode.connect(silentGain);
      silentGain.connect(this.audioContext.destination);
    }

    this.isCapturing = true;
  }

  // Noise-Gated VAD with 320ms Pre-Roll Buffer:
  // Only streams actual voice segments (plus pre-roll and 750ms tail) so ambient room noise
  // never keeps Gemini Live stuck in "thinking".
  private processPcmChunk(buffer: ArrayBuffer, callbacks: AudioCaptureCallbacks) {
    if (this.isMuted) return;

    const view = new Int16Array(buffer);
    let sum = 0;
    for (let i = 0; i < view.length; i++) {
      const val = view[i] / 32768;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / view.length);
    if (callbacks.onVolume) {
      callbacks.onVolume(rms);
    }

    const SPEECH_THRESHOLD = 0.04;
    if (rms > SPEECH_THRESHOLD) {
      if (!this.isUserSpeaking) {
        this.isUserSpeaking = true;
        if (callbacks.onSpeechStart) {
          callbacks.onSpeechStart();
        }
        // Flush pre-roll chunks so the first syllable is preserved
        for (const preChunk of this.preRollBuffer) {
          callbacks.onChunk(preChunk);
        }
        this.preRollBuffer = [];
      }

      if (this.speechTimeout) {
        window.clearTimeout(this.speechTimeout);
      }
      this.speechTimeout = window.setTimeout(() => {
        this.isUserSpeaking = false;
        if (callbacks.onSpeechEnd) {
          callbacks.onSpeechEnd();
        }
      }, 750);
    }

    if (this.isUserSpeaking) {
      callbacks.onChunk(buffer);
    } else {
      // Keep rolling 320ms pre-roll buffer while silent
      this.preRollBuffer.push(buffer);
      if (this.preRollBuffer.length > this.MAX_PRE_ROLL_CHUNKS) {
        this.preRollBuffer.shift();
      }
    }
  }

  stop(): void {
    this.isCapturing = false;
    this.isUserSpeaking = false;
    this.preRollBuffer = [];
    if (this.speechTimeout) {
      window.clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
      this.audioContext = null;
    }
  }
}
