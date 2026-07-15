export interface TTSRequest {
  text: string;
  voiceId?: string;
  language?: string;
  speed?: number;
  outputFormat?: 'mp3' | 'wav' | 'opus' | 'mulaw';
}

export interface TTSResult {
  audio: Uint8Array;
  format: {
    encoding: string;
    sampleRate: number;
    channels: number;
  };
  durationMs: number | null;
}

export interface TTSProvider {
  readonly name: string;
  synthesize(request: TTSRequest): Promise<TTSResult>;
  stream?(request: TTSRequest): AsyncIterable<Uint8Array>;
}
