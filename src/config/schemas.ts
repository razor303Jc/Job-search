import { z } from 'zod';
import { DatabaseType, JobBoard, LogLevel } from '../types/index.js';

// Configuration schemas for validation
export const DatabaseConfigSchema = z.object({
  type: z.nativeEnum(DatabaseType),
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  database: z.string(),
  username: z.string().optional(),
  password: z.string().optional(),
  filename: z.string().optional(), // For SQLite
  poolSize: z.number().int().positive().default(10),
  timeout: z.number().int().positive().default(30000),
});

export const RateLimitConfigSchema = z.object({
  requestsPerMinute: z.number().int().positive().default(30),
  burstLimit: z.number().int().positive().default(10),
  backoffMultiplier: z.number().positive().default(2),
  maxRetries: z.number().int().nonnegative().default(3),
  retryDelay: z.number().int().positive().default(1000),
});

export const ScraperConfigSchema = z.object({
  userAgent: z.string().default('JobScraper/1.0 (+https://github.com/user/job-scraper)'),
  timeout: z.number().int().positive().default(30000),
  retries: z.number().int().nonnegative().default(3),
  retryDelay: z.number().int().positive().default(2000),
  enableImages: z.boolean().default(false),
  enableJavaScript: z.boolean().default(true),
  headless: z.boolean().default(true),
  viewport: z
    .object({
      width: z.number().int().positive().default(1920),
      height: z.number().int().positive().default(1080),
    })
    .default({}),
  proxies: z.array(z.string().url()).default([]),
  enableProxyRotation: z.boolean().default(false),
});

export const JobBoardConfigSchema = z.object({
  name: z.nativeEnum(JobBoard),
  enabled: z.boolean().default(true),
  baseUrl: z.string().url(),
  searchPaths: z.array(z.string()),
  selectors: z.object({
    jobCard: z.string(),
    title: z.string(),
    company: z.string(),
    location: z.string().optional(),
    salary: z.string().optional(),
    description: z.string().optional(),
    applyUrl: z.string().optional(),
    postedDate: z.string().optional(),
    jobType: z.string().optional(),
    experienceLevel: z.string().optional(),
    nextPage: z.string().optional(),
  }),
  waitSelectors: z.array(z.string()).default([]),
  rateLimit: RateLimitConfigSchema.optional(),
  maxPages: z.number().int().positive().default(5),
  maxJobsPerRun: z.number().int().positive().default(100),
});

export const NotificationConfigSchema = z.object({
  email: z
    .object({
      enabled: z.boolean().default(false),
      smtpHost: z.string().optional(),
      smtpPort: z.number().int().positive().optional(),
      smtpUser: z.string().optional(),
      smtpPassword: z.string().optional(),
      from: z.string().email().optional(),
      to: z.array(z.string().email()).default([]),
      subject: z.string().default('Job Scraper Report'),
    })
    .default({}),
  webhook: z
    .object({
      enabled: z.boolean().default(false),
      url: z.string().url().optional(),
      method: z.enum(['POST', 'PUT']).default('POST'),
      headers: z.record(z.string()).default({}),
      template: z.string().optional(),
    })
    .default({}),
  slack: z
    .object({
      enabled: z.boolean().default(false),
      webhookUrl: z.string().url().optional(),
      channel: z.string().optional(),
      username: z.string().default('Job Scraper'),
      icon: z.string().default(':briefcase:'),
    })
    .default({}),
});

export const AppConfigSchema = z.object({
  // Application settings
  app: z
    .object({
      name: z.string().default('Job Scraper'),
      version: z.string().default('1.0.0'),
      environment: z.enum(['development', 'staging', 'production']).default('development'),
      logLevel: z.nativeEnum(LogLevel).default(LogLevel.INFO),
      dataDir: z.string().default('./data'),
      configDir: z.string().default('./config'),
      maxConcurrentJobs: z.number().int().positive().default(3),
      cleanupRetentionDays: z.number().int().positive().default(30),
    })
    .default({}),

  // Database configuration
  database: DatabaseConfigSchema,

  // Scraper configuration
  scraper: ScraperConfigSchema.default({}),

  // Rate limiting
  rateLimit: RateLimitConfigSchema.default({}),

  // Job boards
  jobBoards: z.array(JobBoardConfigSchema).min(1),

  // Search configuration
  search: z.object({
    keywords: z.array(z.string()).min(1),
    locations: z.array(z.string()).default([]),
    excludeKeywords: z.array(z.string()).default([]),
    salaryMin: z.number().int().nonnegative().optional(),
    salaryMax: z.number().int().positive().optional(),
    jobTypes: z.array(z.string()).default([]),
    experienceLevels: z.array(z.string()).default([]),
    dateRange: z.number().int().positive().default(7), // days
  }),

  // Output configuration
  output: z
    .object({
      formats: z.array(z.enum(['json', 'csv', 'xlsx', 'html'])).default(['json']),
      filename: z.string().default('job_results_{timestamp}'),
      directory: z.string().default('./output'),
      includeCompanyLogos: z.boolean().default(false),
      includeFullDescription: z.boolean().default(true),
      deduplicate: z.boolean().default(true),
      sortBy: z.enum(['date', 'relevance', 'salary', 'company']).default('date'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    })
    .default({}),

  // Notification configuration
  notifications: NotificationConfigSchema.default({}),

  // Performance settings
  performance: z
    .object({
      enableCaching: z.boolean().default(true),
      cacheTimeout: z.number().int().positive().default(3600), // seconds
      enableCompression: z.boolean().default(true),
      enableMetrics: z.boolean().default(true),
      enableProfiling: z.boolean().default(false),
    })
    .default({}),

  // Security settings
  security: z
    .object({
      enableRateLimiting: z.boolean().default(true),
      enableRequestLogging: z.boolean().default(true),
      enableErrorReporting: z.boolean().default(false),
      obfuscatePersonalData: z.boolean().default(true),
      enableDataEncryption: z.boolean().default(false),
    })
    .default({}),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;
export type ScraperConfig = z.infer<typeof ScraperConfigSchema>;
export type JobBoardConfig = z.infer<typeof JobBoardConfigSchema>;
export type NotificationConfig = z.infer<typeof NotificationConfigSchema>;
