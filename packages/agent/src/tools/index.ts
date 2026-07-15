export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  enabled: boolean;
  requireConfirmation: boolean;
  timeout: number;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  error?: string;
  durationMs: number;
}

export interface ToolContext {
  tenantId: string;
  agentId: string;
  conversationId: string;
  sessionId: string;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<unknown>;

export class ToolRegistry {
  private definitions: Map<string, ToolDefinition> = new Map();
  private handlers: Map<string, ToolHandler> = new Map();

  register(definition: ToolDefinition, handler: ToolHandler) {
    this.definitions.set(definition.name, definition);
    this.handlers.set(definition.name, handler);
  }

  unregister(name: string) {
    this.definitions.delete(name);
    this.handlers.delete(name);
  }

  getDefinition(name: string): ToolDefinition | undefined {
    return this.definitions.get(name);
  }

  getHandler(name: string): ToolHandler | undefined {
    return this.handlers.get(name);
  }

  listDefinitions(): ToolDefinition[] {
    return Array.from(this.definitions.values()).filter(d => d.enabled);
  }

  async execute(
    request: ToolCallRequest,
    context: ToolContext
  ): Promise<ToolCallResult> {
    const startTime = Date.now();
    const definition = this.definitions.get(request.name);
    const handler = this.handlers.get(request.name);

    if (!definition || !handler) {
      return {
        id: request.id,
        name: request.name,
        arguments: request.arguments,
        result: null,
        error: `Tool '${request.name}' not found`,
        durationMs: Date.now() - startTime,
      };
    }

    if (!definition.enabled) {
      return {
        id: request.id,
        name: request.name,
        arguments: request.arguments,
        result: null,
        error: `Tool '${request.name}' is disabled`,
        durationMs: Date.now() - startTime,
      };
    }

    if (definition.requireConfirmation) {
      return {
        id: request.id,
        name: request.name,
        arguments: request.arguments,
        result: null,
        error: `Tool '${request.name}' requires confirmation but confirmation flow is not yet connected`,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const timeoutMs = definition.timeout > 0 ? definition.timeout : 30000;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      try {
        const result = await Promise.race([
          handler(request.arguments, context),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(`Tool '${request.name}' timed out after ${timeoutMs}ms`)), timeoutMs);
          }),
        ]);

        return {
          id: request.id,
          name: request.name,
          arguments: request.arguments,
          result,
          durationMs: Date.now() - startTime,
        };
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    } catch (error) {
      return {
        id: request.id,
        name: request.name,
        arguments: request.arguments,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  toLLMTools(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return this.listDefinitions().map(def => ({
      type: 'function' as const,
      function: {
        name: def.name,
        description: def.description,
        parameters: def.parameters,
      },
    }));
  }
}
