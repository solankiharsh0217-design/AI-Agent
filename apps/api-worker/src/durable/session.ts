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
      this.ctx.acceptWebSocket(ws);
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

    // For all non-init requests, verify tenantId matches
    const storedTenantId = await this.ctx.storage.get<string>('tenantId');
    if (storedTenantId && requestTenantId !== storedTenantId) {
      return this.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this session' } }, 403);
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
            this.broadcast({
              type: 'telephony:call_started',
              callSid: data.start?.callSid,
              streamSid: data.streamSid,
            });
            break;
          case 'media':
            // Telephony raw audio packet - can be piped to STT/TTS in full integration
            break;
          case 'stop':
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

  private async handlePostMessage(body: { content: string; widgetId?: string }): Promise<unknown> {
    try {
      const dbSessionId = await this.ctx.storage.get<string>('dbSessionId');
      if (!dbSessionId) {
        throw new Error('No session ID associated with this Durable Object');
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
        throw new Error('No tenant ID associated with this session');
      }

      const dbSession = await sessionRepo.findById(dbSessionId, tenantId);
      if (!dbSession) {
        throw new Error(`Session not found: ${dbSessionId}`);
      }

      const agent = await agentRepo.findById(dbSession.agentId, dbSession.tenantId);
      if (!agent) {
        throw new Error(`Agent not found: ${dbSession.agentId}`);
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
        model: agentConfig.model || 'llama-3.1-70b-versatile',
        temperature: agentConfig.temperature ?? 0.7,
        maxTokens: agentConfig.maxTokens ?? 2048,
        systemPrompt: agentConfig.systemPrompt || '',
        knowledgeBaseIds: agentConfig.knowledgeBaseIds || [],
        memoryConfig: agentConfig.memoryConfig || { enabled: true, maxMessages: 20, maxTokens: 4000 },
        retrievalConfig: { topK: 3, scoreThreshold: 0.5, enableReranking: false },
        enableTools: agentConfig.tools && agentConfig.tools.length > 0,
        enableKnowledge: agentConfig.knowledgeBaseIds && agentConfig.knowledgeBaseIds.length > 0,
      };

      const result = await runtime.processTurn(body.content, runtimeContext, runtimeConfig);

      const state = await this.getState();
      state.messageCount += 2;
      state.lastUserMessage = body.content;
      state.lastAssistantMessage = result.content;
      state.updatedAt = new Date().toISOString();
      await this.ctx.storage.put('session', state);
      this.broadcast({ type: 'state:updated', data: state });

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

  private async handleWebSocketChatSend(ws: WebSocket, payload: { content: string }): Promise<void> {
    const dbSessionId = await this.ctx.storage.get<string>('dbSessionId');
    if (!dbSessionId) {
      ws.send(JSON.stringify({ type: 'error', message: 'No active session found for this socket' }));
      return;
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
      ws.send(JSON.stringify({ type: 'error', message: 'No tenant ID associated with this session' }));
      return;
    }

    const dbSession = await sessionRepo.findById(dbSessionId, tenantId);
    if (!dbSession) {
      ws.send(JSON.stringify({ type: 'error', message: `Session not found: ${dbSessionId}` }));
      return;
    }

    const agent = await agentRepo.findById(dbSession.agentId, dbSession.tenantId);
    if (!agent) {
      ws.send(JSON.stringify({ type: 'error', message: `Agent not found: ${dbSession.agentId}` }));
      return;
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
      model: agentConfig.model || 'llama-3.1-70b-versatile',
      temperature: agentConfig.temperature ?? 0.7,
      maxTokens: agentConfig.maxTokens ?? 2048,
      systemPrompt: agentConfig.systemPrompt || '',
      knowledgeBaseIds: agentConfig.knowledgeBaseIds || [],
      memoryConfig: agentConfig.memoryConfig || { enabled: true, maxMessages: 20, maxTokens: 4000 },
      retrievalConfig: { topK: 3, scoreThreshold: 0.5, enableReranking: false },
      enableTools: agentConfig.tools && agentConfig.tools.length > 0,
      enableKnowledge: agentConfig.knowledgeBaseIds && agentConfig.knowledgeBaseIds.length > 0,
    };

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
