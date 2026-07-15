import type { ToolDefinition, ToolHandler, ToolContext, ToolCallRequest, ToolCallResult } from './index';
import { generateId } from '../helpers';

export interface ConfirmationRequest {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  context: ToolContext;
  timestamp: Date;
}

export type ConfirmationHandler = (request: ConfirmationRequest) => Promise<boolean>;

export class ToolConfirmationManager {
  private pendingConfirmations: Map<string, {
    resolve: (confirmed: boolean) => void;
    reject: (error: Error) => void;
    request: ConfirmationRequest;
  }> = new Map();
  private confirmationHandler: ConfirmationHandler;
  private timeoutMs: number;

  constructor(confirmationHandler: ConfirmationHandler, timeoutMs: number = 30_000) {
    this.confirmationHandler = confirmationHandler;
    this.timeoutMs = timeoutMs;
  }

  async requestConfirmation(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<boolean> {
    const request: ConfirmationRequest = {
      id: generateId(),
      toolName,
      arguments: args,
      context,
      timestamp: new Date(),
    };

    // Call the confirmation handler (e.g., send to user via WebSocket)
    const confirmed = await this.confirmationHandler(request);

    return confirmed;
  }

  createConfirmedHandler(
    toolName: string,
    wrappedHandler: ToolHandler,
    requireConfirmation: boolean
  ): ToolHandler {
    if (!requireConfirmation) {
      return wrappedHandler;
    }

    return async (args, context) => {
      // In production, this would send a confirmation request to the user
      // and wait for their response via WebSocket or polling
      const confirmed = await this.requestConfirmation(
        toolName,
        args,
        context
      );

      if (!confirmed) {
        throw new Error('Tool execution denied by user');
      }

      return wrappedHandler(args, context);
    };
  }
}

export function createConfirmationPrompt(args: Record<string, unknown>): string {
  const entries = Object.entries(args)
    .map(([k, v]) => `  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join('\n');

  return `Confirm tool execution with parameters:\n${entries}`;
}
