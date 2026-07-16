/**
 * Audio codec utilities for the phone voice pipeline.
 *
 * Twilio Media Streams send/receive 8kHz mono G.711 μ-law audio, base64-encoded,
 * in 20ms (160-byte) frames. Sarvam STT accepts a WAV file; Sarvam TTS returns a
 * WAV file (typically 22050Hz). These helpers bridge the two formats.
 *
 * All functions are pure and dependency-free so they can be unit-tested in isolation.
 */

// --- G.711 μ-law <-> PCM16 (canonical Sun implementation) ---

const MULAW_DECODE_LUT = [0, 132, 396, 924, 1980, 4092, 8316, 16764];

/** Decode a single μ-law byte to a signed 16-bit PCM sample. */
export function muLawDecodeSample(muLawByte: number): number {
  const u = ~muLawByte & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  const sample = MULAW_DECODE_LUT[exponent] + (mantissa << (exponent + 3));
  return sign !== 0 ? -sample : sample;
}

const MULAW_EXP_LUT = (() => {
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    if (i < 2) lut[i] = 0;
    else if (i < 4) lut[i] = 1;
    else if (i < 8) lut[i] = 2;
    else if (i < 16) lut[i] = 3;
    else if (i < 32) lut[i] = 4;
    else if (i < 64) lut[i] = 5;
    else if (i < 128) lut[i] = 6;
    else lut[i] = 7;
  }
  return lut;
})();

/** Encode a single signed 16-bit PCM sample to a μ-law byte. */
export function muLawEncodeSample(sample: number): number {
  const BIAS = 0x84;
  const CLIP = 32635;
  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;
  const exponent = MULAW_EXP_LUT[(sample >> 7) & 0xff];
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/** Decode a μ-law byte buffer to PCM16 samples. */
export function muLawDecode(muLaw: Uint8Array): Int16Array {
  const pcm = new Int16Array(muLaw.length);
  for (let i = 0; i < muLaw.length; i++) {
    pcm[i] = muLawDecodeSample(muLaw[i]);
  }
  return pcm;
}

/** Encode PCM16 samples to a μ-law byte buffer. */
export function muLawEncode(pcm: Int16Array): Uint8Array {
  const out = new Uint8Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    out[i] = muLawEncodeSample(pcm[i]);
  }
  return out;
}

// --- WAV (PCM16 mono) ---

/** Wrap PCM16 mono samples in a 44-byte WAV container. */
export function pcm16ToWav(pcm: Int16Array, sampleRate = 8000): Uint8Array {
  const dataBytes = pcm.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // channels = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < pcm.length; i++, offset += 2) {
    view.setInt16(offset, pcm[i], true);
  }
  return new Uint8Array(buffer);
}

/** Parse a WAV file (PCM16) into samples + sample rate. Scans chunks for robustness. */
export function wavToPcm16(wav: Uint8Array): { pcm: Int16Array; sampleRate: number } {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const readStr = (offset: number, len: number) => {
    let s = '';
    for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
    return s;
  };

  // Fallback assumes a canonical header if this isn't a RIFF/WAVE file
  if (wav.length < 44 || readStr(0, 4) !== 'RIFF' || readStr(8, 4) !== 'WAVE') {
    const pcm = new Int16Array(Math.floor(wav.length / 2));
    for (let i = 0; i < pcm.length; i++) pcm[i] = view.getInt16(i * 2, true);
    return { pcm, sampleRate: 22050 };
  }

  let sampleRate = 22050;
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const chunkId = readStr(offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (chunkId === 'fmt ') {
      sampleRate = view.getUint32(body + 4, true);
    } else if (chunkId === 'data') {
      const count = Math.floor(Math.min(chunkSize, wav.length - body) / 2);
      const pcm = new Int16Array(count);
      for (let i = 0; i < count; i++) pcm[i] = view.getInt16(body + i * 2, true);
      return { pcm, sampleRate };
    }
    offset = body + chunkSize + (chunkSize % 2); // chunks are word-aligned
  }
  return { pcm: new Int16Array(0), sampleRate };
}

/** Linear-interpolation resampler for PCM16 mono. */
export function resamplePcm16(pcm: Int16Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate || pcm.length === 0) return pcm;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(pcm.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i * ratio;
    const idx = Math.floor(srcPos);
    const frac = srcPos - idx;
    const a = pcm[idx];
    const b = idx + 1 < pcm.length ? pcm[idx + 1] : a;
    out[i] = (a + (b - a) * frac) | 0;
  }
  return out;
}

/** Root-mean-square amplitude of a PCM16 frame (used for energy-based VAD). */
export function pcmRms(pcm: Int16Array): number {
  if (pcm.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
  return Math.sqrt(sum / pcm.length);
}

// --- base64 ---

export function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}
