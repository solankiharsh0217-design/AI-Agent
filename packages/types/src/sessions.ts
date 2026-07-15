import { z } from 'zod';
import { ChannelType, TokenUsage } from './core';

export const SessionStatus = z.enum([
  'created',
  'active',
  'listening',
  'thinking',
  'responding',
  'waiting',
  'ended',
  'expired',
  'error',
]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const ConversationStatus = z.enum(['active', 'ended', 'archived', 'transferred']);
export type ConversationStatus = z.infer<typeof ConversationStatus>;

export const MessageRole = z.enum(['system', 'user', 'assistant', 'tool']);
export type MessageRole = z.infer<typeof MessageRole>;

export const MessageType = z.enum(['text', 'image', 'audio', 'file', 'tool_result', 'system']);
export type MessageType = z.infer<typeof MessageType>;

export const VoiceSessionState = z.object({
  isListening: z.boolean().default(false),
  isSpeaking: z.boolean().default(false),
  partialTranscript: z.string().default(''),
  finalTranscript: z.string().default(''),
  vadState: z.enum(['silence', 'speech', 'endpoint']).default('silence'),
  lastVoiceActivity: z.date().nullable(),
  sttStreamId: z.string().nullable(),
  ttsStreamId: z.string().nullable(),
});
export type VoiceSessionState = z.infer<typeof VoiceSessionState>;

export const PhoneSessionState = z.object({
  callSid: z.string().nullable(),
  streamSid: z.string().nullable(),
  fromNumber: z.string().nullable(),
  toNumber: z.string().nullable(),
  callStatus: z.enum(['initiated', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled']).default('initiated'),
  direction: z.enum(['inbound', 'outbound']).default('inbound'),
  recordingSid: z.string().nullable(),
});
export type PhoneSessionState = z.infer<typeof PhoneSessionState>;

export const SessionMetadata = z.object({
  userId: z.string().uuid().nullable(),
  widgetId: z.string().uuid().nullable(),
  phoneNumberId: z.string().uuid().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  referrer: z.string().nullable(),
  customData: z.record(z.unknown()).default({}),
});
export type SessionMetadata = z.infer<typeof SessionMetadata>;

export const SessionState = z.object({
  messageCount: z.number().int().nonnegative().default(0),
  tokenUsage: TokenUsage.default({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
  }),
  currentTurn: z.number().int().nonnegative().default(0),
  lastUserMessage: z.string().nullable(),
  lastAssistantMessage: z.string().nullable(),
  pendingToolCalls: z.array(z.string()).default([]),
  context: z.record(z.unknown()).default({}),
});
export type SessionState = z.infer<typeof SessionState>;

export const Session = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  agentId: z.string().uuid(),
  conversationId: z.string().uuid(),
  channel: ChannelType,
  status: SessionStatus,
  metadata: SessionMetadata,
  state: SessionState,
  voiceState: VoiceSessionState.nullable(),
  phoneState: PhoneSessionState.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date().nullable(),
  endedAt: z.date().nullable(),
});
export type Session = z.infer<typeof Session>;

export const ConversationMetadata = z.object({
  channel: ChannelType,
  userId: z.string().uuid().nullable(),
  widgetId: z.string().uuid().nullable(),
  phoneNumberId: z.string().uuid().nullable(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({}),
});
export type ConversationMetadata = z.infer<typeof ConversationMetadata>;

export const Conversation = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  agentId: z.string().uuid(),
  sessionId: z.string().uuid().nullable(),
  status: ConversationStatus.default('active'),
  summary: z.string().nullable(),
  messageCount: z.number().int().nonnegative().default(0),
  totalTokens: TokenUsage.default({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
  }),
  metadata: ConversationMetadata.default({
    channel: 'chat',
    userId: null,
    widgetId: null,
    phoneNumberId: null,
    tags: [],
    customFields: {},
  }),
  startedAt: z.date(),
  endedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Conversation = z.infer<typeof Conversation>;

export const ToolCall = z.object({
  id: z.string().uuid(),
  name: z.string(),
  arguments: z.record(z.unknown()),
  result: z.unknown().nullable(),
  error: z.string().nullable(),
});
export type ToolCall = z.infer<typeof ToolCall>;

export const MessageMetadata = z.object({
  channel: ChannelType.nullable(),
  isPartial: z.boolean().default(false),
  confidence: z.number().min(0).max(1).nullable(),
  language: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  attachments: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(['image', 'audio', 'document', 'video']),
    url: z.string().url(),
    name: z.string(),
    size: z.number().int().positive(),
    mimeType: z.string(),
  })).default([]),
  customData: z.record(z.unknown()).default({}),
});
export type MessageMetadata = z.infer<typeof MessageMetadata>;

export const Message = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  sessionId: z.string().uuid().nullable(),
  role: MessageRole,
  content: z.string(),
  type: MessageType.default('text'),
  metadata: MessageMetadata.default({
    channel: null,
    isPartial: false,
    confidence: null,
    language: null,
    durationMs: null,
    attachments: [],
    customData: {},
  }),
  toolCalls: z.array(ToolCall).default([]),
  toolCallId: z.string().nullable(),
  tokens: TokenUsage.nullable(),
  createdAt: z.date(),
});
export type Message = z.infer<typeof Message>;
