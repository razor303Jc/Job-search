import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || 'info';
const prettyPrint = process.env.LOG_PRETTY === 'true' || isDevelopment;

/**
 * Create a Pino logger instance with appropriate configuration
 */
export const logger = pino({
  level: logLevel,
  ...(prettyPrint && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log scraping metrics
 */
export function logMetrics(metrics: {
  operation: string;
  duration: number;
  success: boolean;
  itemsProcessed?: number;
  error?: Error;
}) {
  const logData = {
    operation: metrics.operation,
    duration: metrics.duration,
    success: metrics.success,
    ...(metrics.itemsProcessed !== undefined && { itemsProcessed: metrics.itemsProcessed }),
  };

  if (metrics.success) {
    logger.info(logData, `${metrics.operation} completed successfully`);
  } else {
    logger.error({ ...logData, err: metrics.error }, `${metrics.operation} failed`);
  }
}

/**
 * Performance timing helper
 */
export function createTimer(operation: string) {
  const start = Date.now();

  return {
    end: (success = true, itemsProcessed?: number, error?: Error) => {
      const duration = Date.now() - start;
      logMetrics({
        operation,
        duration,
        success,
        ...(itemsProcessed !== undefined && { itemsProcessed }),
        ...(error && { error }),
      });
      return duration;
    },
  };
}

export default logger;
