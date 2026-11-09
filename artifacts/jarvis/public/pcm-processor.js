// AudioWorklet Processor for 16kHz PCM downsampling
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.tail = new Float32Array(0);
    // 40 ms a 16 kHz = 640 samples
    this.chunkSize = 640;
    this.output = new Int16Array(this.chunkSize);
    this.offset = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input || input.length === 0) return true;

    const merged = new Float32Array(this.tail.length + input.length);
    merged.set(this.tail);
    merged.set(input, this.tail.length);

    const step = sampleRate / 16000;
    let position = this.phase;

    while (position + 1 < merged.length) {
      const index = Math.floor(position);
      const fraction = position - index;

      // Interpolación lineal entre muestras
      const sample = merged[index] * (1 - fraction) + merged[index + 1] * fraction;
      const clamped = Math.max(-1, Math.min(1, sample));

      this.output[this.offset++] = clamped < 0 ? clamped * 32768 : clamped * 32767;
      position += step;

      if (this.offset === this.chunkSize) {
        const buffer = this.output.buffer;
        this.port.postMessage(buffer, [buffer]);
        this.output = new Int16Array(this.chunkSize);
        this.offset = 0;
      }
    }

    const consumed = Math.floor(position);
    this.tail = merged.slice(consumed);
    this.phase = position - consumed;

    return true;
  }
}

registerProcessor("pcm-processor", PcmCaptureProcessor);
