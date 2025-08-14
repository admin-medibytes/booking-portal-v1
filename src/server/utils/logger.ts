import { env } from '@/lib/env';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  userId?: string;
  organizationId?: string;
  requestId?: string;
  source?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private isStructured: boolean;

  private constructor() {
    this.logLevel = (env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
    this.isStructured = env.STRUCTURED_LOGGING === 'true';
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(entry: LogEntry): string {
    if (this.isStructured) {
      return JSON.stringify(entry);
    }

    let message = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`;
    
    if (entry.context) {
      const contextStr = Object.entries(entry.context)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ');
      message += ` | ${contextStr}`;
    }
    
    if (entry.error) {
      message += ` | Error: ${entry.error.name} - ${entry.error.message}`;
      if (entry.error.code) {
        message += ` (${entry.error.code})`;
      }
    }
    
    return message;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as { code?: string }).code,
      };
    }

    const formattedMessage = this.formatMessage(entry);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.log(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        if (error && !this.isStructured) {
          console.error(error.stack);
        }
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  // Database-specific logging helpers
  dbQuery(query: string, params?: unknown[], duration?: number): void {
    this.debug('Database query executed', {
      query: query.substring(0, 200), // Truncate long queries
      paramCount: params?.length,
      duration,
      source: 'database',
    });
  }

  dbError(operation: string, error: Error, context?: LogContext): void {
    this.error(`Database operation failed: ${operation}`, error, {
      ...context,
      source: 'database',
      operation,
    });
  }

  dbConnection(status: 'connected' | 'disconnected' | 'error', details?: Record<string, unknown>): void {
    const level = status === 'error' ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, `Database connection ${status}`, {
      source: 'database',
      connectionStatus: status,
      ...details,
    });
  }

  // Audit logging helper
  audit(action: string, userId: string, entityType: string, entityId: string, changes?: unknown): void {
    this.info('Audit log', {
      source: 'audit',
      action,
      userId,
      entityType,
      entityId,
      changes: changes ? JSON.stringify(changes) : undefined,
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const logDebug = (message: string, context?: LogContext) => logger.debug(message, context);
export const logInfo = (message: string, context?: LogContext) => logger.info(message, context);
export const logWarn = (message: string, context?: LogContext) => logger.warn(message, context);
export const logError = (message: string, error?: Error, context?: LogContext) => logger.error(message, error, context);