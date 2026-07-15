import { generateId } from '../helpers';

export interface BaseEvent {
  id: string;
  type: string;
  tenantId: string;
  conversationId: string;
  sessionId: string;
  agentId: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface UserMessageEvent extends BaseEvent {
  type: 'user_message';
  payload: {
    content: string;
    role: 'user';
    channel: string;
  };
}

export interface AssistantMessageEvent extends BaseEvent {
  type: 'assistant_message';
  payload: {
    content: string;
    role: 'assistant';
    toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  };
}

export interface ToolCallEvent extends BaseEvent {
  type: 'tool_call';
  payload: {
    toolCallId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  };
}

export interface ToolResultEvent extends BaseEvent {
  type: 'tool_result';
  payload: {
    toolCallId: string;
    toolName: string;
    result: unknown;
    error?: string;
  };
}

export interface KnowledgeRetrievedEvent extends BaseEvent {
  type: 'knowledge_retrieved';
  payload: {
    query: string;
    results: Array<{ chunkId: string; score: number; content: string }>;
    durationMs: number;
  };
}

export interface PlannerDecisionEvent extends BaseEvent {
  type: 'planner_decision';
  payload: {
    decision: 'answer' | 'retrieve_knowledge' | 'execute_tool' | 'transfer' | 'end';
    reasoning: string;
    confidence: number;
  };
}

export interface SessionCreatedEvent extends BaseEvent {
  type: 'session_created';
  payload: {
    channel: string;
  };
}

export interface SessionEndedEvent extends BaseEvent {
  type: 'session_ended';
  payload: {
    reason: string;
    durationMs: number;
  };
}

export interface ErrorEvent extends BaseEvent {
  type: 'error';
  payload: {
    code: string;
    message: string;
    stack?: string;
  };
}

export type RuntimeEvent =
  | UserMessageEvent
  | AssistantMessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | KnowledgeRetrievedEvent
  | PlannerDecisionEvent
  | SessionCreatedEvent
  | SessionEndedEvent
  | ErrorEvent;

export type EventHandler = (event: RuntimeEvent) => void | Promise<void>;

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private globalHandlers: EventHandler[] = [];

  on(type: string, handler: EventHandler) {
    const handlers = this.handlers.get(type) ?? [];
    handlers.push(handler);
    this.handlers.set(type, handlers);
  }

  onAll(handler: EventHandler) {
    this.globalHandlers.push(handler);
  }

  off(type: string, handler: EventHandler) {
    const handlers = this.handlers.get(type) ?? [];
    this.handlers.set(type, handlers.filter(h => h !== handler));
  }

  async emit(event: RuntimeEvent): Promise<void> {
    const typeHandlers = this.handlers.get(event.type) ?? [];
    const allHandlers = this.globalHandlers;
    const handlers = [...typeHandlers, ...allHandlers];

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Event handler error for ${event.type}:`, error);
        // Don't swallow errors for critical events
        if (['error', 'system_error'].includes(event.type)) {
          throw error;
        }
      }
    }
  }

  createEvent<T extends RuntimeEvent['type']>(
    type: T,
    data: Omit<Extract<RuntimeEvent, { type: T }>, 'id' | 'type' | 'timestamp'>
  ): Extract<RuntimeEvent, { type: T }> {
    return {
      ...data,
      id: generateId(),
      type,
      timestamp: new Date(),
    } as Extract<RuntimeEvent, { type: T }>;
  }
}
