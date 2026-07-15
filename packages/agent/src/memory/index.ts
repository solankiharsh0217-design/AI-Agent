import { ConversationRepository } from '@ai-agent/database';
import type { MessageRole } from '@ai-agent/types';
import { Logger } from '@ai-agent/shared';

export interface MemoryMessage {
  id: string;
  role: MessageRole;
  content: string;
  tokenCount: number;
  createdAt: Date;
}

export interface MemoryConfig {
  maxMessages: number;
  maxTokens: number;
  summaryThreshold: number;
  summaryModel?: string;
}

export interface ConversationSummary {
  id: string;
  content: string;
  messageRange: { from: number; to: number };
  tokenCount: number;
  createdAt: Date;
}

export class MemoryEngine {
  private conversationRepo: ConversationRepository;
  private logger = new Logger({ service: 'MemoryEngine' });

  constructor(conversationRepo: ConversationRepository) {
    this.conversationRepo = conversationRepo;
  }

  async getConversationHistory(
    conversationId: string,
    tenantId: string,
    config: MemoryConfig
  ): Promise<{ messages: MemoryMessage[]; summary?: string }> {
    const defaultConfig: MemoryConfig = { maxMessages: 100, maxTokens: 100000, summaryThreshold: 50 };
    const effectiveConfig = { ...defaultConfig, ...config };

    // Fetch messages in ascending order (oldest first)
    const messages = await this.conversationRepo.getMessages(conversationId, tenantId, {
      limit: effectiveConfig.maxMessages + 50
    });

    // Sort ascending
    const sortedMessages: MemoryMessage[] = [...messages]
      .sort((a, b) => new Date(a.createdAt as unknown as string).getTime() - new Date(b.createdAt as unknown as string).getTime())
      .map(m => ({
        id: m.id,
        role: m.role as MessageRole,
        content: m.content,
        tokenCount: m.totalTokens ?? 0,
        createdAt: new Date(m.createdAt as unknown as string),
      }));

    // Trim from the front (oldest messages) if over limit
    if (sortedMessages.length > effectiveConfig.maxMessages) {
      sortedMessages.splice(0, sortedMessages.length - effectiveConfig.maxMessages);
    }

    return { messages: sortedMessages };
  }

  async shouldSummarize(
    conversationId: string,
    tenantId: string,
    config: MemoryConfig
  ): Promise<boolean> {
    const messages = await this.conversationRepo.getMessages(conversationId, tenantId, {
      limit: config.summaryThreshold,
    });
    return messages.length >= config.summaryThreshold;
  }

  async createSummaryPrompt(
    conversationId: string,
    tenantId: string,
    config: MemoryConfig
  ): Promise<string | null> {
    const messages = await this.conversationRepo.getMessages(conversationId, tenantId, {
      limit: config.summaryThreshold,
    });

    if (messages.length < config.summaryThreshold) {
      return null;
    }

    const conversationText = [...messages]
      .reverse()
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    return `Summarize the following conversation concisely, preserving key facts and context:

${conversationText}

Provide a clear, concise summary that captures the essential information.`;
  }

  async addMessage(
    conversationId: string,
    tenantId: string,
    role: MessageRole,
    content: string,
    tokenCount: number
  ): Promise<void> {
    await this.conversationRepo.addMessage({
      conversationId,
      tenantId,
      role: role as string,
      content,
      tokens: {
        inputTokens: role === 'user' ? tokenCount : 0,
        outputTokens: role === 'assistant' ? tokenCount : 0,
        totalTokens: tokenCount,
        estimatedCostUsd: 0,
      },
    });

    // Use a lightweight check instead of fetching all messages
    this.logger.debug('Message added to conversation', { conversationId, role });
  }

  async trimHistory(
    conversationId: string,
    tenantId: string,
    config: MemoryConfig
  ): Promise<void> {
    const defaultConfig: MemoryConfig = { maxMessages: 100, maxTokens: 100000, summaryThreshold: 50 };
    const effectiveConfig = { ...defaultConfig, ...config };

    // Get message count first (use a count query instead of fetching 1000 messages)
    const messages = await this.conversationRepo.getMessages(conversationId, tenantId, { limit: 1000 });

    if (messages.length > effectiveConfig.maxMessages) {
      const excessCount = messages.length - effectiveConfig.maxMessages;
      // Delete the OLDEST messages (first in ascending order)
      const sortedAsc = [...messages].sort((a, b) => new Date(a.createdAt as unknown as string).getTime() - new Date(b.createdAt as unknown as string).getTime());
      const messagesToDelete = sortedAsc.slice(0, excessCount);

      for (const msg of messagesToDelete) {
        await this.conversationRepo.deleteMessage(msg.id, tenantId);
      }

      this.logger.info('Trimmed conversation history', {
        conversationId,
        deletedCount: messagesToDelete.length,
        remainingCount: messages.length - messagesToDelete.length,
      });
    }
  }
}
