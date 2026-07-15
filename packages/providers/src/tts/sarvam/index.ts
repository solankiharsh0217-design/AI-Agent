import type { TTSProvider, TTSRequest, TTSResult } from '../../interfaces/tts';
import { fetchWithRetry } from '../../fetch-retry';

export interface SarvamTTSConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export class SarvamTTSProvider implements TTSProvider {
  readonly name = 'sarvam';
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: SarvamTTSConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.sarvam.ai';
    this.timeout = config.timeout ?? 30000;
  }

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const response = await fetchWithRetry(`${this.baseUrl}/text-to-speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: request.text,
        voice_id: request.voiceId ?? 'meera',
        language_code: request.language ?? 'en-IN',
        speed: request.speed ?? 1.0,
        audio_format: request.outputFormat ?? 'wav',
      }),
    }, { maxRetries: 3, timeoutMs: this.timeout });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sarvam TTS error: ${response.status} - ${error}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audio = new Uint8Array(audioBuffer);

    // Estimate duration based on audio size (rough estimate for WAV)
    const sampleRate = 22050;
    const channels = 1;
    const bytesPerSample = 2;
    const durationMs = Math.round((audio.length / (sampleRate * channels * bytesPerSample)) * 1000);

    return {
      audio,
      format: {
        encoding: request.outputFormat ?? 'wav',
        sampleRate,
        channels,
      },
      durationMs,
    };
  }

  async *stream(request: TTSRequest): AsyncIterable<Uint8Array> {
    const result = await this.synthesize(request);
    yield result.audio;
  }
}
