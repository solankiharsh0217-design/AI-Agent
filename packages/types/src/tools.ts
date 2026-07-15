import { z } from 'zod';

export const ToolType = z.enum([
  'http', 'webhook', 'function', 'knowledge_search',
  'transfer', 'email', 'calendar', 'custom',
]);
export type ToolType = z.infer<typeof ToolType>;

export const ToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.object({
    type: z.literal('object'),
    properties: z.record(z.object({
      type: z.string(),
      description: z.string().nullable(),
      enum: z.array(z.string()).nullable(),
      default: z.unknown().nullable(),
    })),
    required: z.array(z.string()).default([]),
  }),
});
export type ToolSchema = z.infer<typeof ToolSchema>;

export const Tool = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(255),
  description: z.string().max(1000),
  type: ToolType,
  schema: ToolSchema,
  isEnabled: z.boolean().default(true),
  isBuiltin: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Tool = z.infer<typeof Tool>;

export const ToolCallStatus = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);
export type ToolCallStatus = z.infer<typeof ToolCallStatus>;

export const ToolResult = z.object({
  success: z.boolean(),
  data: z.unknown().nullable(),
  error: z.string().nullable(),
});
export type ToolResult = z.infer<typeof ToolResult>;
