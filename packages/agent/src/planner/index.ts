export type PlannerDecision = 'answer' | 'retrieve_knowledge' | 'execute_tool' | 'transfer' | 'end';

export interface PlannerContext {
  messageCount: number;
  hasKnowledgeBases: boolean;
  hasTools: boolean;
  lastMessage?: string;
  pendingToolCalls: string[];
  tokenUsage: number;
  maxTokens: number;
}

export interface PlannerResult {
  decision: PlannerDecision;
  reasoning: string;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface PlannerRule {
  name: string;
  condition: (context: PlannerContext) => boolean;
  decision: PlannerDecision;
  priority: number;
}

export class PlannerEngine {
  private rules: PlannerRule[] = [];

  constructor() {
    this.registerDefaultRules();
  }

  private registerDefaultRules() {
    // If there are pending tool calls, wait for results
    this.addRule({
      name: 'pending_tool_calls',
      condition: (ctx) => ctx.pendingToolCalls.length > 0,
      decision: 'answer',
      priority: 100,
    });

    // If token limit is approaching, end the conversation
    this.addRule({
      name: 'token_limit',
      condition: (ctx) => ctx.tokenUsage > ctx.maxTokens * 0.9,
      decision: 'end',
      priority: 90,
    });

    // If this is the first message and we have knowledge, retrieve it
    this.addRule({
      name: 'first_message_with_knowledge',
      condition: (ctx) => ctx.messageCount === 1 && ctx.hasKnowledgeBases,
      decision: 'retrieve_knowledge',
      priority: 80,
    });

    // If the message looks like a question and we have knowledge
    this.addRule({
      name: 'question_with_knowledge',
      condition: (ctx) => {
        const lastMessage = ctx.lastMessage?.toLowerCase() ?? '';
        const isQuestion = lastMessage.includes('?') ||
          lastMessage.startsWith('what') ||
          lastMessage.startsWith('how') ||
          lastMessage.startsWith('why') ||
          lastMessage.startsWith('when') ||
          lastMessage.startsWith('where') ||
          lastMessage.startsWith('can') ||
          lastMessage.startsWith('do') ||
          lastMessage.startsWith('does');
        return isQuestion && ctx.hasKnowledgeBases;
      },
      decision: 'retrieve_knowledge',
      priority: 70,
    });

    // If the message looks like a tool request
    this.addRule({
      name: 'tool_request',
      condition: (ctx) => {
        const lastMessage = ctx.lastMessage?.toLowerCase() ?? '';
        return lastMessage.includes('search') ||
          lastMessage.includes('lookup') ||
          lastMessage.includes('find') ||
          lastMessage.includes('calculate') ||
          lastMessage.includes('compute');
      },
      decision: 'execute_tool',
      priority: 60,
    });

    // Default: answer directly
    this.addRule({
      name: 'default_answer',
      condition: () => true,
      decision: 'answer',
      priority: 0,
    });
  }

  addRule(rule: PlannerRule) {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  removeRule(name: string) {
    this.rules = this.rules.filter(r => r.name !== name);
  }

  async decide(context: PlannerContext): Promise<PlannerResult> {
    for (const rule of this.rules) {
      if (rule.condition(context)) {
        return {
          decision: rule.decision,
          reasoning: `Rule '${rule.name}' matched`,
          confidence: 0.8,
          metadata: {
            rule: rule.name,
            priority: rule.priority,
          },
        };
      }
    }

    // Fallback (should never reach here due to default rule)
    return {
      decision: 'answer',
      reasoning: 'No rules matched, defaulting to answer',
      confidence: 0.5,
      metadata: {},
    };
  }
}
