import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRuntime } from './index';
import { MiddlewareChain, rateLimitMiddleware } from '../middleware';

describe('MiddlewareChain', () => {
  it('should execute registered handlers in order', async () => {
    const chain = new MiddlewareChain();
    const order: number[] = [];

    chain.use(async (ctx, next) => {
      order.push(1);
      await next();
      order.push(4);
    });

    chain.use(async (ctx, next) => {
      order.push(2);
      await next();
      order.push(3);
    });

    await chain.execute({
      tenantId: 't-1',
      agentId: 'a-1',
      conversationId: 'c-1',
      sessionId: 's-1',
      channel: 'chat',
    });

    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('should abort execution if a middleware throws an error', async () => {
    const chain = new MiddlewareChain();
    const mockCheckRateLimit = vi.fn().mockResolvedValue({ allowed: false, remaining: 0 });

    chain.use(rateLimitMiddleware(mockCheckRateLimit));
    chain.use(async (ctx, next) => {
      // Should not be called
      await next();
    });

    await expect(
      chain.execute({
        tenantId: 't-1',
        agentId: 'a-1',
        conversationId: 'c-1',
        sessionId: 's-1',
        channel: 'chat',
      })
    ).rejects.toThrow('Rate limit exceeded');

    expect(mockCheckRateLimit).toHaveBeenCalledWith('t-1');
  });
});

describe('AgentRuntime', () => {
  let mockLLM: any;
  let mockPromptBuilder: any;
  let mockPlanner: any;
  let mockMemory: any;
  let mockKnowledge: any;
  let mockTools: any;
  let mockEventBus: any;
  let mockSessionManager: any;
  let mockLogger: any;

  beforeEach(() => {
    mockLLM = {
      complete: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Hello user' } }],
        usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
      }),
      stream: vi.fn().mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Hello ' } }] };
        yield { choices: [{ delta: { content: 'user' } }] };
      }),
    };

    mockPromptBuilder = {
      buildMessages: vi.fn().mockReturnValue([{ role: 'system', content: 'test' }]),
    };

    mockPlanner = {
      decide: vi.fn().mockResolvedValue({
        decision: 'generate_response',
        confidence: 0.95,
        reasoning: 'Direct response',
      }),
    };

    mockMemory = {
      addMessage: vi.fn().mockResolvedValue(null),
      getConversationHistory: vi.fn().mockResolvedValue({ messages: [] }),
    };

    mockKnowledge = {
      retrieve: vi.fn().mockResolvedValue({ results: [], durationMs: 1 }),
    };

    mockTools = {
      listDefinitions: vi.fn().mockReturnValue([]),
      toLLMTools: vi.fn().mockReturnValue(undefined),
      execute: vi.fn(),
    };

    mockEventBus = {
      createEvent: vi.fn().mockImplementation((type, payload) => ({ type, ...payload })),
      emit: vi.fn().mockResolvedValue(null),
    };

    mockSessionManager = {
      updateSessionState: vi.fn().mockResolvedValue(null),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  it('should successfully run a standard processTurn execution pipeline', async () => {
    const runtime = new AgentRuntime({
      llm: mockLLM,
      promptBuilder: mockPromptBuilder,
      planner: mockPlanner,
      memory: mockMemory,
      knowledge: mockKnowledge,
      tools: mockTools,
      eventBus: mockEventBus,
      sessionManager: mockSessionManager,
      logger: mockLogger,
    });

    const result = await runtime.processTurn(
      'Hi there',
      {
        tenantId: 'tenant-123',
        agentId: 'agent-456',
        conversationId: 'conv-789',
        sessionId: 'sess-abc',
        channel: 'chat',
      },
      {
        model: 'mock-llm',
        temperature: 0.7,
        maxTokens: 100,
        systemPrompt: 'System prompt instructions',
        knowledgeBaseIds: [],
        memoryConfig: { maxMessages: 10, maxTokens: 1000, summaryThreshold: 5 },
        retrievalConfig: { topK: 3, scoreThreshold: 0.5, enableReranking: false },
        enableTools: true,
        enableKnowledge: true,
      }
    );

    expect(result.content).toBe('Hello user');
    expect(mockMemory.addMessage).toHaveBeenCalledWith('conv-789', 'user', 'Hi there', 0);
    expect(mockMemory.addMessage).toHaveBeenCalledWith('conv-789', 'assistant', 'Hello user', 25);
    expect(mockSessionManager.updateSessionState).toHaveBeenCalled();
  });

  it('should successfully stream chunk results in streamTurn', async () => {
    const runtime = new AgentRuntime({
      llm: mockLLM,
      promptBuilder: mockPromptBuilder,
      planner: mockPlanner,
      memory: mockMemory,
      knowledge: mockKnowledge,
      tools: mockTools,
      eventBus: mockEventBus,
      sessionManager: mockSessionManager,
      logger: mockLogger,
    });

    const generator = runtime.streamTurn(
      'Stream query',
      {
        tenantId: 'tenant-123',
        agentId: 'agent-456',
        conversationId: 'conv-789',
        sessionId: 'sess-abc',
        channel: 'chat',
      },
      {
        model: 'mock-llm',
        temperature: 0.7,
        maxTokens: 100,
        systemPrompt: 'System prompt instructions',
        knowledgeBaseIds: [],
        memoryConfig: { maxMessages: 10, maxTokens: 1000, summaryThreshold: 5 },
        retrievalConfig: { topK: 3, scoreThreshold: 0.5, enableReranking: false },
        enableTools: true,
        enableKnowledge: true,
      }
    );

    const chunks: string[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hello ', 'user']);
    expect(mockMemory.addMessage).toHaveBeenCalledWith('conv-789', 'assistant', 'Hello user', 0);
  });
});
