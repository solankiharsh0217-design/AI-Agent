import type { LLMProvider, LLMMessage, LLMRequest, LLMResponse } from '@ai-agent/providers';
import { PromptBuilder, PromptContext } from '../prompt';
import { PlannerEngine, PlannerContext, PlannerDecision } from '../planner';
import { MemoryEngine, MemoryConfig } from '../memory';
import { KnowledgeEngine, RetrievalConfig, KnowledgeContext } from '../knowledge';
import { ToolRegistry, ToolCallRequest, ToolCallResult } from '../tools';
import { EventBus, RuntimeEvent } from '../events';
import { SessionManager, SessionState } from '../session';
import { MiddlewareChain } from '../middleware';
import { Logger } from '@ai-agent/shared';

export interface RuntimeConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  knowledgeBaseIds: string[];
  memoryConfig: MemoryConfig;
  retrievalConfig: RetrievalConfig;
  enableTools: boolean;
  enableKnowledge: boolean;
}

export interface RuntimeContext {
  tenantId: string;
  agentId: string;
  conversationId: string;
  sessionId: string;
  channel: string;
  userId?: string;
}

export interface TurnResult {
  content: string;
  toolCalls: ToolCallResult[];
  knowledgeUsed: boolean;
  tokensUsed: number;
  durationMs: number;
}

export class AgentRuntime {
  lastTurnUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  private llm: LLMProvider;
  private promptBuilder: PromptBuilder;
  private planner: PlannerEngine;
  private memory: MemoryEngine;
  private knowledge: KnowledgeEngine;
  private tools: ToolRegistry;
  private eventBus: EventBus;
  private sessionManager: SessionManager;
  private middleware: MiddlewareChain;
  private logger: Logger;

  constructor(deps: {
    llm: LLMProvider;
    promptBuilder: PromptBuilder;
    planner: PlannerEngine;
    memory: MemoryEngine;
    knowledge: KnowledgeEngine;
    tools: ToolRegistry;
    eventBus: EventBus;
    sessionManager: SessionManager;
    middleware?: MiddlewareChain;
    logger: Logger;
  }) {
    this.llm = deps.llm;
    this.promptBuilder = deps.promptBuilder;
    this.planner = deps.planner;
    this.memory = deps.memory;
    this.knowledge = deps.knowledge;
    this.tools = deps.tools;
    this.eventBus = deps.eventBus;
    this.sessionManager = deps.sessionManager;
    this.middleware = deps.middleware ?? new MiddlewareChain();
    this.logger = deps.logger;
  }

  async processTurn(
    userMessage: string,
    context: RuntimeContext,
    config: RuntimeConfig
  ): Promise<TurnResult> {
    const startTime = Date.now();
    this.logger.info('Processing turn', {
      conversationId: context.conversationId,
      channel: context.channel,
    });

    try {
      // Execute middleware
      await this.middleware.execute({
        tenantId: context.tenantId,
        agentId: context.agentId,
        conversationId: context.conversationId,
        sessionId: context.sessionId,
        channel: context.channel,
      });

      // Emit user_message event
      await this.eventBus.emit(this.eventBus.createEvent('user_message', {
        tenantId: context.tenantId,
        conversationId: context.conversationId,
        sessionId: context.sessionId,
        agentId: context.agentId,
        payload: {
          content: userMessage,
          role: 'user',
          channel: context.channel,
        },
        metadata: {},
      }));

      // 1. Store user message with estimated tokens
      const estimatedTokens = Math.ceil(userMessage.length / 4);
      await this.memory.addMessage(context.conversationId, context.tenantId, 'user', userMessage, estimatedTokens);

      // 2. Get conversation history
      const { messages: history } = await this.memory.getConversationHistory(
        context.conversationId,
        context.tenantId,
        config.memoryConfig
      );

      // 3. Run planner
      const plannerContext: PlannerContext = {
        messageCount: history.length,
        hasKnowledgeBases: config.knowledgeBaseIds.length > 0,
        hasTools: this.tools.listDefinitions().length > 0,
        lastMessage: userMessage,
        pendingToolCalls: [],
        tokenUsage: history.reduce((sum, m) => sum + m.tokenCount, 0),
        maxTokens: config.maxTokens,
      };

      const plannerResult = await this.planner.decide(plannerContext);

      // 4. Emit planner decision event
      await this.eventBus.emit(this.eventBus.createEvent('planner_decision', {
        tenantId: context.tenantId,
        conversationId: context.conversationId,
        sessionId: context.sessionId,
        agentId: context.agentId,
        payload: {
          decision: plannerResult.decision,
          reasoning: plannerResult.reasoning,
          confidence: plannerResult.confidence,
        },
        metadata: {},
      }));

      // Handle planner decision
      switch (plannerResult.decision) {
        case 'retrieve_knowledge':
          // Knowledge retrieval will happen below if config enables it
          break;
        case 'execute_tool':
          // Tools will be executed if the LLM returns tool_calls
          break;
        case 'end':
          // If planner says end, return early
          await this.eventBus.emit(this.eventBus.createEvent('session_ended', {
            tenantId: context.tenantId,
            conversationId: context.conversationId,
            sessionId: context.sessionId,
            agentId: context.agentId,
            payload: {
              reason: plannerResult.reasoning,
              durationMs: Date.now() - startTime,
            },
            metadata: {},
          }));
          return {
            content: '',
            toolCalls: [],
            knowledgeUsed: false,
            tokensUsed: 0,
            durationMs: Date.now() - startTime,
          };
        case 'transfer':
          // Transfer logic (future)
          break;
        default:
          break;
      }

      // 5. Execute based on planner decision / configuration
      let knowledgeContext: KnowledgeContext | undefined;
      let toolCalls: ToolCallResult[] = [];

      if (config.enableKnowledge && config.knowledgeBaseIds.length > 0) {
        try {
          knowledgeContext = await this.knowledge.retrieve(
            userMessage,
            config.knowledgeBaseIds,
            config.retrievalConfig,
            context.tenantId
          );

          await this.eventBus.emit(this.eventBus.createEvent('knowledge_retrieved', {
            tenantId: context.tenantId,
            conversationId: context.conversationId,
            sessionId: context.sessionId,
            agentId: context.agentId,
            payload: {
              query: userMessage,
              results: knowledgeContext.results.map(r => ({
                chunkId: r.chunkId,
                score: r.score,
                content: r.content,
              })),
              durationMs: knowledgeContext.durationMs,
            },
            metadata: {},
          }));
        } catch (error) {
          this.logger.warn('Knowledge retrieval failed, continuing without context', { error: (error as Error).message });
        }
      }

      // 6. Build prompt
      const knowledgeText = knowledgeContext?.results
        .map(r => r.content)
        .join('\n\n');

      const formattedHistory = history.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const promptContext: PromptContext = {
        systemPrompt: config.systemPrompt,
        conversationHistory: formattedHistory,
        knowledgeContext: knowledgeText,
        userMessage,
      };

      const messages = this.promptBuilder.buildMessages(promptContext);

      // 7. Call LLM
      const llmRequest: LLMRequest = {
        model: config.model,
        messages,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        tools: config.enableTools ? this.tools.toLLMTools() : undefined,
      };

      const llmResponse = await this.llm.complete(llmRequest);

      // 8. Extract response
      const choice = llmResponse.choices[0];
      if (!choice) {
        throw new Error('LLM returned no choices');
      }
      const assistantContent = choice.message.content ?? '';

      // 9. Handle tool calls if present (parallel execution)
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0 && config.enableTools) {
        const toolPromises = choice.message.tool_calls.map(async (toolCall) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            this.logger.warn('Failed to parse tool call arguments', {
              toolName: toolCall.function.name,
              rawArgs: toolCall.function.arguments,
            });
            return null;
          }
          try {
            return await this.tools.execute(
              {
                id: toolCall.id,
                name: toolCall.function.name,
                arguments: args,
              },
              {
                tenantId: context.tenantId,
                agentId: context.agentId,
                conversationId: context.conversationId,
                sessionId: context.sessionId,
              }
            );
          } catch (error) {
            this.logger.error('Tool execution failed', { tool: toolCall.function.name, error: (error as Error).message });
            return null;
          }
        });

        const results = await Promise.allSettled(toolPromises);
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            toolCalls.push(result.value);
          }
        }
      }

      // 10. Store assistant message with actual token count
      await this.memory.addMessage(
        context.conversationId,
        context.tenantId,
        'assistant',
        assistantContent,
        llmResponse.usage.total_tokens
      );

      // 11. Trim history if too long
      await this.memory.trimHistory(context.conversationId, context.tenantId, config.memoryConfig);

      // 12. Update session state
      const totalTokens = llmResponse.usage.total_tokens;
      this.lastTurnUsage = { promptTokens: llmResponse.usage.prompt_tokens, completionTokens: llmResponse.usage.completion_tokens, totalTokens };
      await this.sessionManager.updateSessionState(context.sessionId, context.tenantId, {
        messageCount: history.length + 2,
        tokenUsage: {
          promptTokens: llmResponse.usage.prompt_tokens,
          completionTokens: llmResponse.usage.completion_tokens,
          totalTokens,
          estimatedCostUsd: (totalTokens / 1_000_000) * 1.0,
        },
        currentTurn: plannerContext.messageCount + 1,
        lastUserMessage: userMessage,
        lastAssistantMessage: assistantContent,
      });

      // 13. Emit assistant message event
      await this.eventBus.emit(this.eventBus.createEvent('assistant_message', {
        tenantId: context.tenantId,
        conversationId: context.conversationId,
        sessionId: context.sessionId,
        agentId: context.agentId,
        payload: {
          content: assistantContent,
          role: 'assistant',
          toolCalls: toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments ?? {},
          })),
        },
        metadata: {},
      }));

      const durationMs = Date.now() - startTime;

      return {
        content: assistantContent,
        toolCalls,
        knowledgeUsed: knowledgeContext !== undefined,
        tokensUsed: llmResponse.usage.total_tokens,
        durationMs,
      };
    } catch (error) {
      this.logger.error('Error processing turn', error as Error, {
        conversationId: context.conversationId,
      });

      await this.eventBus.emit(this.eventBus.createEvent('error', {
        tenantId: context.tenantId,
        conversationId: context.conversationId,
        sessionId: context.sessionId,
        agentId: context.agentId,
        payload: {
          code: 'RUNTIME_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
        metadata: {},
      }));

      throw error;
    }
  }

  async *streamTurn(
    userMessage: string,
    context: RuntimeContext,
    config: RuntimeConfig
  ): AsyncIterable<string> {
    // Execute middleware
    await this.middleware.execute({
      tenantId: context.tenantId,
      agentId: context.agentId,
      conversationId: context.conversationId,
      sessionId: context.sessionId,
      channel: context.channel,
    });

    // Emit user_message event
    await this.eventBus.emit(this.eventBus.createEvent('user_message', {
      tenantId: context.tenantId,
      conversationId: context.conversationId,
      sessionId: context.sessionId,
      agentId: context.agentId,
      payload: {
        content: userMessage,
        role: 'user',
        channel: context.channel,
      },
      metadata: {},
    }));

    // Store user message with estimated tokens
    const estimatedTokens = Math.ceil(userMessage.length / 4);
    await this.memory.addMessage(context.conversationId, context.tenantId, 'user', userMessage, estimatedTokens);

    // Get history
    const { messages: history } = await this.memory.getConversationHistory(
      context.conversationId,
      context.tenantId,
      config.memoryConfig
    );

    // Planner decision
    const plannerContext: PlannerContext = {
      messageCount: history.length,
      hasKnowledgeBases: config.knowledgeBaseIds.length > 0,
      hasTools: this.tools.listDefinitions().length > 0,
      lastMessage: userMessage,
      pendingToolCalls: [],
      tokenUsage: history.reduce((sum, m) => sum + m.tokenCount, 0),
      maxTokens: config.maxTokens,
    };

    const plannerResult = await this.planner.decide(plannerContext);

    await this.eventBus.emit(this.eventBus.createEvent('planner_decision', {
      tenantId: context.tenantId,
      conversationId: context.conversationId,
      sessionId: context.sessionId,
      agentId: context.agentId,
      payload: {
        decision: plannerResult.decision,
        reasoning: plannerResult.reasoning,
        confidence: plannerResult.confidence,
      },
      metadata: {},
    }));

    // Handle planner decision
    switch (plannerResult.decision) {
      case 'end':
        await this.eventBus.emit(this.eventBus.createEvent('session_ended', {
          tenantId: context.tenantId,
          conversationId: context.conversationId,
          sessionId: context.sessionId,
          agentId: context.agentId,
          payload: {
            reason: plannerResult.reasoning,
            durationMs: 0,
          },
          metadata: {},
        }));
        return;
      case 'transfer':
        // Transfer logic (future)
        break;
      default:
        break;
    }

    // Build prompt
    let knowledgeContext: KnowledgeContext | undefined;
    if (config.enableKnowledge && config.knowledgeBaseIds.length > 0) {
      try {
        knowledgeContext = await this.knowledge.retrieve(
          userMessage,
          config.knowledgeBaseIds,
          config.retrievalConfig,
          context.tenantId
        );

        // Emit knowledge_retrieved event
        if (knowledgeContext.results.length > 0) {
          await this.eventBus.emit(this.eventBus.createEvent('knowledge_retrieved', {
            tenantId: context.tenantId,
            conversationId: context.conversationId,
            sessionId: context.sessionId,
            agentId: context.agentId,
            payload: {
              query: userMessage,
              results: knowledgeContext.results.map(c => ({
                chunkId: c.chunkId,
                score: c.score,
                content: c.content,
              })),
              durationMs: knowledgeContext.durationMs,
            },
            metadata: {},
          }));
        }
      } catch (err) {
        this.logger.error('Error retrieving knowledge in streamTurn', err as Error);
      }
    }

    const knowledgeText = knowledgeContext?.results
      .map(r => r.content)
      .join('\n\n');

    const formattedHistory = history.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const promptContext: PromptContext = {
      systemPrompt: config.systemPrompt,
      conversationHistory: formattedHistory,
      knowledgeContext: knowledgeText,
      userMessage,
    };

    const messages = this.promptBuilder.buildMessages(promptContext);

    // Stream from LLM
    const stream = this.llm.stream({
      model: config.model,
      messages,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      stream: true,
    });

    let fullContent = '';
    const toolCallsFromStream: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
    let streamUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          yield delta.content;
        }
        // Capture tool calls from the stream
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) {
              toolCallsFromStream.push({
                id: tc.id,
                name: tc.function?.name ?? '',
                arguments: (() => {
                  try {
                    return tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
                  } catch {
                    return {};
                  }
                })(),
              });
            }
          }
        }
        // Capture usage from the final chunk
        if ('usage' in chunk && chunk.usage) {
          streamUsage = {
            promptTokens: (chunk.usage as any).prompt_tokens ?? 0,
            completionTokens: (chunk.usage as any).completion_tokens ?? 0,
            totalTokens: (chunk.usage as any).total_tokens ?? 0,
          };
        }
      }
    } catch (error) {
      this.logger.error('Stream failed', { error: (error as Error).message });
      await this.eventBus.emit(this.eventBus.createEvent('error', {
        tenantId: context.tenantId,
        conversationId: context.conversationId,
        sessionId: context.sessionId,
        agentId: context.agentId,
        payload: {
          code: 'STREAM_FAILED',
          message: (error as Error).message,
        },
        metadata: {},
      }));
      throw error;
    }

    // Handle any tool calls from the stream (parallel execution)
    let streamToolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown>; result: unknown }> = [];
    if (toolCallsFromStream.length > 0 && config.enableTools) {
      const toolPromises = toolCallsFromStream.map(async (toolCall) => {
        try {
          const result = await this.tools.execute({
            id: toolCall.id,
            name: toolCall.name,
            arguments: toolCall.arguments,
          }, {
            tenantId: context.tenantId,
            agentId: context.agentId,
            conversationId: context.conversationId,
            sessionId: context.sessionId,
          });

          await this.eventBus.emit(this.eventBus.createEvent('tool_result', {
            tenantId: context.tenantId,
            conversationId: context.conversationId,
            sessionId: context.sessionId,
            agentId: context.agentId,
            payload: {
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              result: result.result,
              error: result.error,
            },
            metadata: {},
          }));
          return result;
        } catch (error) {
          this.logger.error('Tool execution failed', { tool: toolCall.name, error: (error as Error).message });
          return null;
        }
      });
      const toolResults = await Promise.allSettled(toolPromises);
      for (const r of toolResults) {
        if (r.status === 'fulfilled' && r.value) {
          streamToolCalls.push(r.value);
        }
      }
    }

    // Store complete response
    await this.memory.addMessage(context.conversationId, context.tenantId, 'assistant', fullContent, streamUsage.totalTokens);

    // Emit assistant_message event
    await this.eventBus.emit(this.eventBus.createEvent('assistant_message', {
      tenantId: context.tenantId,
      conversationId: context.conversationId,
      sessionId: context.sessionId,
      agentId: context.agentId,
      payload: {
        content: fullContent,
        role: 'assistant',
        toolCalls: streamToolCalls.map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        })),
      },
      metadata: {},
    }));

    // Trim history if too long
    await this.memory.trimHistory(context.conversationId, context.tenantId, config.memoryConfig);

    this.lastTurnUsage = streamUsage;

    // Update session state
    const streamTotalTokens = streamUsage.totalTokens;
    await this.sessionManager.updateSessionState(context.sessionId, context.tenantId, {
      messageCount: history.length + 2,
      tokenUsage: {
        promptTokens: streamUsage.promptTokens,
        completionTokens: streamUsage.completionTokens,
        totalTokens: streamTotalTokens,
        estimatedCostUsd: (streamTotalTokens / 1_000_000) * 1.0,
      },
      currentTurn: plannerContext.messageCount + 1,
      lastUserMessage: userMessage,
      lastAssistantMessage: fullContent,
      pendingToolCalls: [],
      context: {},
    });
  }
}
