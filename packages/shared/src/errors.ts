type ErrorCode = string;

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly requestId?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      statusCode?: number;
      requestId?: string;
      details?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.statusCode = options.statusCode ?? 500;
    this.requestId = options.requestId;
    this.details = options.details;
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        requestId: this.requestId,
        details: this.details,
      },
    };
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required', requestId?: string) {
    super('AUTH_REQUIRED', message, { statusCode: 401, requestId });
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', requestId?: string) {
    super('FORBIDDEN', message, { statusCode: 403, requestId });
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string, requestId?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super('NOT_FOUND', message, { statusCode: 404, requestId });
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>, requestId?: string) {
    super('INVALID_REQUEST', message, { statusCode: 400, requestId, details });
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', requestId?: string) {
    super('RATE_LIMITED', message, { statusCode: 429, requestId });
    this.name = 'RateLimitError';
  }
}

export class ProviderError extends AppError {
  public readonly provider: string;

  constructor(provider: string, message: string, cause?: Error) {
    super('PROVIDER_ERROR', message, { statusCode: 502, cause });
    this.name = 'ProviderError';
    this.provider = provider;
  }
}

export class LLMError extends ProviderError {
  constructor(provider: string, message: string, cause?: Error) {
    super(provider, message, cause);
    this.name = 'LLMError';
  }
}

export class STTError extends ProviderError {
  constructor(provider: string, message: string, cause?: Error) {
    super(provider, message, cause);
    this.name = 'STTError';
  }
}

export class TTSError extends ProviderError {
  constructor(provider: string, message: string, cause?: Error) {
    super(provider, message, cause);
    this.name = 'TTSError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, requestId?: string) {
    super('CONFLICT', message, { statusCode: 409, requestId });
    this.name = 'ConflictError';
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', retryAfter?: number, requestId?: string) {
    super('RATE_LIMITED', message, { statusCode: 429, requestId, details: retryAfter ? { retryAfter } : undefined });
    this.name = 'TooManyRequestsError';
  }
}

export class GatewayTimeoutError extends AppError {
  constructor(provider: string, requestId?: string) {
    super('GATEWAY_TIMEOUT', `Provider ${provider} timed out`, { statusCode: 504, requestId });
    this.name = 'GatewayTimeoutError';
  }
}

export function getErrorStatusCode(error: unknown): number {
  if (error instanceof AppError) return error.statusCode;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('not found')) return 404;
    if (msg.includes('unauthorized') || msg.includes('authentication')) return 401;
    if (msg.includes('forbidden') || msg.includes('access denied')) return 403;
    if (msg.includes('validation') || msg.includes('invalid')) return 400;
    if (msg.includes('rate limit')) return 429;
  }
  return 500;
}

export function getErrorCode(error: unknown): ErrorCode {
  if (error instanceof AppError) return error.code;
  return 'INTERNAL_ERROR';
}
