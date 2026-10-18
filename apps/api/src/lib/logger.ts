export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

class Logger {
  private formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const payload: LogPayload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    return JSON.stringify(payload);
  }

  info(message: string, meta?: Record<string, unknown>) {
    console.log(this.formatLog('info', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(this.formatLog('warn', message, meta));
  }

  error(message: string, meta?: Record<string, unknown>) {
    console.error(this.formatLog('error', message, meta));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
      console.debug(this.formatLog('debug', message, meta));
    }
  }
}

export const logger = new Logger();
