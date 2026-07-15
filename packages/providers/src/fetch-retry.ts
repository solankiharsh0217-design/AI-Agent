export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOnStatusCodes: number[];
  timeoutMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryOnStatusCodes: [408, 429, 500, 502, 503, 504],
  timeoutMs: 60000,
};

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: Partial<RetryOptions> = {}
): Promise<Response> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);
      const signal = init.signal
        ? combineSignals(init.signal, controller.signal)
        : controller.signal;

      try {
        const response = await fetch(url, { ...init, signal });

        if (response.ok || !opts.retryOnStatusCodes.includes(response.status)) {
          return response;
        }

        if (attempt === opts.maxRetries) {
          return response;
        }

        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseRetryAfter(retryAfter) * 1000
          : calculateBackoff(attempt, opts.baseDelayMs, opts.maxDelayMs);

        await sleep(delay);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxRetries) {
        throw lastError;
      }

      const delay = calculateBackoff(attempt, opts.baseDelayMs, opts.maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Fetch failed after retries');
}

function combineSignals(userSignal: AbortSignal, timeoutSignal: AbortSignal): AbortSignal {
  if (userSignal.aborted) return userSignal;
  if (timeoutSignal.aborted) return timeoutSignal;

  const controller = new AbortController();
  const onAbort = () => controller.abort();

  userSignal.addEventListener('abort', onAbort, { once: true });
  timeoutSignal.addEventListener('abort', onAbort, { once: true });

  return controller.signal;
}

function calculateBackoff(attempt: number, baseMs: number, maxMs: number): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = exponential * 0.1 * Math.random();
  return Math.min(exponential + jitter, maxMs);
}

function parseRetryAfter(value: string): number {
  const seconds = parseInt(value, 10);
  return isNaN(seconds) ? 1 : Math.min(seconds, 60);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('econnreset') ||
      msg.includes('econnrefused') ||
      msg.includes('etimedout') ||
      msg.includes('socket hang up') ||
      msg.includes('network')
    );
  }
  return false;
}
