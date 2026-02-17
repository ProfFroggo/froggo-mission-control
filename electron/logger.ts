/**
 * Safe Logger Module for Electron Main Process
 * 
 * EPIPE-proof logging that doesn't crash on stream errors
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
}

const config: LoggerConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  enableConsole: process.env.NODE_ENV !== 'production',
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
  }

  private formatMessage(level: LogLevel, message: string): string {
    return `[${this.context}] ${message}`;
  }

  private safeLog(level: LogLevel, message: string, ...args: unknown[]): void {
    try {
      if (level === 'error' && process.stderr.writable) {
        console.error(this.formatMessage(level, message), ...args);
      } else if (process.stdout.writable) {
        const logFn = level === 'debug' ? console.debug : 
                      level === 'warn' ? console.warn : console.info;
        logFn(this.formatMessage(level, message), ...args);
      }
    } catch (_e: any) {
      // Silently ignore EPIPE and other stream errors
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      this.safeLog('debug', message, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      this.safeLog('info', message, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      this.safeLog('warn', message, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      this.safeLog('error', message, ...args);
    }
  }
}

/**
 * Create a logger instance for a specific context
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}

/**
 * Set global log level
 */
export function setLogLevel(level: LogLevel): void {
  config.level = level;
}

/**
 * Get current log level
 */
export function getLogLevel(): LogLevel {
  return config.level;
}

/**
 * Safe console logging that won't crash on EPIPE
 */
export const safeLog = {
  debug: (...args: any[]) => {
    try {
      if (process.stdout.writable) {
        console.debug(...args);
      }
    } catch (_e: any) {
      // Silently ignore EPIPE and other stream errors
    }
  },
  log: (...args: any[]) => {
    try {
      if (process.stdout.writable) {
        console.log(...args);
      }
    } catch (_e: any) {
      // Silently ignore EPIPE and other stream errors
    }
  },
  error: (...args: any[]) => {
    try {
      if (process.stderr.writable) {
        console.error(...args);
      }
    } catch (_e: any) {
      // Silently ignore stream errors
    }
  },
  warn: (...args: any[]) => {
    try {
      if (process.stderr.writable) {
        console.warn(...args);
      }
    } catch (_e: any) {
      // Silently ignore stream errors
    }
  }
};

export default Logger;
