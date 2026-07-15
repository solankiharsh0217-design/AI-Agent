import { z } from 'zod';
import { ChannelType, TokenUsage } from './core';
import { SessionStatus, SessionState } from './sessions';

export const ConversationStartedEvent = z.object({
  type: z.literal('conversation.started'),
  eventId: z.string().uuid(),
  timestamp: z.date(),
  tenantId: z.string().uuid(),
  conversationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  channel: ChannelType,
  metadata: z.record(z.unknown()).default({}),
});
export type ConversationStartedEvent = z.infer<typeof ConversationStartedEvent>;

export const ConversationEndedEvent = z.object({
  type: z.literal('conversation.ended'),
  eventId: z.string().uuid(),
  timestamp: z.date(),
  tenantId: z.string().uuid(),
  conversationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  reason: z.enum(['user_ended', 'agent_ended', 'timeout', 'error', 'transferred', 'max_turns']),
  durationMs: z.number().int().nonnegative(),
  messageCount: z.number().int().nonnegative(),
  totalTokens: TokenUsage,
});
export type ConversationEndedEvent = z.infer<typeof ConversationEndedEvent>;

export const UserMessageEvent = z.object({
  type: z.literal('user.message'),
  eventId: z.string().uuid(),
  timestamp: z.date(),
  tenantId: z.string().uuid(),
  conversationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  messageId: z.string().uuid(),
  content: z.string(),
  channel: ChannelType,
});
export type UserMessageEvent = z.infer<typeof UserMessageEvent>;

export const AssistantMessageEvent = z.object({
  type: z.literal('assistant.message'),
  eventId: z.string().uuid(),
  timestamp: z.date(),
  tenantId: z.string().uuid(),
  conversationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  messageId: z.string().uuid(),
  content: z.string(),
  tokens: z.number().int().nonnegative(),
  model: z.string(),
  finishReason: z.enum(['stop', 'length', 'tool_calls', 'content_filter', 'error']),
});
export type AssistantMessageEvent = z.infer<typeof AssistantMessageEvent>;

export const ToolCallRequestedEvent = z.object({
  type: z.literal('tool.call.requested'),
  eventId: z.string().uuid(),
  timestamp: z.date(),
  tenantId: z.string().uuid(),
  conversationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  toolCallId: z.string().uuid(),
  toolName: z.string(),
  arguments: z.record(z.unknown()),
});
export type ToolCallRequestedEvent = z.infer<typeof ToolCallRequestedEvent>;

export const ToolCallCompletedEvent = z.object({
  type: z.literal('tool.call.completed'),
  eventId: z.string().uuid(),
  timestamp: z.date(),
  tenantId: z.string().uuid(),
  conversationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  toolCallId: z.string().uuid(),
  toolName: z.string(),
  result: z.unknown().nullable(),
  error: z.string().nullable(),
  durationMs: z.number().int().nonnegative(),
});
export type ToolCallCompletedEvent = z.infer<typeof ToolCallCompletedEvent>;

export const KnowledgeRetrievedEvent = z.object({
  type: z.literal('knowledge.retrieved'),
  eventId: z.string().uuid(),
  timestamp: z.date(),
  tenantId: z.string().uuid(),
  conversationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  knowledgeBaseIds: z.array(z.string().uuid()),
  query: z.string(),
  results: z.array(z.object({
    chunkId: z.string().uuid(),
    documentId: z.string().uuid(),
    knowledgeBaseId: z.string().uuid(),
    content: z.string(),
    score: z.number().min(0).max(1),
  })),
  durationMs: z.number().int().nonnegative(),
});
export type KnowledgeRetrievedEvent = z.infer<typeof KnowledgeRetrievedEvent>;

export const ErrorOccurredEvent = z.object({
  type: z.literal('error.occurred'),
  eventId: z.string().uuid(),
  timestamp: z.date(),
  tenantId: z.string().uuid(),
  conversationId: z.string().uuid().nullable(),
  sessionId: z.string().uuid().nullable(),
  agentId: z.string().uuid().nullable(),
  code: z.string(),
  message: z.string(),
  stage: z.enum([
    'authentication', 'session_load', 'memory_load', 'planning',
    'knowledge_retrieval', 'tool_execution', 'prompt_build',
    'llm_call', 'response_validation', 'persistence', 'streaming'
  ]),
  recoverable: z.boolean().default(true),
});
export type ErrorOccurredEvent = z.infer<typeof ErrorOccurredEvent>;

export const HumanHandoffRequestedEvent = z.object({
  type: z.literal('human_handoff.requested'),
  eventId: z.string().uuid(),
  timestamp: z.date(),
  tenantId: z.string().uuid(),
  conversationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  reason: z.enum(['user_requested', 'agent_uncertain', 'policy_violation', 'technical_error', 'escalation_required', 'out_of_scope']),
  summary: z.string(),
});
export type HumanHandoffRequestedEvent = z.infer<typeof HumanHandoffRequestedEvent>;

export const VoiceTranscriptEvent = z.object({
  type: z.literal('voice.transcript'),
  eventId: z.string().uuid(),
  timestamp: z.date(),
  tenantId: z.string().uuid(),
  conversationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  transcript: z.string(),
  isPartial: z.boolean().default(false),
  confidence: z.number().min(0).max(1).nullable(),
  language: z.string().nullable(),
});
export type VoiceTranscriptEvent = z.infer<typeof VoiceTranscriptEvent>;

export const PhoneTranscriptEvent = z.object({
  type: z.literal('phone.transcript'),
  eventId: z.string().uuid(),
  timestamp: z.date(),
  tenantId: z.string().uuid(),
  conversationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  transcript: z.string(),
  isPartial: z.boolean().default(false),
  confidence: z.number().min(0).max(1).nullable(),
  language: z.string().nullable(),
  callSid: z.string(),
  streamSid: z.string(),
});
export type PhoneTranscriptEvent = z.infer<typeof PhoneTranscriptEvent>;

export const RuntimeEvent = z.discriminatedUnion('type', [
  ConversationStartedEvent,
  ConversationEndedEvent,
  UserMessageEvent,
  AssistantMessageEvent,
  ToolCallRequestedEvent,
  ToolCallCompletedEvent,
  KnowledgeRetrievedEvent,
  ErrorOccurredEvent,
  HumanHandoffRequestedEvent,
  VoiceTranscriptEvent,
  PhoneTranscriptEvent,
]);
export type RuntimeEvent = z.infer<typeof RuntimeEvent>;

export const PlannerDecision = z.discriminatedUnion('type', [
  z.object({ type: z.literal('answer'), prompt: z.string(), confidence: z.number().min(0).max(1) }),
  z.object({ type: z.literal('retrieve'), query: z.string(), knowledgeBaseIds: z.array(z.string().uuid()), confidence: z.number().min(0).max(1) }),
  z.object({ type: z.literal('tool'), tool: z.string(), args: z.record(z.unknown()), confidence: z.number().min(0).max(1) }),
  z.object({ type: z.literal('workflow'), workflowId: z.string().uuid(), input: z.record(z.unknown()), confidence: z.number().min(0).max(1) }),
  z.object({ type: z.literal('handoff'), reason: z.enum(['user_requested', 'agent_uncertain', 'policy_violation', 'technical_error', 'escalation_required', 'out_of_scope']), summary: z.string(), confidence: z.number().min(0).max(1) }),
]);
export type PlannerDecision = z.infer<typeof PlannerDecision>;

export const PlannerContext = z.object({
  session: SessionState,
  agentConfig: z.record(z.unknown()),
  recentMessages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string(),
  })),
  availableTools: z.array(z.string()),
  availableKnowledgeBases: z.array(z.string().uuid()),
  channel: ChannelType,
});
export type PlannerContext = z.infer<typeof PlannerContext>;

export const RuntimeResponse = z.object({
  events: z.array(RuntimeEvent),
  streaming: z.boolean().default(false),
  streamId: z.string().nullable(),
});
export type RuntimeResponse = z.infer<typeof RuntimeResponse>;
