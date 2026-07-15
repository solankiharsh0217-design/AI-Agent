import type { ChannelAdapter, ChannelMessage, ChannelSession } from '../base';
import type { RuntimeEvent } from '@ai-agent/agent';
import type { STTProvider, TTSProvider, TwilioProvider } from '@ai-agent/providers';
import { generateId } from '../helpers';

export interface PhoneAdapterConfig {
  twilioProvider: TwilioProvider;
  sttProvider: STTProvider;
  ttsProvider: TTSProvider;
  language?: string;
  webhookBaseUrl: string;
}

export interface PhoneCallState {
  callSid: string;
  streamSid: string | null;
  from: string;
  to: string;
  status: 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed';
  direction: 'inbound' | 'outbound';
  startedAt: Date | null;
  endedAt: Date | null;
}

export class PhoneAdapter implements ChannelAdapter {
  readonly name = 'phone';
  private config: PhoneAdapterConfig;
  private messageHandlers: Array<(sessionId: string, message: ChannelMessage) => void | Promise<void>> = [];
  private eventHandlers: Array<(event: RuntimeEvent) => void | Promise<void>> = [];
  private sessions: Map<string, ChannelSession> = new Map();
  private callStates: Map<string, PhoneCallState> = new Map();

  constructor(config: PhoneAdapterConfig) {
    this.config = {
      language: 'en-IN',
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
      channel: 'phone',
      status: 'active',
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async makeOutboundCall(params: {
    sessionId: string;
    to: string;
    from: string;
    statusCallback?: string;
  }): Promise<PhoneCallState> {
    const session = this.sessions.get(params.sessionId);
    if (!session) throw new Error('Session not found');

    const callStatus = await this.config.twilioProvider.createCall({
      to: params.to,
      from: params.from,
      url: `${this.config.webhookBaseUrl}/twilio/voice`,
      statusCallback: params.statusCallback ?? `${this.config.webhookBaseUrl}/twilio/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });

    const callState: PhoneCallState = {
      callSid: callStatus.sid,
      streamSid: null,
      from: params.from,
      to: params.to,
      status: 'initiated',
      direction: 'outbound',
      startedAt: null,
      endedAt: null,
    };

    this.callStates.set(params.sessionId, callState);
    return callState;
  }

  async handleIncomingCall(params: {
    callSid: string;
    from: string;
    to: string;
    direction: 'inbound' | 'outbound';
  }): Promise<{ sessionId: string; streamUrl: string }> {
    const sessionId = `phone_${params.callSid}`;

    // Create a proper session
    this.sessions.set(sessionId, {
      id: sessionId,
      tenantId: '',
      agentId: '',
      conversationId: '',
      channel: 'phone',
      status: 'active',
      createdAt: new Date(),
      lastActivityAt: new Date(),
    });

    // Store call state
    this.callStates.set(sessionId, {
      callSid: params.callSid,
      streamSid: null,
      from: params.from,
      to: params.to,
      status: 'ringing',
      direction: params.direction,
      startedAt: new Date(),
      endedAt: null,
    });

    return {
      sessionId,
      streamUrl: `${this.config.webhookBaseUrl}/twilio/media`,
    };
  }

  async processAudio(sessionId: string, audio: ArrayBuffer): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    // Transcribe audio
    const transcript = await this.config.sttProvider.transcribe({
      audio: new Uint8Array(audio),
      mimeType: 'audio/mulaw',
      language: this.config.language,
    });

    if (transcript.isFinal && transcript.text.trim()) {
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
          callSid: this.callStates.get(sessionId)?.callSid,
        },
      };

      for (const handler of this.messageHandlers) {
        await handler(sessionId, message);
      }
    }
  }

  async sendMessage(sessionId: string, message: ChannelMessage): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.lastActivityAt = new Date();

    // Synthesize speech for assistant messages
    if (message.role === 'assistant' && message.type === 'text') {
      const audio = await this.config.ttsProvider.synthesize({
        text: message.content,
        language: this.config.language,
        outputFormat: 'mulaw',
      });

      // In a real implementation, this would send audio via Twilio Media Stream
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

    for (const handler of this.messageHandlers) {
      await handler(sessionId, message);
    }
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'ended';
      this.sessions.delete(sessionId);
    }
    const callState = this.callStates.get(sessionId);
    if (callState) {
      callState.status = 'completed';
      callState.endedAt = new Date();
      this.callStates.delete(sessionId);
    }
  }

  onMessage(handler: (sessionId: string, message: ChannelMessage) => void | Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  onEvent(handler: (event: RuntimeEvent) => void | Promise<void>): void {
    this.eventHandlers.push(handler);
  }

  getCallState(sessionId: string): PhoneCallState | undefined {
    return this.callStates.get(sessionId);
  }
}
