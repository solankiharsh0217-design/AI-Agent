import { createDatabase, Database } from '@ai-agent/database';
import { ProviderRegistry, GroqProvider, SarvamSTTProvider, SarvamTTSProvider, WorkersAIEmbeddingProvider, TwilioProvider } from '@ai-agent/providers';
import { Logger, createSanitizedLogger } from '@ai-agent/shared';

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  KV: KVNamespace;
  INGESTION_QUEUE: Queue;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  SESSION_DO: DurableObjectNamespace;
  ENVIRONMENT: string;
  GROQ_API_KEY: string;
  SARVAM_API_KEY: string;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_WEBHOOK_BASE_URL: string;
  JWT_SECRET: string;
  WIDGET_SECRET: string;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  ALLOWED_ORIGINS: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  INTERNAL_API_SECRET: string;
}

export interface AppVariables {
  db: Database;
  registry: ProviderRegistry;
  tenantId: string;
  userId: string;
  userRole: string;
  requestId: string;
}

const baseLogger = new Logger({ service: 'api-worker' });
export const logger = createSanitizedLogger(baseLogger);

export function createProviderRegistry(env: Env): ProviderRegistry {
  return new ProviderRegistry({
    llm: {
      default: 'groq',
      providers: {
        groq: new GroqProvider({ apiKey: env.GROQ_API_KEY }),
      },
    },
    stt: {
      default: 'sarvam',
      providers: {
        sarvam: new SarvamSTTProvider({ apiKey: env.SARVAM_API_KEY }),
      },
    },
    tts: {
      default: 'sarvam',
      providers: {
        sarvam: new SarvamTTSProvider({ apiKey: env.SARVAM_API_KEY }),
      },
    },
    embedding: {
      default: 'workers-ai',
      providers: {
        'workers-ai': new WorkersAIEmbeddingProvider({
          accountId: env.CF_ACCOUNT_ID,
          apiToken: env.CF_API_TOKEN,
        }),
      },
    },
    telephony: {
      default: 'twilio',
      providers: {
        twilio: new TwilioProvider({
          accountSid: env.TWILIO_ACCOUNT_SID,
          authToken: env.TWILIO_AUTH_TOKEN,
          webhookBaseUrl: env.TWILIO_WEBHOOK_BASE_URL,
        }),
      },
    },
  });
}

export function createAppContext(env: Env) {
  const db = createDatabase(env.DB);
  const registry = createProviderRegistry(env);
  return { db, registry };
}
