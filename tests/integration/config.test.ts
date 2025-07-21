import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, resetConfig, saveConfig } from '@/config/index.js';
import type { AppConfig } from '@/config/index.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Integration tests for configuration management
 */
describe('Configuration Integration', () => {
  let tempDir: string;
  let originalConfigDir: string;

  beforeEach(() => {
    // Create temporary directory for config tests
    tempDir = join(tmpdir(), `job-dorker-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    // Save original config directory and NODE_ENV
    originalConfigDir = process.env.CONFIG_DIR || '';
    process.env.CONFIG_DIR = tempDir;

    // Reset NODE_ENV for consistent testing
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    // Restore original config directory
    process.env.CONFIG_DIR = originalConfigDir;

    // Clean up temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should load default configuration when no config file exists', async () => {
    const config = await loadConfig();

    expect(config).toBeDefined();
    expect(config.environment).toBe('test'); // Vitest sets NODE_ENV to 'test'
    expect(config.scraper.delay).toBe(2000);
    expect(config.logging.level).toBe('info');
  });

  it('should save and load custom configuration', async () => {
    const customConfig = {
      environment: 'test' as const,
      logging: {
        level: 'debug' as const,
        pretty: false,
      },
      scraper: {
        userAgent: 'Test Agent',
        delay: 1000,
        retries: 5,
        timeout: 20000,
        respectRobotsTxt: false,
        rateLimit: {
          requestsPerSecond: 1,
          burst: 5,
        },
      },
      database: {
        url: 'sqlite:./test.db',
        enableWal: false,
      },
      queue: {
        redis: {
          url: 'redis://test:6379',
          db: 1,
        },
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 25,
          attempts: 5,
          backoff: {
            type: 'fixed' as const,
            delay: 1000,
          },
        },
      },
      web: {
        enabled: true,
        port: 4000,
        host: '0.0.0.0',
        cors: {
          origin: true,
          credentials: true,
        },
      },
      reports: {
        outputDirectory: './test-reports',
        maxFileSize: 25 * 1024 * 1024,
        cleanupAfterDays: 7,
      },
    };

    // Save custom config
    await saveConfig(customConfig);

    // Load it back
    const loadedConfig = await loadConfig();

    expect(loadedConfig.environment).toBe('test');
    expect(loadedConfig.logging.level).toBe('debug');
    expect(loadedConfig.scraper.delay).toBe(1000);
    expect(loadedConfig.web.port).toBe(4000);
  });

  it('should reset configuration to defaults', async () => {
    // First save a custom config
    const customConfig = await loadConfig();
    customConfig.scraper.delay = 5000;
    customConfig.web.port = 8080;
    await saveConfig(customConfig);

    // Verify it was saved
    let config = await loadConfig();
    expect(config.scraper.delay).toBe(5000);
    expect(config.web.port).toBe(8080);

    // Reset to defaults
    await resetConfig();

    // Verify defaults are restored
    config = await loadConfig();
    expect(config.scraper.delay).toBe(2000);
    expect(config.web.port).toBe(3000);
  });

  it('should validate configuration schema', async () => {
    const invalidConfig = {
      scraper: {
        delay: -1000, // Invalid: negative delay
        retries: 10, // Invalid: too many retries
      },
    };

    // This should throw a validation error
    try {
      await saveConfig(invalidConfig as Partial<AppConfig>);
      // If we get here, the test should fail
      expect(true).toBe(false);
    } catch (error: unknown) {
      const configError = error as Error;
      expect(configError.message).toContain('Configuration saving failed');
    }
  });
});
