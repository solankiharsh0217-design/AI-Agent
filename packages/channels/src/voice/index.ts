import type { ChannelAdapter, ChannelMessage, ChannelSession } from '../base';
import type { RuntimeEvent } from '@ai-agent/agent';
import type { STTProvider, TTSProvider } from '@ai-agent/providers';
import { generateId } from '../helpers';

export interface VoiceAdapterConfig {
  sttProvider: STTProvider;
  ttsProvider: TTSProvider;
  language?: string;
  vadEnabled?: boolean;
  sampleRate?: number;
}

export interface VoiceStreamState {
  isListening: boolean;
  isSpeaking: boolean;
  partialTranscript: string;
  vadState: 'silence' | 'speech' | 'endpoint';
}

export class VoiceAdapter implements ChannelAdapter {
  readonly name = 'voice';
  private config: VoiceAdapterConfig;
  private messageHandlers: Array<(sessionId: string, message: ChannelMessage) => void | Promise<void>> = [];
  private eventHandlers: Array<(event: RuntimeEvent) => void | Promise<void>> = [];
  private sessions: Map<string, ChannelSession> = new Map();
  private voiceStates: Map<string, VoiceStreamState> = new Map();

  constructor(config: VoiceAdapterConfig) {
    this.config = {
      language: 'en-IN',
      vadEnabled: true,
      sampleRate: 16000,
      ...config,
    };
  }

  async createSession(params: {
    tenantId: string;
    agentId: string;
    conversationId: string;
  }): Promise<ChannelSession> {
    const session: ChannelSession = {
      id: generateId(),
      tenantId: params.tenantId,
      agentId: params.agentId,
      conversationId: params.conversationId,
      channel: 'voice',
      status: 'active',
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.sessions.set(session.id, session);
    this.voiceStates.set(session.id, {
      isListening: false,
      isSpeaking: false,
      partialTranscript: '',
      vadState: 'silence',
    });

    return session;
  }

  async sendMessage(sessionId: string, message: ChannelMessage): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.lastActivityAt = new Date();

    // If it's an assistant message, synthesize speech
    if (message.role === 'assistant' && message.type === 'text') {
      const audio = await this.config.ttsProvider.synthesize({
        text: message.content,
        language: this.config.language,
      });

      // In a real implementation, this would stream audio to the client
      // For now, we just emit the event
      for (const handler of this.eventHandlers) {
        await handler({
          id: generateId(),
          type: 'assistant_message',
          tenantId: session.tenantId,
          conversationId: session.conversationId,
          sessionId: session.id,
          agentId: session.agentId,
          timestamp: new Date(),
          payload: {
            content: message.content,
            role: 'assistant',
          },
          metadata: {
            audioFormat: audio.format,
            audioDuration: audio.durationMs,
          },
        });
      }
    }

    // Notify handlers
    for (const handler of this.messageHandlers) {
      await handler(sessionId, message);
    }
  }

  async processAudio(sessionId: string, audio: ArrayBuffer, mimeType?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const voiceState = this.voiceStates.get(sessionId);
    if (!voiceState) throw new Error('Voice state not found');

    voiceState.isListening = true;

    const audioMimeType = mimeType ?? 'audio/webm';

    // Transcribe audio
    const transcript = await this.config.sttProvider.transcribe({
      audio: new Uint8Array(audio),
      mimeType: audioMimeType,
      language: this.config.language,
    });

    if (transcript.isFinal && transcript.text.trim()) {
      voiceState.partialTranscript = '';

      // Create user message
      const message: ChannelMessage = {
        id: generateId(),
        type: 'text',
        content: transcript.text,
        role: 'user',
        timestamp: new Date(),
        metadata: {
          confidence: transcript.confidence,
          language: transcript.language,
          durationMs: transcript.durationMs,
        },
      };

      // Notify handlers
      for (const handler of this.messageHandlers) {
        await handler(sessionId, message);
      }
    } else {
      voiceState.partialTranscript = transcript.text;
    }

    voiceState.isListening = false;
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'ended';
      this.sessions.delete(sessionId);
    }
    this.voiceStates.delete(sessionId);
  }

  onMessage(handler: (sessionId: string, message: ChannelMessage) => void | Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  onEvent(handler: (event: RuntimeEvent) => void | Promise<void>): void {
    this.eventHandlers.push(handler);
  }

  getVoiceState(sessionId: string): VoiceStreamState | undefined {
    return this.voiceStates.get(sessionId);
  }
}
