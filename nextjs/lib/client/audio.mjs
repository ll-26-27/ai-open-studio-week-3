// Browser-side audio for /present: an AudioWorklet taps the microphone, the samples are brought down to 16 kHz
// mono 16-bit, and any stretch of the take can be written out as a WAV file. Speech is cut at pauses, found from
// the loudness of each 20 ms frame against the room's own noise floor.

export const RATE = 16000;
export const FRAME = 320; // 20 ms at 16 kHz

const worklet = `class PcmTap extends AudioWorkletProcessor {
  process(inputs) { const channel = inputs[0] && inputs[0][0]; if (channel) this.port.postMessage(channel.slice(0)); return true; }
}
registerProcessor("pcm-tap", PcmTap);`;

export async function tapMicrophone(context, stream, onSamples) {
  const url = URL.createObjectURL(new Blob([worklet], { type: "application/javascript" }));
  await context.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const node = new AudioWorkletNode(context, "pcm-tap");
  const silent = context.createGain();
  silent.gain.value = 0;
  context.createMediaStreamSource(stream).connect(node);
  node.connect(silent).connect(context.destination);
  node.port.onmessage = (event) => onSamples(event.data);
  return node;
}

// The whole take at 16 kHz, growing as it goes, with one loudness value per 20 ms frame.
export class Take {
  constructor(inputRate) {
    this.ratio = inputRate / RATE;
    this.samples = new Int16Array(RATE * 120);
    this.length = 0;
    this.frames = [];
    this.phase = 0; this.sum = 0; this.count = 0;
    this.frameSum = 0; this.frameCount = 0;
  }

  // Box-filter decimation: average the input samples that fall in each output sample.
  add(input) {
    for (let i = 0; i < input.length; i += 1) {
      this.sum += input[i]; this.count += 1; this.phase += 1;
      if (this.phase < this.ratio) continue;
      this.phase -= this.ratio;
      const value = Math.max(-1, Math.min(1, this.sum / this.count));
      this.sum = 0; this.count = 0;
      if (this.length === this.samples.length) { const bigger = new Int16Array(this.samples.length * 2); bigger.set(this.samples); this.samples = bigger; }
      this.samples[this.length++] = value * 32767;
      this.frameSum += value * value; this.frameCount += 1;
      if (this.frameCount === FRAME) { this.frames.push(Math.sqrt(this.frameSum / FRAME)); this.frameSum = 0; this.frameCount = 0; }
    }
  }

  seconds(sample = this.length) { return sample / RATE; }

  // The quiet level for this room: the 10th percentile of the last fifteen seconds (mostly the gaps between
  // words and sentences), times 2.5, kept between 0.006 and 0.04 so a talk with few pauses can't raise it to speech.
  quietLevel() {
    const recent = this.frames.slice(-750).sort((a, b) => a - b);
    const floor = recent.length ? recent[Math.floor(recent.length * 0.1)] : 0;
    return Math.min(0.04, Math.max(0.006, floor * 2.5));
  }

  // Where to end a chunk that started at `start`: in the middle of the first 300 ms pause after `min` seconds, or,
  // past `max` seconds, at the quietest frame of the last two seconds. Null means keep listening.
  cutPoint(start, { min = 3, max = 12 } = {}) {
    const available = this.frames.length;
    const startFrame = Math.ceil(start / FRAME);
    if ((available - startFrame) * FRAME < min * RATE) return null;
    const quiet = this.quietLevel();
    const run = 15;
    const tail = this.frames.slice(-run);
    if (tail.length === run && tail.every((level) => level < quiet)) return (available - Math.floor(run / 2)) * FRAME;
    if ((available - startFrame) * FRAME < max * RATE) return null;
    let best = available - 1;
    for (let frame = Math.max(startFrame, available - 100); frame < available; frame += 1) if (this.frames[frame] < this.frames[best]) best = frame;
    return (best + 1) * FRAME;
  }

  // Whether a stretch has anything louder than the room.
  hasSpeech(start, end) {
    const quiet = this.quietLevel();
    for (let frame = Math.floor(start / FRAME); frame < Math.floor(end / FRAME); frame += 1) if (this.frames[frame] > quiet * 2) return true;
    return false;
  }

  wav(start = 0, end = this.length) {
    const pcm = this.samples.subarray(start, end);
    const buffer = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(buffer);
    const text = (offset, value) => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)); };
    text(0, "RIFF"); view.setUint32(4, 36 + pcm.length * 2, true); text(8, "WAVE");
    text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, "data"); view.setUint32(40, pcm.length * 2, true);
    new Int16Array(buffer, 44).set(pcm);
    return new Blob([buffer], { type: "audio/wav" });
  }
}
