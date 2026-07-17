import {
  base64ToUint8,
  uint8ToBase64,
  muLawDecode,
  muLawEncode,
  pcm16ToWav,
  wavToPcm16,
  resamplePcm16,
  pcmRms,
} from './audio';
import { createProviderRegistry } from '../context';

/** Per-call state for the Twilio media (phone voice) pipeline. */
interface VoiceCallState {
  streamSid: string;
  callSid?: string;
  chunks: Uint8Array[]; // μ-law frames collected for the in-progress utterance
  speechMs: number;
  silenceMs: number;
  inSpeech: boolean;
  processing: boolean; // true while we transcribe/think/speak (ignore inbound audio)
  greeted: boolean;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'error';
  createdAt: string;
  confirmedAt?: string;
}

export interface SessionState {
  messageCount: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  currentTurn: number;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
  pendingToolCalls: string[];
  context: Record<string, unknown>;
  toolCallHistory: ToolCallRecord[];
  pendingConfirmations: string[];
  status: 'active' | 'waiting' | 'ended';
  createdAt: string;
  updatedAt: string;
}

export interface Env {
  SESSION_DO: DurableObjectNamespace;
  DB: D1Database;
  R2: R2Bucket;
  KV: KVNamespace;
  AI: Ai;
  VECTORIZE: unknown;
  INTERNAL_API_SECRET?: string;
}

export class SessionDurableObject {
  private ctx: DurableObjectState;
  private env: Env;
  private websockets: Set<WebSocket>;
  private voice?: VoiceCallState;
  private voiceSettings?: { language: string; voiceId?: string; greeting?: string };

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
    this.websockets = new Set();

    this.ctx.blockConcurrencyWhile(async () => {
      const state = await this.ctx.storage.get<SessionState>('session');
      if (!state) {
        await this.ctx.storage.put('session', this.defaultState());
      }
    });

    this.ctx.getWebSockets().forEach((ws) => {
      this.websockets.add(ws);
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Allow internal requests with a shared secret header
    const internalAuth = request.headers.get('X-Internal-Auth');
    const expectedInternalAuth = this.env.INTERNAL_API_SECRET;
    let requestTenantId: string;
    let requestUserId: string;

    if (internalAuth === expectedInternalAuth) {
      // Internal request — trust the tenantId from the header
      const internalTenantId = request.headers.get('X-Tenant-Id');
      if (internalTenantId) {
        requestTenantId = internalTenantId;
        requestUserId = 'internal';
      } else {
        return this.json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Internal request missing X-Tenant-Id' } }, 401);
      }
    } else {
      // All DO requests must come through the API worker (internal auth)
      return this.json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Requests must be authenticated via internal API' } }, 401);
    }

    const sessionIdParam = url.searchParams.get('sessionId') || url.searchParams.get('CallSid');
    if (sessionIdParam) {
      await this.ctx.storage.put('dbSessionId', sessionIdParam);
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request, requestTenantId);
    }

    const route = `${request.method} ${path}`;

    // For POST /init — store the tenantId
    if (route === 'POST /init') {
      await this.ctx.storage.put('tenantId', requestTenantId);
      return this.json({ success: true });
    }

    // For all non-init requests, verify tenantId matches — or adopt it on first contact.
    // HTTP-only channels (e.g. the widget voice turn) never open a WebSocket or hit /init,
    // so this is where their DO first learns which tenant it belongs to.
    const storedTenantId = await this.ctx.storage.get<string>('tenantId');
    if (storedTenantId && requestTenantId !== storedTenantId) {
      return this.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this session' } }, 403);
    }
    if (!storedTenantId) {
      await this.ctx.storage.put('tenantId', requestTenantId);
    }

    switch (route) {
      case 'GET /state':
        return this.json(await this.getState());
      case 'POST /state':
        return this.json(await this.updateContext(await request.json()));
      case 'POST /tool-call':
        return this.json(await this.addToolCall(await request.json()));
      case 'POST /confirm':
        return this.json(await this.confirmTool(await request.json()));
      case 'GET /history':
        return this.json(await this.getHistory());
      case 'POST /context':
        return this.json(await this.updateContext(await request.json()));
      case 'GET /context':
        return this.json((await this.getState()).context);
      case 'POST /end':
        return this.json(await this.endSession());
      case 'GET /status':
        return this.json({ status: (await this.getState()).status });
case 'POST /messages':
        return this.json(await this.handlePostMessage(await request.json()));
      case 'POST /stream-messages':
        return this.handleStreamMessage(await request.json());
      default:
        return this.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
    }
  }

  private handleWebSocketUpgrade(request: Request, requestTenantId: string): Response {
    const url = new URL(request.url);
    const sessionIdParam = url.searchParams.get('sessionId') || url.searchParams.get('CallSid');
    if (sessionIdParam) {
      this.ctx.waitUntil(this.ctx.storage.put('dbSessionId', sessionIdParam));
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.ctx.acceptWebSocket(server);
    this.websockets.add(server);

    this.ctx.waitUntil(
      (async () => {
        // Store tenantId if not yet stored
        const storedTenantId = await this.ctx.storage.get<string>('tenantId');
        if (!storedTenantId) {
          await this.ctx.storage.put('tenantId', requestTenantId);
        }
        this.broadcast({
          type: 'connected',
          sessionId: this.ctx.id.toString(),
          timestamp: new Date().toISOString(),
        });
      })()
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      let data: any;
      if (typeof message === 'string') {
        data = JSON.parse(message);
      } else {
        try {
          data = JSON.parse(new TextDecoder().decode(message));
        } catch {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid binary message format' }));
          return;
        }
      }

      // Twilio Telephony Stream Packets
      if (data.event) {
        switch (data.event) {
          case 'start':
            this.voice = {
              streamSid: data.streamSid,
              callSid: data.start?.callSid,
              chunks: [],
              speechMs: 0,
              silenceMs: 0,
              inSpeech: false,
              processing: false,
              greeted: false,
            };
            this.broadcast({
              type: 'telephony:call_started',
              callSid: data.start?.callSid,
              streamSid: data.streamSid,
            });
            this.ctx.waitUntil(this.handleTwilioStart(ws));
            break;
          case 'media':
            this.handleTwilioMedia(ws, data.streamSid, data.media?.payload);
            break;
          case 'stop':
            this.voice = undefined;
            this.broadcast({
              type: 'telephony:call_ended',
              streamSid: data.streamSid,
            });
            break;
        }
        return;
      }

      // Standard Chat Widget Packets
      switch (data.type) {
        case 'subscribe':
          this.broadcast({
            type: 'subscribed',
            sessionId: this.ctx.id.toString(),
            channels: data.channels ?? ['all'],
          });
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;

        case 'get-state':
          ws.send(JSON.stringify({ type: 'state', data: await this.getState() }));
          break;

        case 'chat:send':
          await this.handleWebSocketChatSend(ws, data.payload);
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${data.type}` }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format or execution error' }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    this.websockets.delete(ws);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    this.websockets.delete(ws);
  }

  async getState(): Promise<SessionState> {
    const state = await this.ctx.storage.get<SessionState>('session');
    return state ?? this.defaultState();
  }

  async updateContext(partial: { context?: Record<string, unknown>; messageCount?: number; lastUserMessage?: string; lastAssistantMessage?: string; tokenUsage?: SessionState['tokenUsage']; currentTurn?: number }): Promise<SessionState> {
    const state = await this.getState();

    if (partial.context) {
      state.context = { ...state.context, ...partial.context };
    }
    if (partial.messageCount !== undefined) state.messageCount = partial.messageCount;
    if (partial.lastUserMessage !== undefined) state.lastUserMessage = partial.lastUserMessage;
    if (partial.lastAssistantMessage !== undefined) state.lastAssistantMessage = partial.lastAssistantMessage;
    if (partial.tokenUsage) state.tokenUsage = { ...state.tokenUsage, ...partial.tokenUsage };
    if (partial.currentTurn !== undefined) state.currentTurn = partial.currentTurn;

    state.updatedAt = new Date().toISOString();
    await this.ctx.storage.put('session', state);

    this.broadcast({ type: 'state:updated', data: state });

    return state;
  }

  async addToolCall(toolCall: Omit<ToolCallRecord, 'status' | 'createdAt'>): Promise<ToolCallRecord> {
    const state = await this.getState();

    const record: ToolCallRecord = {
      ...toolCall,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    state.toolCallHistory.push(record);
    state.pendingToolCalls.push(record.id);
    state.pendingConfirmations.push(record.id);
    state.updatedAt = new Date().toISOString();

    await this.ctx.storage.put('session', state);

    this.broadcast({ type: 'tool-call:added', data: record });

    return record;
  }

  async confirmTool(payload: { toolCallId: string; confirmed: boolean; result?: unknown; error?: string }): Promise<ToolCallRecord | null> {
    const state = await this.getState();
    const record = state.toolCallHistory.find((tc) => tc.id === payload.toolCallId);

    if (!record) return null;

    if (payload.confirmed) {
      record.status = 'completed';
      record.result = payload.result;
    } else {
      record.status = 'error';
      record.error = payload.error ?? 'Confirmation denied by user';
    }

    record.confirmedAt = new Date().toISOString();
    state.pendingToolCalls = state.pendingToolCalls.filter((id) => id !== payload.toolCallId);
    state.pendingConfirmations = state.pendingConfirmations.filter((id) => id !== payload.toolCallId);
    state.updatedAt = new Date().toISOString();

    await this.ctx.storage.put('session', state);

    this.broadcast({ type: 'tool-call:confirmed', data: record });

    return record;
  }

  async getHistory(): Promise<ToolCallRecord[]> {
    const state = await this.getState();
    return state.toolCallHistory;
  }

  async endSession(): Promise<SessionState> {
    const state = await this.getState();
    state.status = 'ended';
    state.updatedAt = new Date().toISOString();

    await this.ctx.storage.put('session', state);

    this.broadcast({ type: 'session:ended', data: state });

    return state;
  }

  private broadcast(message: Record<string, unknown>): void {
    const data = JSON.stringify(message);
    const dead: WebSocket[] = [];

    for (const ws of this.websockets) {
      try {
        ws.send(data);
      } catch {
        dead.push(ws);
      }
    }

    for (const ws of dead) {
      this.websockets.delete(ws);
    }
  }

  private json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private defaultState(): SessionState {
    return {
      messageCount: 0,
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      },
      currentTurn: 0,
      pendingToolCalls: [],
      context: {},
      toolCallHistory: [],
      pendingConfirmations: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // --- Dynamic turn processing implementations ---

  /**
   * Build the AgentRuntime + context/config for this session's agent. Shared by every
   * channel (HTTP text turn, streaming chat, and phone voice) so the wiring lives in one place.
   */
  private async buildRuntime(): Promise<
    | {
        runtime: any;
        runtimeContext: any;
        runtimeConfig: any;
        agentConfig: any;
        registry: any;
        dbSession: any;
      }
    | { error: string }
  > {
    const dbSessionId = await this.ctx.storage.get<string>('dbSessionId');
    if (!dbSessionId) {
      return { error: 'No session ID associated with this Durable Object' };
    }

    const { createDatabase, SessionRepository, ConversationRepository, AgentRepository } = await import('@ai-agent/database');
    const { createProviderRegistry } = await import('../context');
    const { AgentRuntime, MemoryEngine, PlannerEngine, KnowledgeEngine, PromptBuilder, ToolRegistry, EventBus, SessionManager } = await import('@ai-agent/agent');
    const { Logger } = await import('@ai-agent/shared');

    const db = createDatabase(this.env.DB);
    const sessionRepo = new SessionRepository(db as any);
    const convRepo = new ConversationRepository(db as any);
    const agentRepo = new AgentRepository(db as any);

    const tenantId = await this.ctx.storage.get<string>('tenantId');
    if (!tenantId) {
      return { error: 'No tenant ID associated with this session' };
    }

    const dbSession = await sessionRepo.findById(dbSessionId, tenantId);
    if (!dbSession) {
      return { error: `Session not found: ${dbSessionId}` };
    }

    const agent = await agentRepo.findById(dbSession.agentId, dbSession.tenantId);
    if (!agent) {
      return { error: `Agent not found: ${dbSession.agentId}` };
    }

    const logger = new Logger({ service: 'session-durable-object' });
    const registry = createProviderRegistry(this.env as any);
    const agentConfig = typeof agent.config === 'string' ? JSON.parse(agent.config) : agent.config;

    const runtime = new AgentRuntime({
      llm: registry.getLLM(agentConfig.provider || 'groq'),
      promptBuilder: new PromptBuilder(),
      planner: new PlannerEngine(),
      memory: new MemoryEngine(convRepo as any),
      knowledge: KnowledgeEngine.createWithVectorize(registry.getEmbedding('workers-ai'), this.env.VECTORIZE as any),
      tools: new ToolRegistry(),
      eventBus: new EventBus(),
      sessionManager: new SessionManager(sessionRepo as any, convRepo as any),
      logger,
    });

    const runtimeContext = {
      tenantId: dbSession.tenantId,
      agentId: dbSession.agentId,
      conversationId: dbSession.conversationId,
      sessionId: dbSession.id,
      channel: dbSession.channel,
    };

    const runtimeConfig = {
      model: agentConfig.model || 'llama-3.3-70b-versatile',
      temperature: agentConfig.temperature ?? 0.7,
      maxTokens: agentConfig.maxTokens ?? 2048,
      systemPrompt: agentConfig.systemPrompt || '',
      knowledgeBaseIds: agentConfig.knowledgeBaseIds || [],
      memoryConfig: agentConfig.memoryConfig || { enabled: true, maxMessages: 20, maxTokens: 4000 },
      retrievalConfig: { topK: 3, scoreThreshold: 0.5, enableReranking: false },
      enableTools: agentConfig.tools && agentConfig.tools.length > 0,
      enableKnowledge: agentConfig.knowledgeBaseIds && agentConfig.knowledgeBaseIds.length > 0,
    };

    return { runtime, runtimeContext, runtimeConfig, agentConfig, registry, dbSession };
  }

  /** Run one non-streaming agent turn and persist session bookkeeping. Used by text + voice. */
  private async runAgentTurn(content: string): Promise<{ content: string }> {
    const built = await this.buildRuntime();
    if ('error' in built) {
      throw new Error(built.error);
    }
    const { runtime, runtimeContext, runtimeConfig } = built;

    const result = await runtime.processTurn(content, runtimeContext, runtimeConfig);

    const state = await this.getState();
    state.messageCount += 2;
    state.lastUserMessage = content;
    state.lastAssistantMessage = result.content;
    state.updatedAt = new Date().toISOString();
    await this.ctx.storage.put('session', state);
    this.broadcast({ type: 'state:updated', data: state });

    return { content: result.content };
  }

  private async handlePostMessage(body: { content: string; widgetId?: string }): Promise<unknown> {
    try {
      const result = await this.runAgentTurn(body.content);
      return {
        success: true,
        data: {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.content,
          timestamp: Date.now(),
        },
      };
    } catch (err) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: (err as Error).message },
      };
    }
  }

  /** Streaming endpoint: LLM tokens → sentence-split → TTS per sentence → SSE chunks. */
  private async handleStreamMessage(body: {
    content: string;
    widgetId?: string;
    voice?: { language?: string; voiceId?: string | null; speed?: number };
  }): Promise<Response> {
    const stream = new ReadableStream({
      start: async (controller) => {
        const encoder = new TextEncoder();
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        send('start', { type: 'start' });

        try {
          const built = await this.buildRuntime();
          if ('error' in built) {
            send('error', { type: 'error', message: built.error });
            controller.close();
            return;
          }

          const { runtime, runtimeContext, runtimeConfig, registry, dbSession } = built;
          // Prefer the widget's own voice config (passed from the /voice/stream route) so a
          // widget can override the agent's default language/voice. Fall back to the agent
          // settings if none were supplied.
          const widgetVoice = body.voice || {};
          const agentVoice = await this.getVoiceSettings();
          const settings = {
            language: widgetVoice.language || agentVoice.language || 'en-IN',
            voiceId: widgetVoice.voiceId || agentVoice.voiceId,
            speed: widgetVoice.speed ?? 1.0,
          };
          const tts = registry.getTTS();

          // Send transcript immediately so widget can display it
          send('transcript', { type: 'transcript', text: body.content });

          let sentenceBuffer = '';
          let fullReply = '';

          for await (const chunk of runtime.streamTurn(body.content, runtimeContext, runtimeConfig)) {
            fullReply += chunk;
            sentenceBuffer += chunk;

            // Split on sentence boundaries (., !, ? followed by space or end)
            const sentences = sentenceBuffer.split(/(?<=[.!?])\s+/);
            sentenceBuffer = sentences.pop() || '';

            for (const sentence of sentences) {
              const trimmed = sentence.trim();
              if (!trimmed) continue;

              try {
                const ttsResult = await tts.synthesize({
                  text: trimmed,
                  language: settings.language,
                  voiceId: settings.voiceId,
                  speed: settings.speed,
                  outputFormat: 'wav',
                });
                const audioBase64 = uint8ToBase64(ttsResult.audio);
                send('audio_chunk', {
                  type: 'audio_chunk',
                  audioBase64,
                  audioFormat: 'wav',
                  text: trimmed,
                });
              } catch (e) {
                console.error('[stream] TTS chunk failed:', (e as Error).message);
              }
            }
          }

          // Flush remaining buffer
          if (sentenceBuffer.trim()) {
            try {
              const ttsResult = await tts.synthesize({
                text: sentenceBuffer.trim(),
                language: settings.language,
                voiceId: settings.voiceId,
                speed: settings.speed,
                outputFormat: 'wav',
              });
              const audioBase64 = uint8ToBase64(ttsResult.audio);
              send('audio_chunk', {
                type: 'audio_chunk',
                audioBase64,
                audioFormat: 'wav',
                text: sentenceBuffer.trim(),
              });
            } catch (e) {
              console.error('[stream] TTS final chunk failed:', (e as Error).message);
            }
          }

          // Persist both the user message and the assistant reply to D1 so the
          // conversation history survives the session (mirrors handlePostMessage).
          try {
            const { ConversationRepository, createDatabase } = await import('@ai-agent/database');
            const db = createDatabase(this.env.DB);
            const convRepo = new ConversationRepository(db as any);
            await convRepo.addMessage({
              conversationId: dbSession.conversationId,
              tenantId: dbSession.tenantId,
              sessionId: dbSession.id,
              role: 'user',
              content: body.content,
              type: 'text',
            });
            await convRepo.addMessage({
              conversationId: dbSession.conversationId,
              tenantId: dbSession.tenantId,
              sessionId: dbSession.id,
              role: 'assistant',
              content: fullReply,
              type: 'text',
            });
            await convRepo.incrementMessageCount(dbSession.conversationId, dbSession.tenantId);
          } catch (e) {
            console.error('[stream] Failed to persist messages:', (e as Error).message);
          }

          // Persist session state
          const state = await this.getState();
          state.messageCount += 2;
          state.lastUserMessage = body.content;
          state.lastAssistantMessage = fullReply;
          state.updatedAt = new Date().toISOString();
          await this.ctx.storage.put('session', state);
          this.broadcast({ type: 'state:updated', data: state });

          send('end', { type: 'end', fullReply });
        } catch (err) {
          send('error', { type: 'error', message: (err as Error).message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // --- Phone voice pipeline (Twilio Media Streams) ---

  /** Resolve the agent's voice settings (language / voiceId / greeting), cached per call. */
  private async getVoiceSettings(): Promise<{ language: string; voiceId?: string; greeting?: string }> {
    if (this.voiceSettings) return this.voiceSettings;
    const built = await this.buildRuntime();
    if ('error' in built) {
      this.voiceSettings = { language: 'en-IN' };
      return this.voiceSettings;
    }
    const cfg = built.agentConfig || {};
    const voiceCfg = cfg.voice || {};
    this.voiceSettings = {
      language: voiceCfg.language || 'en-IN',
      voiceId: voiceCfg.voiceId || undefined,
      greeting: cfg.greeting || voiceCfg.greeting || undefined,
    };
    return this.voiceSettings;
  }

  /** On call start, greet the caller (TTS) if a greeting is configured. */
  private async handleTwilioStart(ws: WebSocket): Promise<void> {
    try {
      const settings = await this.getVoiceSettings();
      const greeting = settings.greeting;
      if (!greeting || !this.voice) return;
      this.voice.greeted = true;
      await this.speak(ws, this.voice.streamSid, greeting);
    } catch {
      // Greeting is best-effort; the caller can still speak first.
    }
  }

  /**
   * Handle one inbound 20ms μ-law frame. Runs energy-based VAD to detect the end of an
   * utterance, then transcribes → thinks → speaks the reply (batch per-utterance).
   */
  private handleTwilioMedia(ws: WebSocket, streamSid: string, payloadB64?: string): void {
    const v = this.voice;
    if (!v || !payloadB64) return;
    // Ignore inbound audio while we're transcribing/thinking/speaking (no barge-in).
    if (v.processing) return;

    const FRAME_MS = 20;
    const SPEECH_THRESHOLD = 500; // RMS on decoded PCM16
    const END_SILENCE_MS = 700; // trailing silence that ends an utterance
    const MIN_SPEECH_MS = 300; // ignore blips shorter than this

    const mu = base64ToUint8(payloadB64);
    const pcm = muLawDecode(mu);
    const rms = pcmRms(pcm);

    if (rms > SPEECH_THRESHOLD) {
      v.inSpeech = true;
      v.silenceMs = 0;
      v.speechMs += FRAME_MS;
      v.chunks.push(mu);
    } else if (v.inSpeech) {
      v.silenceMs += FRAME_MS;
      v.chunks.push(mu); // keep trailing silence for a natural cutoff
      if (v.silenceMs >= END_SILENCE_MS) {
        if (v.speechMs >= MIN_SPEECH_MS) {
          const total = v.chunks.reduce((n, c) => n + c.length, 0);
          const utterance = new Uint8Array(total);
          let off = 0;
          for (const c of v.chunks) { utterance.set(c, off); off += c.length; }
          v.processing = true;
          this.ctx.waitUntil(
            this.processUtterance(ws, streamSid, utterance).finally(() => {
              if (this.voice) this.voice.processing = false;
            })
          );
        }
        v.chunks = [];
        v.speechMs = 0;
        v.silenceMs = 0;
        v.inSpeech = false;
      }
    }
  }

  /** Transcribe a μ-law utterance, run the agent, and speak the reply back over the stream. */
  private async processUtterance(ws: WebSocket, streamSid: string, mulaw: Uint8Array): Promise<void> {
    try {
      const settings = await this.getVoiceSettings();
      const registry = createProviderRegistry(this.env as any);

      // μ-law 8kHz → PCM16 → WAV for Sarvam STT.
      const pcm8k = muLawDecode(mulaw);
      const wav = pcm16ToWav(pcm8k, 8000);
      const stt = registry.getSTT();
      const sttResult = await stt.transcribe({ audio: wav, mimeType: 'audio/wav', language: settings.language });
      const transcript = (sttResult?.text || '').trim();
      if (!transcript) return;

      this.broadcast({ type: 'voice:transcript', role: 'user', text: transcript });

      const reply = await this.runAgentTurn(transcript);
      await this.speak(ws, streamSid, reply.content);

      // Track voice usage (metering only — not enforced yet).
      await this.trackVoiceUsage(sttResult?.durationMs ?? 0, 0);
    } catch (err) {
      this.broadcast({ type: 'voice:error', message: (err as Error).message });
    }
  }

  /** Synthesize `text` and stream it back to Twilio as 20ms μ-law media frames. */
  private async speak(ws: WebSocket, streamSid: string, text: string): Promise<void> {
    if (!text) return;
    const settings = await this.getVoiceSettings();
    const registry = createProviderRegistry(this.env as any);
    const tts = registry.getTTS();
    const ttsResult = await tts.synthesize({
      text,
      language: settings.language,
      voiceId: settings.voiceId,
      outputFormat: 'wav',
    });

    const { pcm, sampleRate } = wavToPcm16(ttsResult.audio);
    const pcm8k = resamplePcm16(pcm, sampleRate, 8000);
    const outMu = muLawEncode(pcm8k);

    const FRAME = 160; // 20ms of 8kHz μ-law
    for (let i = 0; i < outMu.length; i += FRAME) {
      const slice = outMu.subarray(i, Math.min(i + FRAME, outMu.length));
      ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload: uint8ToBase64(slice) } }));
    }
    ws.send(JSON.stringify({ event: 'mark', streamSid, mark: { name: `resp-${Date.now()}` } }));

    this.broadcast({ type: 'voice:transcript', role: 'assistant', text });
    await this.trackVoiceUsage(0, ttsResult?.durationMs ?? 0);
  }

  /** Accumulate STT/TTS milliseconds into session state for later billing/analytics. */
  private async trackVoiceUsage(sttMs: number, ttsMs: number): Promise<void> {
    if (!sttMs && !ttsMs) return;
    const state = await this.getState();
    const usage = (state.context.voiceUsage as { sttMs: number; ttsMs: number; utterances: number } | undefined) ?? {
      sttMs: 0,
      ttsMs: 0,
      utterances: 0,
    };
    usage.sttMs += sttMs;
    usage.ttsMs += ttsMs;
    if (sttMs) usage.utterances += 1;
    state.context.voiceUsage = usage;
    state.updatedAt = new Date().toISOString();
    await this.ctx.storage.put('session', state);
    this.broadcast({ type: 'voice:usage', data: usage });
  }

  private async handleWebSocketChatSend(ws: WebSocket, payload: { content: string }): Promise<void> {
    const built = await this.buildRuntime();
    if ('error' in built) {
      ws.send(JSON.stringify({ type: 'error', message: built.error }));
      return;
    }
    const { runtime, runtimeContext, runtimeConfig } = built;

    ws.send(JSON.stringify({
      type: 'typing',
      payload: { isTyping: true }
    }));

    try {
      const messageId = crypto.randomUUID();
      const stream = runtime.streamTurn(payload.content, runtimeContext, runtimeConfig);
      let fullContent = '';

      for await (const chunk of stream) {
        fullContent += chunk;
        ws.send(JSON.stringify({
          type: 'stream',
          payload: {
            id: messageId,
            delta: chunk,
            finished: false
          }
        }));
      }

      ws.send(JSON.stringify({
        type: 'stream',
        payload: {
          id: messageId,
          delta: '',
          finished: true
        }
      }));

      ws.send(JSON.stringify({
        type: 'typing',
        payload: { isTyping: false }
      }));

      ws.send(JSON.stringify({
        type: 'message',
        payload: {
          id: messageId,
          content: fullContent,
          timestamp: Date.now()
        }
      }));

      const state = await this.getState();
      state.messageCount += 2;
      state.lastUserMessage = payload.content;
      state.lastAssistantMessage = fullContent;
      state.updatedAt = new Date().toISOString();
      await this.ctx.storage.put('session', state);
      this.broadcast({ type: 'state:updated', data: state });

    } catch (err) {
      ws.send(JSON.stringify({
        type: 'typing',
        payload: { isTyping: false }
      }));
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: (err as Error).message }
      }));
    }
  }
}
