import { describe, it, expect } from 'vitest';
import {
  AppError, AuthError, ForbiddenError, NotFoundError,
  ValidationError, RateLimitError, ConflictError,
  ProviderError, LLMError, STTError, TTSError,
  TooManyRequestsError, GatewayTimeoutError,
  getErrorStatusCode, getErrorCode,
} from '../errors';

describe('AppError', () => {
  it('should set code, message, and statusCode', () => {
    const err = new AppError('TEST_ERROR', 'Test message', { statusCode: 400 });
    expect(err.code).toBe('TEST_ERROR');
    expect(err.message).toBe('Test message');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('AppError');
  });

  it('should default statusCode to 500', () => {
    const err = new AppError('INTERNAL', 'Oops');
    expect(err.statusCode).toBe(500);
  });

  it('should serialize to JSON correctly', () => {
    const err = new AppError('NOT_FOUND', 'Not found', { statusCode: 404, requestId: 'req-1' });
    const json = err.toJSON();
    expect(json).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'req-1', details: undefined },
    });
  });
});

describe('Specialized error classes', () => {
  it('AuthError should have status 401 and code AUTH_REQUIRED', () => {
    const err = new AuthError('Login required');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_REQUIRED');
    expect(err.name).toBe('AuthError');
  });

  it('ForbiddenError should have status 403 and code FORBIDDEN', () => {
    const err = new ForbiddenError('No access');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('NotFoundError should have status 404 and message with resource and id', () => {
    const err = new NotFoundError('Agent', 'agent-1');
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('Agent');
    expect(err.message).toContain('agent-1');
  });

  it('ValidationError should have status 400 and include details', () => {
    const err = new ValidationError('Invalid input', { field: 'name' }, 'req-1');
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ field: 'name' });
  });

  it('RateLimitError should have status 429', () => {
    const err = new RateLimitError('Slow down');
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
  });

  it('ConflictError should have status 409', () => {
    const err = new ConflictError('Already exists');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  it('TooManyRequestsError should have status 429 and optional retryAfter', () => {
    const err = new TooManyRequestsError('Too many', 60);
    expect(err.statusCode).toBe(429);
    expect(err.details).toEqual({ retryAfter: 60 });
  });

  it('GatewayTimeoutError should have status 504', () => {
    const err = new GatewayTimeoutError('openai');
    expect(err.statusCode).toBe(504);
    expect(err.message).toContain('openai');
  });
});

describe('Provider errors', () => {
  it('ProviderError should have status 502 and provider field', () => {
    const err = new ProviderError('sarvam', 'API error');
    expect(err.statusCode).toBe(502);
    expect(err.provider).toBe('sarvam');
  });

  it('LLMError should extend ProviderError', () => {
    const err = new LLMError('groq', 'Rate limited');
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.provider).toBe('groq');
    expect(err.name).toBe('LLMError');
  });

  it('STTError should extend ProviderError', () => {
    const err = new STTError('sarvam', 'No speech');
    expect(err.name).toBe('STTError');
  });

  it('TTSError should extend ProviderError', () => {
    const err = new TTSError('sarvam', 'Synthesis failed');
    expect(err.name).toBe('TTSError');
  });
});

describe('getErrorStatusCode', () => {
  it('should return AppError statusCode for AppError instances', () => {
    expect(getErrorStatusCode(new NotFoundError('Test'))).toBe(404);
    expect(getErrorStatusCode(new AuthError())).toBe(401);
    expect(getErrorStatusCode(new ForbiddenError())).toBe(403);
    expect(getErrorStatusCode(new ValidationError('Bad'))).toBe(400);
    expect(getErrorStatusCode(new RateLimitError())).toBe(429);
    expect(getErrorStatusCode(new ConflictError('x'))).toBe(409);
  });

  it('should infer statusCode from Error message content', () => {
    expect(getErrorStatusCode(new Error('not found'))).toBe(404);
    expect(getErrorStatusCode(new Error('unauthorized'))).toBe(401);
    expect(getErrorStatusCode(new Error('authentication failed'))).toBe(401);
    expect(getErrorStatusCode(new Error('forbidden'))).toBe(403);
    expect(getErrorStatusCode(new Error('access denied'))).toBe(403);
    expect(getErrorStatusCode(new Error('validation error'))).toBe(400);
    expect(getErrorStatusCode(new Error('invalid input'))).toBe(400);
    expect(getErrorStatusCode(new Error('rate limit exceeded'))).toBe(429);
  });

  it('should return 500 for unknown errors', () => {
    expect(getErrorStatusCode(new Error('Something went wrong'))).toBe(500);
    expect(getErrorStatusCode('string error')).toBe(500);
    expect(getErrorStatusCode(null)).toBe(500);
    expect(getErrorStatusCode(undefined)).toBe(500);
  });
});

describe('getErrorCode', () => {
  it('should return AppError code for AppError instances', () => {
    expect(getErrorCode(new NotFoundError('Test'))).toBe('NOT_FOUND');
    expect(getErrorCode(new AuthError())).toBe('AUTH_REQUIRED');
  });

  it('should return INTERNAL_ERROR for other errors', () => {
    expect(getErrorCode(new Error('generic'))).toBe('INTERNAL_ERROR');
    expect(getErrorCode('string')).toBe('INTERNAL_ERROR');
  });
});
