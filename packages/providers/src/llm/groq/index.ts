import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamChunk } from '../../interfaces/llm';
import { fetchWithRetry } from '../../fetch-retry';

export interface GroqConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export class GroqProvider implements LLMProvider {
  readonly name = 'groq';
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(config: GroqConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.groq.com/openai/v1';
    this.timeout = config.timeout ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const response = await fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
          ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        })),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: request.tools?.map(t => ({
          type: 'function' as const,
          function: t.function,
        })),
        response_format: request.responseFormat,
      }),
    }, { maxRetries: this.maxRetries, timeoutMs: this.timeout });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    if (!data.choices?.length) {
      throw new Error('Groq returned empty choices');
    }
    return {
      id: data.id,
      model: data.model,
      choices: data.choices.map((c: any) => ({
        index: c.index,
        message: {
          role: c.message.role,
          content: c.message.content,
          tool_calls: c.message.tool_calls,
        },
        finish_reason: c.finish_reason,
      })),
      usage: {
        prompt_tokens: data.usage?.prompt_tokens ?? 0,
        completion_tokens: data.usage?.completion_tokens ?? 0,
        total_tokens: data.usage?.total_tokens ?? 0,
      },
    };
  }

  async *stream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const response = await fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
          ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        })),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true,
        tools: request.tools?.map(t => ({
          type: 'function' as const,
          function: t.function,
        })),
        response_format: request.responseFormat,
      }),
    }, { maxRetries: this.maxRetries, timeoutMs: this.timeout, retryOnStatusCodes: [429, 500, 502, 503, 504] });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') return;

          try {
            const chunk = JSON.parse(data);
            yield {
              id: chunk.id,
              model: chunk.model,
              choices: (chunk.choices ?? []).map((c: any) => ({
                index: c.index,
                delta: c.delta,
                finish_reason: c.finish_reason,
              })),
            };
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
