/** Genuine mono PCM WAV; bounded to the backend v1 contract (DEC-029). */
export const VOICE_SAMPLE_RATE = 16000;
export const VOICE_MAX_SECONDS = 30;
export const VOICE_MAX_FRAMES = VOICE_SAMPLE_RATE * VOICE_MAX_SECONDS;

/** Windowed-sinc low-pass resampling, not interpolation/renaming compressed audio.
 * 32 taps limit aliasing when downsampling; quality still needs real speech tests.
 */
export function resampleMono(input: Float32Array, sourceRate: number): Float32Array {
  if (!Number.isFinite(sourceRate) || sourceRate < 8000 || sourceRate > 96000) {
    throw new Error("voiceUnsupported");
  }
  const length = Math.min(input.length, Math.floor(sourceRate * VOICE_MAX_SECONDS));
  const count = Math.min(VOICE_MAX_FRAMES, Math.floor(length * VOICE_SAMPLE_RATE / sourceRate));
  if (!count) throw new Error("voiceEmpty");
  if (sourceRate === VOICE_SAMPLE_RATE) return input.slice(0, count);
  const result = new Float32Array(count);
  const ratio = sourceRate / VOICE_SAMPLE_RATE;
  const cutoff = Math.min(1, 1 / ratio) * 0.9;
  for (let i = 0; i < count; i++) {
    const position = i * ratio;
    const centre = Math.floor(position);
    let sum = 0;
    let weight = 0;
    for (let j = centre - 15; j <= centre + 16; j++) {
      if (j < 0 || j >= length) continue;
      const distance = position - j;
      if (Math.abs(distance) >= 16) continue;
      const x = Math.PI * distance * cutoff;
      const sinc = x === 0 ? 1 : Math.sin(x) / x;
      const tap = cutoff * sinc * (0.5 + 0.5 * Math.cos(Math.PI * distance / 16));
      sum += (Number.isFinite(input[j]) ? input[j] : 0) * tap;
      weight += tap;
    }
    result[i] = weight ? sum / weight : 0;
  }
  return result;
}

export function encodeWav(samples: Float32Array): ArrayBuffer {
  if (!samples.length) throw new Error("voiceEmpty");
  const count = Math.min(samples.length, VOICE_MAX_FRAMES);
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true);
  text(8, "WAVE"); text(12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, VOICE_SAMPLE_RATE, true); view.setUint32(28, VOICE_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const sample = Number.isFinite(samples[i]) ? Math.max(-1, Math.min(1, samples[i])) : 0;
    view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}
