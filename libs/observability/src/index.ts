/**
 * @syntherium/observability
 * 
 * Logging and observability utilities.
 * 
 * TODO: Integrate with proper observability stack (OpenTelemetry, etc.)
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  service?: string;
  requestId?: string;
  userId?: string;
  orderId?: string;
  reference?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
}

/**
 * Creates a structured logger instance.
 */
export function createLogger(serviceName: string): Logger {
  const formatLog = (level: LogLevel, message: string, context?: LogContext) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      service: serviceName,
      message,
      ...context,
    };
    return JSON.stringify(logEntry);
  };

  return {
    debug(message: string, context?: LogContext) {
      if (process.env.LOG_LEVEL === 'debug') {
        console.debug(formatLog(LogLevel.DEBUG, message, context));
      }
    },

    info(message: string, context?: LogContext) {
      console.info(formatLog(LogLevel.INFO, message, context));
    },

    warn(message: string, context?: LogContext) {
      console.warn(formatLog(LogLevel.WARN, message, context));
    },

    error(message: string, error?: Error, context?: LogContext) {
      const errorContext = error
        ? {
            ...context,
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
          }
        : context;
      console.error(formatLog(LogLevel.ERROR, message, errorContext));
    },
  };
}

/**
 * Request ID middleware helper.
 * Extracts or generates a request ID for tracing.
 */
export function getRequestId(headers: Record<string, string | string[] | undefined>): string {
  const existingId = headers['x-request-id'] || headers['x-correlation-id'];
  if (typeof existingId === 'string') {
    return existingId;
  }
  // Generate new ID
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Timing helper for performance measurement.
 */
export function createTimer() {
  const start = process.hrtime.bigint();

  return {
    elapsed(): number {
      const end = process.hrtime.bigint();
      return Number(end - start) / 1_000_000; // Return milliseconds
    },

    elapsedFormatted(): string {
      return `${this.elapsed().toFixed(2)}ms`;
    },
  };
}

/**
 * Audit log helper for sensitive operations.
 */
export interface AuditEvent {
  action: string;
  actor: {
    id: string;
    type: 'user' | 'service' | 'system';
  };
  resource: {
    type: string;
    id: string;
  };
  outcome: 'success' | 'failure';
  details?: Record<string, unknown>;
}

export function logAuditEvent(event: AuditEvent): void {
  const auditLog = {
    timestamp: new Date().toISOString(),
    type: 'AUDIT',
    ...event,
  };
  // In production, this should write to a secure audit log
  console.info(JSON.stringify(auditLog));
}
