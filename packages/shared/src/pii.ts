const SENSITIVE_FIELDS = new Set([
  'password', 'secret', 'token', 'api_key', 'apikey', 'api-key',
  'authorization', 'auth', 'credential', 'private_key', 'privatekey',
  'access_token', 'accesstoken', 'refresh_token', 'refreshtoken',
  'ssn', 'social_security', 'credit_card', 'card_number', 'cardnumber',
  'cvv', 'pin', 'bank_account', 'bankaccount', 'routing_number',
]);

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const CREDIT_CARD_REGEX = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;

export function redactPII(text: string): string {
  let result = text;

  // Redact emails
  result = result.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');

  // Redact phone numbers
  result = result.replace(PHONE_REGEX, '[REDACTED_PHONE]');

  // Redact credit card numbers
  result = result.replace(CREDIT_CARD_REGEX, '[REDACTED_CARD]');

  // Redact SSNs
  result = result.replace(SSN_REGEX, '[REDACTED_SSN]');

  return result;
}

export function redactObject(obj: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 10) return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      result[key] = redactPII(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = redactObject(value as Record<string, unknown>, depth + 1);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'object' && item !== null
          ? redactObject(item as Record<string, unknown>, depth + 1)
          : typeof item === 'string'
            ? redactPII(item)
            : item
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function createSanitizedLogger(logger: { info: Function; warn: Function; error: Function; debug: Function }) {
  return {
    info: (message: string, meta?: Record<string, unknown>) =>
      logger.info(message, meta ? redactObject(meta) : undefined),
    warn: (message: string, meta?: Record<string, unknown>) =>
      logger.warn(message, meta ? redactObject(meta) : undefined),
    error: (message: string, error?: Error | unknown, meta?: Record<string, unknown>) =>
      logger.error(message, error, meta ? redactObject(meta) : undefined),
    debug: (message: string, meta?: Record<string, unknown>) =>
      logger.debug(message, meta ? redactObject(meta) : undefined),
  };
}
