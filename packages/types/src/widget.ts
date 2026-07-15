import { z } from 'zod';

export const WidgetStatus = z.enum(['active', 'inactive', 'deleted']);
export type WidgetStatus = z.infer<typeof WidgetStatus>;

export const WidgetTheme = z.object({
  mode: z.enum(['light', 'dark', 'system']).default('system'),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#64748B'),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#FFFFFF'),
  surfaceColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#F8FAFC'),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#1E293B'),
  borderRadius: z.number().int().nonnegative().default(12),
  fontFamily: z.string().default('system-ui, -apple-system, sans-serif'),
  customCSS: z.string().nullable().default(null),
});
export type WidgetTheme = z.infer<typeof WidgetTheme>;

export const WidgetFeatures = z.object({
  chat: z.boolean().default(true),
  voice: z.boolean().default(false),
  attachments: z.boolean().default(false),
  markdown: z.boolean().default(true),
  copyMessages: z.boolean().default(true),
  typingIndicator: z.boolean().default(true),
  suggestedPrompts: z.boolean().default(true),
});
export type WidgetFeatures = z.infer<typeof WidgetFeatures>;

export const WidgetChatConfig = z.object({
  placeholder: z.string().default('Type a message...'),
  greeting: z.string().nullable().default(null),
  suggestedPrompts: z.array(z.string()).default([]),
  maxMessageLength: z.number().int().positive().default(4000),
  streaming: z.boolean().default(true),
  enterToSend: z.boolean().default(true),
});
export type WidgetChatConfig = z.infer<typeof WidgetChatConfig>;

export const WidgetVoiceConfig = z.object({
  enabled: z.boolean().default(false),
  language: z.string().default('en-IN'),
  voiceId: z.string().nullable().default(null),
  vadSensitivity: z.number().min(0).max(1).default(0.5),
  showVisualizer: z.boolean().default(true),
  pushToTalk: z.boolean().default(false),
});
export type WidgetVoiceConfig = z.infer<typeof WidgetVoiceConfig>;

export const WidgetBehavior = z.object({
  position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).default('bottom-right'),
  offsetX: z.number().int().default(20),
  offsetY: z.number().int().default(20),
  autoOpen: z.boolean().default(false),
  autoOpenDelay: z.number().int().nonnegative().default(5000),
  showOnMobile: z.boolean().default(true),
  persistSession: z.boolean().default(true),
  sessionDuration: z.number().int().positive().default(1800),
});
export type WidgetBehavior = z.infer<typeof WidgetBehavior>;

export const WidgetBranding = z.object({
  logo: z.string().url().nullable().default(null),
  companyName: z.string().max(100).nullable().default(null),
  tagline: z.string().max(200).nullable().default(null),
  poweredBy: z.boolean().default(true),
});
export type WidgetBranding = z.infer<typeof WidgetBranding>;

export const WidgetConfig = z.object({
  theme: WidgetTheme.default({}),
  branding: WidgetBranding.default({}),
  features: WidgetFeatures.default({}),
  behavior: WidgetBehavior.default({}),
  voice: WidgetVoiceConfig.default({}),
  chat: WidgetChatConfig.default({}),
});
export type WidgetConfig = z.infer<typeof WidgetConfig>;

export const Widget = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  config: WidgetConfig.default({}),
  status: WidgetStatus.default('active'),
  domains: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});
export type Widget = z.infer<typeof Widget>;

export const WidgetSession = z.object({
  id: z.string().uuid(),
  widgetId: z.string().uuid(),
  tenantId: z.string().uuid(),
  agentId: z.string().uuid().nullable(),
  conversationId: z.string().uuid().nullable(),
  token: z.string(),
  status: z.enum(['active', 'ended', 'expired', 'error']).default('active'),
  expiresAt: z.date(),
  createdAt: z.date(),
  lastActivityAt: z.date(),
});
export type WidgetSession = z.infer<typeof WidgetSession>;

export const WidgetEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('widget.loaded'), payload: z.object({ widgetId: z.string().uuid() }) }),
  z.object({ type: z.literal('widget.opened'), payload: z.object({ widgetId: z.string().uuid(), sessionId: z.string().uuid() }) }),
  z.object({ type: z.literal('widget.closed'), payload: z.object({ widgetId: z.string().uuid(), sessionId: z.string().uuid() }) }),
  z.object({ type: z.literal('chat.started'), payload: z.object({ sessionId: z.string().uuid(), conversationId: z.string().uuid() }) }),
  z.object({ type: z.literal('chat.message_sent'), payload: z.object({ sessionId: z.string().uuid(), messageId: z.string().uuid() }) }),
  z.object({ type: z.literal('chat.message_received'), payload: z.object({ sessionId: z.string().uuid(), messageId: z.string().uuid() }) }),
  z.object({ type: z.literal('error.occurred'), payload: z.object({ sessionId: z.string().uuid().nullable(), code: z.string(), message: z.string() }) }),
]);
export type WidgetEvent = z.infer<typeof WidgetEvent>;
