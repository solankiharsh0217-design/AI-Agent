import { z } from 'zod';

export const TenantStatus = z.enum(['active', 'suspended', 'deleted']);
export type TenantStatus = z.infer<typeof TenantStatus>;

export const UserRole = z.enum(['owner', 'admin', 'member', 'viewer']);
export type UserRole = z.infer<typeof UserRole>;

export const FeatureFlags = z.object({
  voiceEnabled: z.boolean().default(true),
  phoneEnabled: z.boolean().default(false),
  apiEnabled: z.boolean().default(false),
  whatsappEnabled: z.boolean().default(false),
  slackEnabled: z.boolean().default(false),
});
export type FeatureFlags = z.infer<typeof FeatureFlags>;

export const TenantLimits = z.object({
  maxAgents: z.number().int().positive().default(10),
  maxKnowledgeBases: z.number().int().positive().default(5),
  maxDocumentsPerKb: z.number().int().positive().default(100),
  maxMonthlyMessages: z.number().int().positive().default(10000),
  maxMonthlyVoiceMinutes: z.number().int().positive().default(100),
  maxMonthlyPhoneMinutes: z.number().int().positive().default(0),
  maxStorageMb: z.number().int().positive().default(1000),
  maxVectorDimensions: z.number().int().positive().default(1536),
});
export type TenantLimits = z.infer<typeof TenantLimits>;

export const LanguageCode = z.enum([
  'en-US', 'en-IN', 'en-GB',
  'hi-IN', 'ta-IN', 'te-IN', 'bn-IN', 'mr-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'pa-IN',
  'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN',
]);
export type LanguageCode = z.infer<typeof LanguageCode>;

export const STTProvider = z.enum(['sarvam', 'deepgram', 'assemblyai', 'gladia', 'openai']);
export type STTProvider = z.infer<typeof STTProvider>;

export const TTSProvider = z.enum(['sarvam', 'elevenlabs', 'cartesia', 'playht', 'azure', 'openai']);
export type TTSProvider = z.infer<typeof TTSProvider>;

export const VoiceConfig = z.object({
  enabled: z.boolean().default(false),
  sttProvider: STTProvider.default('sarvam'),
  ttsProvider: TTSProvider.default('sarvam'),
  language: LanguageCode.default('en-IN'),
  voiceId: z.string().nullable(),
  speed: z.number().min(0.5).max(2).default(1.0),
  vadEnabled: z.boolean().default(true),
  vadSensitivity: z.number().min(0).max(1).default(0.5),
});
export type VoiceConfig = z.infer<typeof VoiceConfig>;

export const TenantSettings = z.object({
  defaultAgentId: z.string().uuid().nullable(),
  defaultVoiceConfig: VoiceConfig.nullable(),
  features: FeatureFlags,
  limits: TenantLimits,
});
export type TenantSettings = z.infer<typeof TenantSettings>;

export const Tenant = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  status: TenantStatus.default('active'),
  settings: TenantSettings,
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});
export type Tenant = z.infer<typeof Tenant>;

export const User = z.object({
  id: z.string().uuid(),
  clerkId: z.string(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: UserRole,
  avatarUrl: z.string().url().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type User = z.infer<typeof User>;

export const TokenUsage = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative().default(0),
});
export type TokenUsage = z.infer<typeof TokenUsage>;

export const ChannelType = z.enum(['chat', 'voice', 'phone', 'api', 'whatsapp', 'slack', 'teams']);
export type ChannelType = z.infer<typeof ChannelType>;

export const ErrorCode = z.enum([
  'AUTH_REQUIRED',
  'INVALID_TOKEN',
  'TENANT_NOT_FOUND',
  'AGENT_NOT_FOUND',
  'SESSION_NOT_FOUND',
  'CONVERSATION_NOT_FOUND',
  'KNOWLEDGE_BASE_NOT_FOUND',
  'DOCUMENT_NOT_FOUND',
  'VECTOR_FAILURE',
  'LLM_FAILURE',
  'STT_FAILURE',
  'TTS_FAILURE',
  'TOOL_FAILURE',
  'RATE_LIMITED',
  'QUOTA_EXCEEDED',
  'INVALID_REQUEST',
  'INTERNAL_ERROR',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_AUTH_FAILED',
  'PROVIDER_RATE_LIMITED',
  'PROVIDER_ERROR',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'GATEWAY_TIMEOUT',
  'TOKEN_EXPIRED',
  'INSUFFICIENT_PERMISSIONS',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiResponse = z.object({
  success: z.boolean(),
  data: z.unknown().nullable(),
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    requestId: z.string().uuid(),
  }).nullable(),
});
export type ApiResponse = z.infer<typeof ApiResponse>;

export const PaginationParams = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().nullable(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type PaginationParams = z.infer<typeof PaginationParams>;

export const PaginatedResponse = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    meta: z.object({
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      totalPages: z.number().int().nonnegative(),
    }),
  });
