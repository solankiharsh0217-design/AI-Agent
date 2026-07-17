import { z } from 'zod';
import { UserRole, VoiceConfig, LanguageCode } from './core';

export const AgentModel = z.enum([
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
  // Legacy Groq ids kept for backward-compat with stored configs (decommissioned upstream)
  'llama-3.1-70b-versatile',
  'mixtral-8x7b-32768',
  'gemma-7b-it',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3-5-sonnet',
  'claude-3-haiku',
  'gemini-1.5-pro',
]);
export type AgentModel = z.infer<typeof AgentModel>;

export const AgentProvider = z.enum(['groq', 'openai', 'anthropic', 'google']);
export type AgentProvider = z.infer<typeof AgentProvider>;

export const AgentStatus = z.enum(['draft', 'published', 'archived', 'deleted']);
export type AgentStatus = z.infer<typeof AgentStatus>;

export const ResponseFormat = z.object({
  type: z.enum(['text', 'json_object', 'json_schema']).default('text'),
  schema: z.record(z.unknown()).nullable(),
});
export type ResponseFormat = z.infer<typeof ResponseFormat>;

export const CustomGuardrailRule = z.object({
  id: z.string(),
  name: z.string(),
  pattern: z.string(),
  action: z.enum(['block', 'flag', 'rewrite']),
  message: z.string().nullable(),
});
export type CustomGuardrailRule = z.infer<typeof CustomGuardrailRule>;

export const GuardrailConfig = z.object({
  enabled: z.boolean().default(true),
  piiDetection: z.boolean().default(true),
  profanityFilter: z.boolean().default(true),
  topicRestrictions: z.array(z.string()).default([]),
  customRules: z.array(CustomGuardrailRule).default([]),
});
export type GuardrailConfig = z.infer<typeof GuardrailConfig>;

export const MemoryConfig = z.object({
  enabled: z.boolean().default(true),
  maxMessages: z.number().int().positive().default(20),
  maxTokens: z.number().int().positive().default(4000),
  summaryThreshold: z.number().int().positive().default(10),
  summaryModel: AgentModel.nullable(),
});
export type MemoryConfig = z.infer<typeof MemoryConfig>;

export const ToolConfig = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.unknown()),
  enabled: z.boolean().default(true),
  requireConfirmation: z.boolean().default(false),
});
export type ToolConfig = z.infer<typeof ToolConfig>;

export const AgentConfig = z.object({
  model: AgentModel.default('llama-3.3-70b-versatile'),
  provider: AgentProvider.default('groq'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().positive().max(32768).default(4096),
  systemPrompt: z.string().min(1).max(50000).default('You are a helpful AI assistant.'),
  tools: z.array(ToolConfig).default([]),
  knowledgeBaseIds: z.array(z.string().uuid()).default([]),
  memoryConfig: MemoryConfig.optional().default({
    enabled: true,
    maxMessages: 20,
    maxTokens: 4000,
    summaryThreshold: 10,
    summaryModel: null,
  }),
  voiceConfig: VoiceConfig.nullable().default(null),
  responseFormat: ResponseFormat.optional().default({
    type: 'text',
    schema: null,
  }),
  guardrails: GuardrailConfig.optional().default({
    enabled: true,
    piiDetection: true,
    profanityFilter: true,
    topicRestrictions: [],
    customRules: [],
  }),
});
export type AgentConfig = z.infer<typeof AgentConfig>;

export const Agent = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable(),
  config: AgentConfig,
  status: AgentStatus.default('draft'),
  version: z.number().int().positive().default(1),
  publishedVersion: z.number().int().positive().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});
export type Agent = z.infer<typeof Agent>;

export const CreateAgentRequest = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable(),
  config: AgentConfig,
});
export type CreateAgentRequest = z.infer<typeof CreateAgentRequest>;

export const UpdateAgentRequest = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  config: AgentConfig.partial().optional(),
});
export type UpdateAgentRequest = z.infer<typeof UpdateAgentRequest>;
