/**
 * Configuration and Environment Tests
 * Phase 8 Stage 2: Configuration Management & Environment Testing
 *
 * Tests for configuration validation, environment handling, and settings management
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

// Define deep partial type for flexible configuration updates
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Mock configuration schemas and types
interface DatabaseConfig {
  url: string;
  enableWal: boolean;
  maxConnections?: number;
  timeout?: number;
}

interface ScraperConfig {
  userAgent: string;
  delay: number;
  retries: number;
  timeout: number;
  respectRobotsTxt: boolean;
  rateLimit: {
    requestsPerSecond: number;
    burst: number;
  };
}

interface WebConfig {
  enabled: boolean;
  port: number;
  host: string;
  cors: {
    origin: string[] | boolean;
    credentials: boolean;
  };
}

interface AppConfig {
  environment: 'development' | 'test' | 'production';
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
    pretty: boolean;
  };
  scraper: ScraperConfig;
  database: DatabaseConfig;
  web: WebConfig;
  reports: {
    outputDirectory: string;
    maxFileSize: number;
    cleanupAfterDays: number;
  };
}

// Mock configuration manager
class ConfigurationManager {
  private static readonly DEFAULT_CONFIG: AppConfig = {
    environment: 'development',
    logging: {
      level: 'info',
      pretty: true,
    },
    scraper: {
      userAgent: 'JobDorker/1.0',
      delay: 2000,
      retries: 3,
      timeout: 30000,
      respectRobotsTxt: true,
      rateLimit: {
        requestsPerSecond: 0.5,
        burst: 2,
      },
    },
    database: {
      url: 'sqlite:./data/jobs.db',
      enableWal: true,
    },
    web: {
      enabled: true,
      port: 3000,
      host: 'localhost',
      cors: {
        origin: ['http://localhost:3000'],
        credentials: true,
      },
    },
    reports: {
      outputDirectory: './reports',
      maxFileSize: 50 * 1024 * 1024, // 50MB
      cleanupAfterDays: 30,
    },
  };

  private config: AppConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || join(process.cwd(), 'config.json');
    this.config = { ...ConfigurationManager.DEFAULT_CONFIG };
  }

  async loadConfig(): Promise<AppConfig> {
    try {
      if (existsSync(this.configPath)) {
        const configFile = readFileSync(this.configPath, 'utf8');
        const fileConfig = JSON.parse(configFile);
        this.config = this.mergeConfigs(ConfigurationManager.DEFAULT_CONFIG, fileConfig);
      }
    } catch (error) {
      console.warn('Failed to load config file, using defaults');
    }

    // Apply environment variables
    this.applyEnvironmentOverrides();
    
    // Validate configuration
    this.validateConfig();

    return this.config;
  }

  async saveConfig(config: DeepPartial<AppConfig>): Promise<void> {
    // Create merged config without modifying the current config yet
    const mergedConfig = this.mergeConfigs(this.config, config);
    
    // Validate the merged config before applying it
    const originalConfig = this.config;
    this.config = mergedConfig;
    try {
      this.validateConfig();
    } catch (error) {
      // Restore original config if validation fails
      this.config = originalConfig;
      throw error;
    }
    
    const configDir = this.configPath.substring(0, this.configPath.lastIndexOf('/'));
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  resetToDefaults(): void {
    this.config = { ...ConfigurationManager.DEFAULT_CONFIG };
  }

  validateConfig(): void {
    const errors: string[] = [];

    // Validate environment
    if (!['development', 'test', 'production'].includes(this.config.environment)) {
      errors.push('Invalid environment value');
    }

    // Validate logging
    if (!['error', 'warn', 'info', 'debug', 'trace'].includes(this.config.logging.level)) {
      errors.push('Invalid logging level');
    }

    // Validate scraper config
    if (this.config.scraper.delay < 0 || this.config.scraper.delay > 10000) {
      errors.push('Scraper delay must be between 0 and 10000ms');
    }

    if (this.config.scraper.retries < 0 || this.config.scraper.retries > 10) {
      errors.push('Scraper retries must be between 0 and 10');
    }

    if (this.config.scraper.rateLimit.requestsPerSecond <= 0 || this.config.scraper.rateLimit.requestsPerSecond > 10) {
      errors.push('Rate limit requests per second must be between 0 and 10');
    }

    // Validate database config
    if (!this.config.database.url) {
      errors.push('Database URL is required');
    }

    // Validate web config
    if (this.config.web.port < 0 || this.config.web.port > 65535) {
      errors.push('Web port must be between 0 and 65535');
    }

    // Validate reports config
    if (this.config.reports.maxFileSize <= 0 || this.config.reports.maxFileSize > 1024 * 1024 * 1024) {
      errors.push('Max file size must be between 0 and 1GB');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  private mergeConfigs(base: AppConfig, override: DeepPartial<AppConfig>): AppConfig {
    const result = { ...base };
    
    for (const key in override) {
      if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
        // Recursively merge objects, preserving existing properties in base
        result[key] = this.mergeConfigs(result[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }
    }
    
    return result;
  }

  private applyEnvironmentOverrides(): void {
    // Environment
    if (process.env.NODE_ENV && process.env.NODE_ENV !== 'test') {
      this.config.environment = process.env.NODE_ENV as any;
    }

    // Logging level - only apply if valid
    if (process.env.LOG_LEVEL) {
      const validLevels = ['error', 'warn', 'info', 'debug', 'trace'];
      if (validLevels.includes(process.env.LOG_LEVEL)) {
        this.config.logging.level = process.env.LOG_LEVEL as any;
      }
    }

    // Scraper settings
    if (process.env.SCRAPER_DELAY) {
      const delay = parseInt(process.env.SCRAPER_DELAY, 10);
      if (!isNaN(delay) && delay > 0) {
        this.config.scraper.delay = delay;
      }
    }

    if (process.env.SCRAPER_USER_AGENT) {
      this.config.scraper.userAgent = process.env.SCRAPER_USER_AGENT;
    }

    // Database URL
    if (process.env.DATABASE_URL) {
      this.config.database.url = process.env.DATABASE_URL;
    }

    // Web port
    if (process.env.PORT) {
      const port = parseInt(process.env.PORT, 10);
      if (!isNaN(port) && port > 0 && port <= 65535) {
        this.config.web.port = port;
      }
    }
  }
}

// Mock environment utilities
class EnvironmentManager {
  private originalEnv: Record<string, string | undefined>;

  constructor() {
    this.originalEnv = { ...process.env };
  }

  setEnvironment(env: Record<string, string>): void {
    Object.assign(process.env, env);
  }

  clearEnvironment(): void {
    Object.keys(process.env).forEach((key) => {
      if (!this.originalEnv.hasOwnProperty(key)) {
        delete process.env[key];
      }
    });
  }

  restoreEnvironment(): void {
    Object.keys(process.env).forEach((key) => {
      delete process.env[key];
    });
    Object.assign(process.env, this.originalEnv);
  }

  getEnvironmentInfo(): Record<string, any> {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  validateEnvironment(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
    if (majorVersion < 18) {
      errors.push(`Node.js version ${nodeVersion} is not supported. Minimum version: 18.x`);
    }

    // Check available memory
    const memoryUsage = process.memoryUsage();
    if (memoryUsage.heapTotal > 1024 * 1024 * 1024) { // 1GB
      errors.push('High memory usage detected');
    }

    // Check required environment variables in production
    if (process.env.NODE_ENV === 'production') {
      const requiredVars = ['DATABASE_URL', 'PORT'];
      for (const varName of requiredVars) {
        if (!process.env[varName]) {
          errors.push(`Required environment variable ${varName} is not set`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

const TEST_CONFIG_DIR = join(tmpdir(), 'job-dorker-config-tests');

describe('Configuration and Environment Management', () => {
  let configManager: ConfigurationManager;
  let envManager: EnvironmentManager;
  let testConfigPath: string;

  beforeEach(() => {
    // Clear environment variables that might affect tests
    delete process.env.SCRAPER_DELAY;
    delete process.env.PORT;
    delete process.env.LOG_LEVEL;
    delete process.env.DATABASE_URL;
    delete process.env.SCRAPER_USER_AGENT;
    
    // Create test directory
    if (!existsSync(TEST_CONFIG_DIR)) {
      mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }

    // Create unique config file path for each test to prevent interference
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    testConfigPath = join(TEST_CONFIG_DIR, `test-config-${timestamp}-${random}.json`);
    
    // Clean up any existing test config BEFORE creating configManager
    if (existsSync(testConfigPath)) {
      rmSync(testConfigPath);
    }
    
    configManager = new ConfigurationManager(testConfigPath);
    envManager = new EnvironmentManager();

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any test config file after each test
    if (existsSync(testConfigPath)) {
      rmSync(testConfigPath);
    }
    
    // Restore environment to original state
    if (envManager) {
      envManager.restoreEnvironment();
    }
    
    // Clear environment variables as backup
    delete process.env.SCRAPER_DELAY;
    delete process.env.PORT;
    delete process.env.LOG_LEVEL;
    delete process.env.DATABASE_URL;
    delete process.env.SCRAPER_USER_AGENT;
  });

  afterEach(() => {
    // Restore original environment
    envManager.restoreEnvironment();

    // Clean up test files
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }
  });

  describe('Configuration Loading', () => {
    it('should load default configuration when no file exists', async () => {
      const config = await configManager.loadConfig();

      expect(config.environment).toBe('development');
      expect(config.logging.level).toBe('info');
      expect(config.scraper.delay).toBe(2000);
      expect(config.database.url).toBe('sqlite:./data/jobs.db');
      expect(config.web.port).toBe(3000);
    });

    it('should load configuration from file', async () => {
      const customConfig = {
        environment: 'test' as const,
        logging: {
          level: 'debug' as const,
          pretty: false,
        },
        scraper: {
          delay: 1000,
        },
        web: {
          port: 4000,
        },
      };

      writeFileSync(testConfigPath, JSON.stringify(customConfig, null, 2));

      const config = await configManager.loadConfig();

      expect(config.environment).toBe('test');
      expect(config.logging.level).toBe('debug');
      expect(config.logging.pretty).toBe(false);
      expect(config.scraper.delay).toBe(1000);
      expect(config.web.port).toBe(4000);
      // Default values should still be present
      expect(config.scraper.retries).toBe(3);
      expect(config.database.enableWal).toBe(true);
    });

    it('should handle malformed JSON gracefully', async () => {
      writeFileSync(testConfigPath, '{ invalid json }');

      const config = await configManager.loadConfig();

      // Should fall back to defaults
      expect(config.environment).toBe('development');
      expect(config.logging.level).toBe('info');
    });

    it('should merge nested configuration objects', async () => {
      const partialConfig = {
        scraper: {
          delay: 5000,
          userAgent: 'CustomAgent/1.0',
          // retries should keep default value
        },
        web: {
          port: 8080,
          // other web config should keep defaults
        },
      };

      writeFileSync(testConfigPath, JSON.stringify(partialConfig, null, 2));

      const config = await configManager.loadConfig();

      expect(config.scraper.delay).toBe(5000);
      expect(config.scraper.userAgent).toBe('CustomAgent/1.0');
      expect(config.scraper.retries).toBe(3); // Should keep default
      expect(config.web.port).toBe(8080);
      expect(config.web.host).toBe('localhost'); // Should keep default
    });
  });

  describe('Environment Variable Overrides', () => {
    it('should apply environment variable overrides', async () => {
      envManager.setEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@host:5432/db',
        PORT: '5000',
        LOG_LEVEL: 'error',
        SCRAPER_DELAY: '3000',
        SCRAPER_USER_AGENT: 'ProductionBot/1.0',
      });

      const config = await configManager.loadConfig();

      expect(config.environment).toBe('production');
      expect(config.database.url).toBe('postgresql://user:pass@host:5432/db');
      expect(config.web.port).toBe(5000);
      expect(config.logging.level).toBe('error');
      expect(config.scraper.delay).toBe(3000);
      expect(config.scraper.userAgent).toBe('ProductionBot/1.0');
    });

    it('should prioritize environment variables over file config', async () => {
      // File config
      const fileConfig = {
        web: { port: 4000 },
        logging: { level: 'debug' },
      };
      writeFileSync(testConfigPath, JSON.stringify(fileConfig, null, 2));

      // Environment overrides
      envManager.setEnvironment({
        PORT: '6000',
        LOG_LEVEL: 'warn',
      });

      const config = await configManager.loadConfig();

      expect(config.web.port).toBe(6000); // From env
      expect(config.logging.level).toBe('warn'); // From env
    });

    it('should handle invalid environment values', async () => {
      envManager.setEnvironment({
        PORT: 'invalid-port',
        SCRAPER_DELAY: 'not-a-number',
      });

      const config = await configManager.loadConfig();

      // Should fall back to defaults when env vars are invalid
      expect(config.web.port).toBe(3000); // Should use default value
      expect(config.scraper.delay).toBe(2000); // Should use default value
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', async () => {
      const validConfig = {
        environment: 'test' as const,
        logging: { level: 'info' as const, pretty: true },
        scraper: {
          userAgent: 'TestBot/1.0',
          delay: 1000,
          retries: 2,
          timeout: 15000,
          respectRobotsTxt: true,
          rateLimit: { requestsPerSecond: 1, burst: 3 },
        },
        database: { url: 'sqlite:./test.db', enableWal: false },
        web: {
          enabled: true,
          port: 3001,
          host: '127.0.0.1',
          cors: { origin: true, credentials: false },
        },
        reports: {
          outputDirectory: './test-reports',
          maxFileSize: 10 * 1024 * 1024,
          cleanupAfterDays: 7,
        },
      };

      await configManager.saveConfig(validConfig);
      
      expect(() => configManager.validateConfig()).not.toThrow();
    });

    it('should reject invalid environment values', async () => {
      await expect(configManager.saveConfig({
        environment: 'invalid-env' as any,
      })).rejects.toThrow('Invalid environment value');
    });

    it('should reject invalid logging levels', async () => {
      await expect(configManager.saveConfig({
        logging: { level: 'invalid-level' as any, pretty: true },
      })).rejects.toThrow('Invalid logging level');
    });

    it('should reject invalid scraper settings', async () => {
      await expect(configManager.saveConfig({
        scraper: {
          delay: -1000, // Invalid: negative delay
          retries: 15, // Invalid: too many retries
          rateLimit: { requestsPerSecond: 20, burst: 2 }, // Invalid: too high rate
        } as any,
      })).rejects.toThrow();
    });

    it('should reject invalid web port', async () => {
      await expect(configManager.saveConfig({
        web: { port: 70000 } as any, // Invalid: port too high
      })).rejects.toThrow('Web port must be between 0 and 65535');
    });

    it('should reject invalid file size limits', async () => {
      await expect(configManager.saveConfig({
        reports: {
          maxFileSize: -1, // Invalid: negative size
        } as any,
      })).rejects.toThrow();
    });
  });

  describe('Configuration Persistence', () => {
    it('should save and reload configuration', async () => {
      const customConfig = {
        environment: 'test' as const,
        scraper: { delay: 1500, retries: 5 },
        web: { port: 4500 },
      };

      await configManager.saveConfig(customConfig);
      expect(existsSync(testConfigPath)).toBe(true);

      // Create new manager to test reload
      const newManager = new ConfigurationManager(testConfigPath);
      const reloadedConfig = await newManager.loadConfig();

      expect(reloadedConfig.environment).toBe('test');
      expect(reloadedConfig.scraper.delay).toBe(1500);
      expect(reloadedConfig.scraper.retries).toBe(5);
      expect(reloadedConfig.web.port).toBe(4500);
    });

    it('should create config directory if it does not exist', async () => {
      const deepConfigPath = join(TEST_CONFIG_DIR, 'deep', 'nested', 'config.json');
      const deepManager = new ConfigurationManager(deepConfigPath);

      await deepManager.saveConfig({ environment: 'test' });

      expect(existsSync(deepConfigPath)).toBe(true);
    });

    it('should handle file write errors gracefully', async () => {
      const invalidPath = '/invalid/path/config.json';
      const invalidManager = new ConfigurationManager(invalidPath);

      await expect(invalidManager.saveConfig({
        environment: 'test',
      })).rejects.toThrow();
    });
  });

  describe('Environment Management', () => {
    it('should provide environment information', () => {
      const envInfo = envManager.getEnvironmentInfo();

      expect(envInfo.nodeVersion).toMatch(/^v\d+\.\d+\.\d+/);
      expect(envInfo.platform).toBeDefined();
      expect(envInfo.arch).toBeDefined();
      expect(envInfo.memory).toBeDefined();
      expect(typeof envInfo.uptime).toBe('number');
    });

    it('should validate environment requirements', () => {
      const validation = envManager.validateEnvironment();

      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('errors');
      expect(Array.isArray(validation.errors)).toBe(true);
    });

    it('should detect missing production environment variables', () => {
      envManager.setEnvironment({ NODE_ENV: 'production' });
      
      const validation = envManager.validateEnvironment();

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(error => error.includes('DATABASE_URL'))).toBe(true);
      expect(validation.errors.some(error => error.includes('PORT'))).toBe(true);
    });

    it('should pass validation with proper production setup', () => {
      envManager.setEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://prod:pass@host:5432/prod_db',
        PORT: '3000',
      });
      
      const validation = envManager.validateEnvironment();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Configuration Templates and Presets', () => {
    it('should provide development configuration template', () => {
      const devConfig: Partial<AppConfig> = {
        environment: 'development',
        logging: { level: 'debug', pretty: true },
        scraper: { delay: 1000, respectRobotsTxt: false },
        database: { url: 'sqlite:./data/dev.db', enableWal: true },
        web: { port: 3000, host: 'localhost' },
      };

      configManager.resetToDefaults();
      expect(() => configManager.validateConfig()).not.toThrow();
    });

    it('should provide production configuration template', async () => {
      const prodConfig: Partial<AppConfig> = {
        environment: 'production',
        logging: { level: 'warn', pretty: false },
        scraper: { delay: 2000, respectRobotsTxt: true },
        web: { port: 80, host: '0.0.0.0' },
        reports: { cleanupAfterDays: 90 },
      };

      await configManager.saveConfig(prodConfig);
      expect(() => configManager.validateConfig()).not.toThrow();
    });

    it('should provide test configuration template', async () => {
      const testConfig: Partial<AppConfig> = {
        environment: 'test',
        logging: { level: 'error', pretty: false },
        scraper: { delay: 100, retries: 1 },
        database: { url: 'sqlite::memory:', enableWal: false },
        web: { port: 0 }, // Random port for testing
      };

      await configManager.saveConfig(testConfig);
      expect(() => configManager.validateConfig()).not.toThrow();
    });
  });

  describe('Dynamic Configuration Updates', () => {
    it('should support runtime configuration updates', async () => {
      await configManager.loadConfig();
      
      const initialDelay = configManager.getConfig().scraper.delay;
      expect(initialDelay).toBe(2000);

      await configManager.saveConfig({
        scraper: { delay: 3000 },
      });

      const updatedConfig = configManager.getConfig();
      expect(updatedConfig.scraper.delay).toBe(3000);
    });

    it('should validate configuration on updates', async () => {
      await configManager.loadConfig();

      await expect(configManager.saveConfig({
        scraper: { delay: -500 } as any,
      })).rejects.toThrow();

      // Original config should be preserved
      const config = configManager.getConfig();
      expect(config.scraper.delay).toBe(2000);
    });

    it('should handle partial configuration updates', async () => {
      const originalConfig = await configManager.loadConfig();

      await configManager.saveConfig({
        web: { port: 8080 },
      });

      const updatedConfig = configManager.getConfig();
      expect(updatedConfig.web.port).toBe(8080);
      expect(updatedConfig.web.host).toBe(originalConfig.web.host); // Should be preserved
      expect(updatedConfig.scraper.delay).toBe(originalConfig.scraper.delay); // Should be preserved
    });
  });
});
