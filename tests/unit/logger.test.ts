import { createLogger, createTimer, logMetrics, logger } from '@/utils/logger.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Logger utility', () => {
  beforeEach(() => {
    // Clear any previous mocks
    vi.clearAllMocks();
  });

  it('should create a logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should create child loggers with context', () => {
    const context = { module: 'test', userId: '123' };
    const childLogger = createLogger(context);

    expect(childLogger).toBeDefined();
    expect(typeof childLogger.info).toBe('function');

    // Child logger should have the same methods as parent
    expect(typeof childLogger.error).toBe('function');
    expect(typeof childLogger.warn).toBe('function');
    expect(typeof childLogger.debug).toBe('function');
  });

  it('should log metrics for successful operations', () => {
    const loggerSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

    logMetrics({
      operation: 'test_operation',
      duration: 1500,
      success: true,
      itemsProcessed: 10,
    });

    expect(loggerSpy).toHaveBeenCalledWith(
      {
        operation: 'test_operation',
        duration: 1500,
        success: true,
        itemsProcessed: 10,
      },
      'test_operation completed successfully',
    );

    loggerSpy.mockRestore();
  });

  it('should log metrics for failed operations', () => {
    const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const testError = new Error('Test error');

    logMetrics({
      operation: 'test_operation',
      duration: 500,
      success: false,
      error: testError,
    });

    expect(loggerSpy).toHaveBeenCalledWith(
      {
        operation: 'test_operation',
        duration: 500,
        success: false,
        err: testError,
      },
      'test_operation failed',
    );

    loggerSpy.mockRestore();
  });

  it('should create timer and measure duration', () => {
    const loggerSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

    const timer = createTimer('test_timer');

    // Simulate some work
    const _startTime = Date.now();

    // End the timer
    const duration = timer.end(true, 5);

    expect(duration).toBeGreaterThanOrEqual(0);
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'test_timer',
        duration: expect.any(Number),
        success: true,
        itemsProcessed: 5,
      }),
      'test_timer completed successfully',
    );

    loggerSpy.mockRestore();
  });

  it('should handle timer for failed operations', () => {
    const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const testError = new Error('Timer test error');

    const timer = createTimer('failed_timer');
    const duration = timer.end(false, undefined, testError);

    expect(duration).toBeGreaterThanOrEqual(0);
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'failed_timer',
        duration: expect.any(Number),
        success: false,
        err: testError,
      }),
      'failed_timer failed',
    );

    loggerSpy.mockRestore();
  });

  it('should handle metrics without optional parameters', () => {
    const loggerSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

    logMetrics({
      operation: 'simple_operation',
      duration: 100,
      success: true,
    });

    expect(loggerSpy).toHaveBeenCalledWith(
      {
        operation: 'simple_operation',
        duration: 100,
        success: true,
      },
      'simple_operation completed successfully',
    );

    loggerSpy.mockRestore();
  });
});
