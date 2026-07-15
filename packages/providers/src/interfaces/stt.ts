export interface STTRequest {
  audio: ArrayBuffer | Uint8Array;
  mimeType: string;
  language?: string;
}

export interface STTResult {
  text: string;
  confidence: number | null;
  language: string | null;
  durationMs: number;
  isFinal: boolean;
}

export interface STTProvider {
  readonly name: string;
  transcribe(request: STTRequest): Promise<STTResult>;
  stream?(request: STTRequest): AsyncIterable<STTResult>;
}
