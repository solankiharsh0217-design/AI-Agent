import { z } from 'zod';

export const WorkflowStatus = z.enum(['draft', 'published', 'archived', 'deprecated']);
export type WorkflowStatus = z.infer<typeof WorkflowStatus>;

export const WorkflowNode = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('start'), label: z.string().default('Start') }),
  z.object({ id: z.string(), type: z.literal('llm'), label: z.string().default('LLM'), prompt: z.string(), model: z.string().nullable() }),
  z.object({ id: z.string(), type: z.literal('tool'), label: z.string().default('Tool'), toolId: z.string().uuid() }),
  z.object({ id: z.string(), type: z.literal('condition'), label: z.string().default('Condition'), expression: z.string() }),
  z.object({ id: z.string(), type: z.literal('end'), label: z.string().default('End') }),
]);
export type WorkflowNode = z.infer<typeof WorkflowNode>;

export const WorkflowEdge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().nullable(),
});
export type WorkflowEdge = z.infer<typeof WorkflowEdge>;

export const WorkflowDefinition = z.object({
  nodes: z.array(WorkflowNode),
  edges: z.array(WorkflowEdge),
});
export type WorkflowDefinition = z.infer<typeof WorkflowDefinition>;

export const Workflow = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  status: WorkflowStatus.default('draft'),
  definition: WorkflowDefinition,
  createdAt: z.date(),
  updatedAt: z.date(),
  publishedAt: z.date().nullable(),
});
export type Workflow = z.infer<typeof Workflow>;

export const WorkflowInstanceStatus = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);
export type WorkflowInstanceStatus = z.infer<typeof WorkflowInstanceStatus>;

export const WorkflowInstance = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  tenantId: z.string().uuid(),
  status: WorkflowInstanceStatus.default('pending'),
  input: z.record(z.unknown()).default({}),
  output: z.record(z.unknown()).nullable(),
  currentNodeId: z.string().nullable(),
  error: z.string().nullable(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
});
export type WorkflowInstance = z.infer<typeof WorkflowInstance>;
