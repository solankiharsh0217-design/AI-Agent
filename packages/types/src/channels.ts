import { z } from 'zod';

export const AudioFormat = z.object({
  encoding: z.enum(['mulaw', 'alaw', 'pcm', 'opus', 'mp3', 'wav']).default('mulaw'),
  sampleRate: z.number().int().positive().default(8000),
  channels: z.number().int().positive().default(1),
});
export type AudioFormat = z.infer<typeof AudioFormat>;

export const RateLimitConfig = z.object({
  requestsPerMinute: z.number().int().positive().default(60),
  requestsPerHour: z.number().int().positive().default(1000),
  burstAllowance: z.number().int().nonnegative().default(10),
});
export type RateLimitConfig = z.infer<typeof RateLimitConfig>;

export const ChatChannelConfig = z.object({
  streaming: z.boolean().default(true),
  typingIndicator: z.boolean().default(true),
  maxConcurrentStreams: z.number().int().positive().default(100),
  rateLimit: RateLimitConfig.default({}),
});
export type ChatChannelConfig = z.infer<typeof ChatChannelConfig>;

export const VoiceChannelConfig = z.object({
  language: z.string().default('en-IN'),
  vadEnabled: z.boolean().default(true),
  noiseSuppression: z.boolean().default(true),
  echoCancellation: z.boolean().default(true),
  maxSessionDuration: z.number().int().positive().default(3600),
  rateLimit: RateLimitConfig.default({}),
});
export type VoiceChannelConfig = z.infer<typeof VoiceChannelConfig>;

export const PhoneChannelConfig = z.object({
  recordingEnabled: z.boolean().default(false),
  transcriptionEnabled: z.boolean().default(true),
  maxCallDuration: z.number().int().positive().default(7200),
  transferEnabled: z.boolean().default(true),
  dtmfEnabled: z.boolean().default(true),
});
export type PhoneChannelConfig = z.infer<typeof PhoneChannelConfig>;

export const APIChannelConfig = z.object({
  authentication: z.enum(['api_key', 'jwt', 'none']).default('api_key'),
  rateLimit: RateLimitConfig.default({}),
  cors: z.object({
    allowedOrigins: z.array(z.string()).default(['*']),
    allowCredentials: z.boolean().default(false),
  }).default({}),
});
export type APIChannelConfig = z.infer<typeof APIChannelConfig>;

export const ChannelConfig = z.union([
  z.object({ type: z.literal('chat'), config: ChatChannelConfig }),
  z.object({ type: z.literal('voice'), config: VoiceChannelConfig }),
  z.object({ type: z.literal('phone'), config: PhoneChannelConfig }),
  z.object({ type: z.literal('api'), config: APIChannelConfig }),
]);
export type ChannelConfig = z.infer<typeof ChannelConfig>;
