import type { TTSProvider, TTSRequest, TTSResult } from '../../interfaces/tts';
import { fetchWithRetry } from '../../fetch-retry';

export interface SarvamTTSConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  model?: string;
  defaultSpeaker?: string;
}

// Sarvam's TTS accepts a limited number of characters per request. Keep chunks
// comfortably under the documented limit and split on sentence boundaries so the
// synthesized audio still sounds natural when the pieces are concatenated.
const MAX_CHARS_PER_CHUNK = 450;
const SAMPLE_RATE = 22050;

export class SarvamTTSProvider implements TTSProvider {
  readonly name = 'sarvam';
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private model: string;
  private defaultSpeaker: string;

  constructor(config: SarvamTTSConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.sarvam.ai';
    this.timeout = config.timeout ?? 30000;
    this.model = config.model ?? 'bulbul:v3';
    this.defaultSpeaker = config.defaultSpeaker ?? 'anushka';
  }

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const text = (request.text ?? '').trim();
    if (!text) {
      throw new Error('Sarvam TTS error: empty text');
    }

    const chunks = splitIntoChunks(text, MAX_CHARS_PER_CHUNK);
    const wavs: Uint8Array[] = [];

    for (const chunk of chunks) {
      const response = await fetchWithRetry(`${this.baseUrl}/text-to-speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Sarvam accepts either a single `text` or an `inputs` array; the array
          // form is the canonical, widely-supported shape across model versions.
          inputs: [chunk],
          target_language_code: request.language ?? 'en-IN',
          speaker: (request.voiceId && request.voiceId.trim()) ? request.voiceId : this.defaultSpeaker,
          pace: request.speed ?? 1.0,
          model: this.model,
          speech_sample_rate: SAMPLE_RATE,
          enable_preprocessing: true,
        }),
      }, { maxRetries: 3, timeoutMs: this.timeout });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Sarvam TTS error: ${response.status} - ${error}`);
      }

      // Sarvam returns JSON: { request_id, audios: ["<base64-encoded WAV>", ...] }
      const data = (await response.json()) as { audios?: string[] };
      const base64List = data.audios ?? [];
      if (base64List.length === 0) {
        throw new Error('Sarvam TTS error: response contained no audio');
      }
      for (const b64 of base64List) {
        wavs.push(base64ToBytes(b64));
      }
    }

    const audio = wavs.length === 1 ? wavs[0] : mergeWavs(wavs);

    // WAV is 16-bit mono PCM at SAMPLE_RATE. Estimate duration from the PCM payload.
    const pcmBytes = Math.max(0, audio.length - 44);
    const durationMs = Math.round((pcmBytes / (SAMPLE_RATE * 1 * 2)) * 1000);

    return {
      audio,
      format: {
        encoding: 'wav',
        sampleRate: SAMPLE_RATE,
        channels: 1,
      },
      durationMs,
    };
  }

  async *stream(request: TTSRequest): AsyncIterable<Uint8Array> {
    const result = await this.synthesize(request);
    yield result.audio;
  }
}

function splitIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  // Split on sentence terminators first, then greedily pack into chunks.
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) ?? [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      // A single very long sentence — hard-split on word boundaries.
      if (current) {
        chunks.push(current);
        current = '';
      }
      let remaining = sentence;
      while (remaining.length > maxChars) {
        let cut = remaining.lastIndexOf(' ', maxChars);
        if (cut <= 0) cut = maxChars;
        chunks.push(remaining.slice(0, cut).trim());
        remaining = remaining.slice(cut);
      }
      current = remaining.trim();
      continue;
    }

    if ((current + sentence).length > maxChars) {
      if (current) chunks.push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 0);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Concatenate multiple single-stream WAV files (same format) into one WAV by
// keeping the first header and appending only the PCM data of the rest, then
// rewriting the RIFF/data size fields.
function mergeWavs(wavs: Uint8Array[]): Uint8Array {
  const HEADER = 44;
  const pcmParts = wavs.map((w) => (w.length > HEADER ? w.subarray(HEADER) : new Uint8Array(0)));
  const totalPcm = pcmParts.reduce((n, p) => n + p.length, 0);

  const out = new Uint8Array(HEADER + totalPcm);
  out.set(wavs[0].subarray(0, HEADER), 0);
  let offset = HEADER;
  for (const part of pcmParts) {
    out.set(part, offset);
    offset += part.length;
  }

  const view = new DataView(out.buffer);
  view.setUint32(4, 36 + totalPcm, true); // RIFF chunk size
  view.setUint32(40, totalPcm, true); // data chunk size
  return out;
}
