import type { STTProvider, STTRequest, STTResult } from '../../interfaces/stt';
import { fetchWithRetry } from '../../fetch-retry';

export interface SarvamSTTConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export class SarvamSTTProvider implements STTProvider {
  readonly name = 'sarvam';
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: SarvamSTTConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.sarvam.ai';
    this.timeout = config.timeout ?? 30000;
  }

  async transcribe(request: STTRequest): Promise<STTResult> {
    const formData = new FormData();
    const blob = new Blob([request.audio], { type: request.mimeType });
    formData.append('file', blob, 'audio.webm');
    if (request.language) formData.append('language_code', request.language);

    const response = await fetchWithRetry(`${this.baseUrl}/speech-to-text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    }, { maxRetries: 3, timeoutMs: this.timeout });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sarvam STT error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    return {
      text: data.transcript ?? '',
      confidence: data.confidence ?? null,
      language: data.language_code ?? request.language ?? null,
      durationMs: data.audio_duration_ms ?? 0,
      isFinal: true,
    };
  }

  async *stream(request: STTRequest): AsyncIterable<STTResult> {
    // Sarvam supports streaming via WebSocket, but for now we'll use the REST API
    const result = await this.transcribe(request);
    yield result;
  }
}
