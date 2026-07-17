export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const MAX_UPLOAD_SIZE_MB = 100;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export const SESSION_EXPIRY_SECONDS = 1800;
export const CONVERSATION_SUMMARY_THRESHOLD = 10; // Match MemoryConfig default
export const MAX_CONVERSATION_MESSAGES = 100;

export const RATE_LIMIT = {
  DASHBOARD: { requestsPerMinute: 100, requestsPerHour: 1000 },
  WIDGET: { requestsPerMinute: 60, requestsPerHour: 1000 },
  API: { requestsPerMinute: 200, requestsPerHour: 5000 },
} as const;

export const PROVIDER_DEFAULTS = {
  LLM: {
    MODEL: 'llama-3.3-70b-versatile',
    PROVIDER: 'groq',
    TEMPERATURE: 0.7,
    MAX_TOKENS: 2048,
    TIMEOUT: 30000,
  },
  STT: {
    PROVIDER: 'sarvam',
    LANGUAGE: 'en-IN',
    TIMEOUT: 30000,
  },
  TTS: {
    PROVIDER: 'sarvam',
    LANGUAGE: 'en-IN',
    SPEED: 1.0,
    TIMEOUT: 30000,
  },
  EMBEDDING: {
    PROVIDER: 'workers-ai',
    MODEL: '@cf/baai/bge-large-en-v1.5',
    DIMENSIONS: 1024,
    BATCH_SIZE: 32,
    TIMEOUT: 30000,
  },
} as const;

export const VECTORIZE = {
  DEFAULT_TOP_K: 5,
  DEFAULT_SCORE_THRESHOLD: 0.7,
  MAX_TOP_K: 20,
} as const;

export const R2 = {
  DOCUMENTS_PATH: 'documents',
  AUDIO_PATH: 'audio',
  EXPORTS_PATH: 'exports',
} as const;

export const KV = {
  WIDGET_CONFIG_PREFIX: 'widget:',
  RATE_LIMIT_PREFIX: 'ratelimit:',
  FEATURE_FLAGS_PREFIX: 'ff:',
  PROVIDER_CONFIG_PREFIX: 'provider:',
} as const;

export const QUEUE = {
  DOCUMENT_PROCESSING: 'document-processing',
  USAGE_AGGREGATION: 'usage-aggregation',
  ANALYTICS_EVENTS: 'analytics-events',
  WEBHOOK_DELIVERY: 'webhook-delivery',
} as const;

export const PHONE = {
  COUNTRIES: ['US', 'CA', 'GB', 'IN', 'AU', 'DE', 'FR', 'JP'] as const,
  MAX_CALL_DURATION: 7200,
  RECORDING_SAMPLE_RATE: 8000,
} as const;

export const ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'Authentication required',
  INVALID_TOKEN: 'Invalid or expired token',
  TOKEN_EXPIRED: 'Token has expired',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  NOT_FOUND: 'Resource not found',
  ALREADY_EXISTS: 'Resource already exists',
  CONFLICT: 'Resource conflict',
  VALIDATION_ERROR: 'Validation error',
  RATE_LIMITED: 'Rate limit exceeded',
  INTERNAL_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service unavailable',
  GATEWAY_TIMEOUT: 'Gateway timeout',
  FORBIDDEN: 'Access forbidden',
  INVALID_REQUEST: 'Invalid request',
  MISSING_FIELDS: 'Missing required fields',
  UNKNOWN_ERROR: 'An unknown error occurred',
};
