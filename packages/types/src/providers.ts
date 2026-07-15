import { z } from 'zod';

export const ProviderType = z.enum(['llm', 'stt', 'tts', 'embedding', 'telephony']);
export type ProviderType = z.infer<typeof ProviderType>;

export const ProviderStatus = z.enum(['healthy', 'degraded', 'down', 'unknown']);
export type ProviderStatus = z.infer<typeof ProviderStatus>;

export const GroqConfig = z.object({
  apiKey: z.string(),
  baseUrl: z.string().url().default('https://api.groq.com/openai/v1'),
  timeout: z.number().int().positive().default(30000),
});
export type GroqConfig = z.infer<typeof GroqConfig>;

export const OpenAIConfig = z.object({
  apiKey: z.string(),
  baseUrl: z.string().url().default('https://api.openai.com/v1'),
  organization: z.string().nullable(),
  timeout: z.number().int().positive().default(60000),
});
export type OpenAIConfig = z.infer<typeof OpenAIConfig>;

export const AnthropicConfig = z.object({
  apiKey: z.string(),
  baseUrl: z.string().url().default('https://api.anthropic.com'),
  timeout: z.number().int().positive().default(60000),
});
export type AnthropicConfig = z.infer<typeof AnthropicConfig>;

export const SarvamConfig = z.object({
  apiKey: z.string(),
  baseUrl: z.string().url().default('https://api.sarvam.ai'),
  timeout: z.number().int().positive().default(30000),
});
export type SarvamConfig = z.infer<typeof SarvamConfig>;

export const DeepgramConfig = z.object({
  apiKey: z.string(),
  baseUrl: z.string().url().default('https://api.deepgram.com/v1'),
  timeout: z.number().int().positive().default(30000),
});
export type DeepgramConfig = z.infer<typeof DeepgramConfig>;

export const ElevenLabsConfig = z.object({
  apiKey: z.string(),
  baseUrl: z.string().url().default('https://api.elevenlabs.io/v1'),
  timeout: z.number().int().positive().default(60000),
});
export type ElevenLabsConfig = z.infer<typeof ElevenLabsConfig>;

export const WorkersAIConfig = z.object({
  accountId: z.string(),
  apiToken: z.string(),
  baseUrl: z.string().url().nullable(),
  timeout: z.number().int().positive().default(30000),
});
export type WorkersAIConfig = z.infer<typeof WorkersAIConfig>;

export const TwilioConfig = z.object({
  accountSid: z.string(),
  authToken: z.string(),
  webhookBaseUrl: z.string().url(),
  timeout: z.number().int().positive().default(30000),
});
export type TwilioConfig = z.infer<typeof TwilioConfig>;

export const ProviderConfig = z.discriminatedUnion('type', [
  z.object({ type: z.literal('llm'), name: z.enum(['groq', 'openai', 'anthropic', 'google']), config: z.record(z.unknown()) }),
  z.object({ type: z.literal('stt'), name: z.enum(['sarvam', 'deepgram', 'assemblyai']), config: z.record(z.unknown()) }),
  z.object({ type: z.literal('tts'), name: z.enum(['sarvam', 'elevenlabs', 'cartesia']), config: z.record(z.unknown()) }),
  z.object({ type: z.literal('embedding'), name: z.enum(['workers-ai', 'voyage', 'openai']), config: z.record(z.unknown()) }),
  z.object({ type: z.literal('telephony'), name: z.enum(['twilio', 'exotel']), config: z.record(z.unknown()) }),
]);
export type ProviderConfig = z.infer<typeof ProviderConfig>;

export const LLMMessage = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().nullable(),
  toolCallId: z.string().nullable(),
});
export type LLMMessage = z.infer<typeof LLMMessage>;

export const LLMChoice = z.object({
  index: z.number().int().nonnegative(),
  message: LLMMessage,
  finishReason: z.enum(['stop', 'length', 'tool_calls', 'content_filter']).nullable(),
});
export type LLMChoice = z.infer<typeof LLMChoice>;

export const LLMResponse = z.object({
  id: z.string(),
  model: z.string(),
  choices: z.array(LLMChoice),
  usage: z.object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }),
});
export type LLMResponse = z.infer<typeof LLMResponse>;

export const LLMChunk = z.object({
  id: z.string(),
  model: z.string(),
  choices: z.array(z.object({
    index: z.number().int().nonnegative(),
    delta: z.object({
      content: z.string().nullable(),
    }),
    finishReason: z.enum(['stop', 'length', 'tool_calls', 'content_filter']).nullable(),
  })),
});
export type LLMChunk = z.infer<typeof LLMChunk>;

export const STTResult = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1).nullable(),
  language: z.string().nullable(),
  durationMs: z.number().int().nonnegative(),
  isFinal: z.boolean(),
});
export type STTResult = z.infer<typeof STTResult>;

export const TTSResult = z.object({
  audio: z.instanceof(Uint8Array),
  format: z.object({
    encoding: z.enum(['mulaw', 'alaw', 'pcm', 'opus', 'mp3', 'wav']),
    sampleRate: z.number().int().positive(),
    channels: z.number().int().positive(),
  }),
  durationMs: z.number().int().nonnegative().nullable(),
});
export type TTSResult = z.infer<typeof TTSResult>;

export const EmbeddingRequest = z.object({
  texts: z.array(z.string().min(1)).min(1).max(100),
  model: z.string().nullable(),
});
export type EmbeddingRequest = z.infer<typeof EmbeddingRequest>;

export const EmbeddingResponse = z.object({
  embeddings: z.array(z.array(z.number())),
  model: z.string(),
});
export type EmbeddingResponse = z.infer<typeof EmbeddingResponse>;

export const PhoneNumber = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid E.164 phone number'),
  friendlyName: z.string().nullable(),
  capabilities: z.object({
    voice: z.boolean().default(true),
    sms: z.boolean().default(false),
  }).default({}),
  status: z.enum(['available', 'assigned', 'released']).default('available'),
  agentId: z.string().uuid().nullable(),
  monthlyCost: z.number().nonnegative(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type PhoneNumber = z.infer<typeof PhoneNumber>;

export const Call = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  phoneNumberId: z.string().uuid(),
  agentId: z.string().uuid().nullable(),
  direction: z.enum(['inbound', 'outbound']),
  from: z.string(),
  to: z.string(),
  status: z.enum(['initiated', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled']).default('initiated'),
  duration: z.number().int().nonnegative().default(0),
  recordingUrl: z.string().url().nullable(),
  cost: z.number().nonnegative().default(0),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  createdAt: z.date(),
});
export type Call = z.infer<typeof Call>;
