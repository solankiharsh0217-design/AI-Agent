export interface LogContext {
  requestId?: string;
  tenantId?: string;
  agentId?: string;
  conversationId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel;
  private context: LogContext;

  constructor(context: LogContext = {}, level: LogLevel = 'info') {
    this.context = context;
    this.level = level;
  }

  child(context: LogContext): Logger {
    return new Logger({ ...JSON.parse(JSON.stringify(this.context)), ...context }, this.level);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      this.log('debug', message, meta);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      this.log('info', message, meta);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      this.log('warn', message, meta);
    }
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      const errorMeta = error instanceof Error
        ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
        : { error: String(error) };
      this.log('error', message, { ...errorMeta, ...meta });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...meta,
    };

    let output: string;
    try {
      output = JSON.stringify(entry);
    } catch {
      output = JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        error: 'Failed to serialize log entry (circular reference)',
      });
    }

    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.log(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }
}

export function createLogger(context?: LogContext, level?: LogLevel): Logger {
  return new Logger(context, level);
}

export { Logger };
