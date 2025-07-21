import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import { type AppConfig, appConfigSchema } from './schemas.js';
import { logger } from '@/utils/logger.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Default configuration values
 */
const defaultConfig: AppConfig = {
  environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
  logging: {
    level: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
    pretty: process.env.LOG_PRETTY === 'true' || process.env.NODE_ENV === 'development',
  },
  scraper: {
    userAgent: process.env.SCRAPER_USER_AGENT || 'Mozilla/5.0 (compatible; JobDorker/1.0)',
    delay: Number.parseInt(process.env.SCRAPER_DELAY || '2000', 10),
    retries: Number.parseInt(process.env.SCRAPER_RETRIES || '3', 10),
    timeout: Number.parseInt(process.env.SCRAPER_TIMEOUT || '30000', 10),
    respectRobotsTxt: process.env.SCRAPER_RESPECT_ROBOTS !== 'false',
    rateLimit: {
      requestsPerSecond: Number.parseFloat(process.env.SCRAPER_RATE_LIMIT || '0.5'),
      burst: Number.parseInt(process.env.SCRAPER_BURST || '2', 10),
    },
  },
  database: {
    url: process.env.DATABASE_URL || 'sqlite:./data/jobs.db',
    enableWal: process.env.DATABASE_WAL !== 'false',
  },
  queue: {
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      db: Number.parseInt(process.env.REDIS_DB || '0', 10),
    },
    defaultJobOptions: {
      removeOnComplete: Number.parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE || '100', 10),
      removeOnFail: Number.parseInt(process.env.QUEUE_REMOVE_ON_FAIL || '50', 10),
      attempts: Number.parseInt(process.env.QUEUE_ATTEMPTS || '3', 10),
      backoff: {
        type: (process.env.QUEUE_BACKOFF_TYPE as 'exponential' | 'fixed') || 'exponential',
        delay: Number.parseInt(process.env.QUEUE_BACKOFF_DELAY || '2000', 10),
      },
    },
  },
  web: {
    enabled: process.env.WEB_ENABLED === 'true',
    port: Number.parseInt(process.env.WEB_PORT || process.env.PORT || '3000', 10),
    host: process.env.WEB_HOST || 'localhost',
    cors: {
      origin: process.env.CORS_ORIGIN ? JSON.parse(process.env.CORS_ORIGIN) : false,
      credentials: process.env.CORS_CREDENTIALS === 'true',
    },
  },
  reports: {
    outputDirectory: process.env.REPORTS_OUTPUT_DIR || './reports',
    maxFileSize: Number.parseInt(process.env.REPORTS_MAX_FILE_SIZE || String(50 * 1024 * 1024), 10),
    cleanupAfterDays: Number.parseInt(process.env.REPORTS_CLEANUP_DAYS || '30', 10),
  },
};

/**
 * Configuration manager class
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;
  private configPath: string;

  private constructor() {
    this.configPath = this.resolveConfigPath();
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private resolveConfigPath(): string {
    const configPaths = [
      process.env.CONFIG_PATH,
      './config.json',
      './config/config.json',
      path.join(__dirname, '../../config.json'),
      path.join(__dirname, '../../config/config.json'),
    ];

    for (const configPath of configPaths) {
      if (configPath && fs.existsSync(configPath)) {
        return path.resolve(configPath);
      }
    }

    return path.join(__dirname, '../../config.json');
  }

  private loadConfig(): AppConfig {
    try {
      let fileConfig = {};

      // Try to load from config file
      if (fs.existsSync(this.configPath)) {
        const configContent = fs.readFileSync(this.configPath, 'utf-8');
        fileConfig = JSON.parse(configContent);
        logger.info({ configPath: this.configPath }, 'Loaded configuration from file');
      } else {
        logger.info('No config file found, using environment variables and defaults');
      }

      // Merge configurations: defaults < file < environment variables
      const mergedConfig = this.deepMerge(defaultConfig, fileConfig);

      // Validate configuration
      const validatedConfig = appConfigSchema.parse(mergedConfig);

      logger.info(
        {
          environment: validatedConfig.environment,
          logLevel: validatedConfig.logging.level,
          scraperDelay: validatedConfig.scraper.delay,
          webEnabled: validatedConfig.web.enabled,
        },
        'Configuration loaded and validated successfully'
      );

      return validatedConfig;
    } catch (error) {
      logger.error({ err: error, configPath: this.configPath }, 'Failed to load configuration');
      throw new Error(`Configuration loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  public reload(): void {
    logger.info('Reloading configuration...');
    this.config = this.loadConfig();
  }

  public saveConfig(config: Partial<AppConfig>): void {
    try {
      const updatedConfig = this.deepMerge(this.config, config);
      const validatedConfig = appConfigSchema.parse(updatedConfig);

      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(validatedConfig, null, 2));
      this.config = validatedConfig;

      logger.info({ configPath: this.configPath }, 'Configuration saved successfully');
    } catch (error) {
      logger.error({ err: error, configPath: this.configPath }, 'Failed to save configuration');
      throw new Error(`Configuration saving failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public resetConfig(): void {
    logger.info('Resetting configuration to defaults...');
    this.config = appConfigSchema.parse(defaultConfig);
    
    if (fs.existsSync(this.configPath)) {
      fs.unlinkSync(this.configPath);
      logger.info({ configPath: this.configPath }, 'Configuration file deleted');
    }
  }

  public validateConfig(config: unknown): AppConfig {
    return appConfigSchema.parse(config);
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();

// Export convenience function to get current config
export const getConfig = (): AppConfig => configManager.getConfig();

// Export default config for testing
export { defaultConfig };