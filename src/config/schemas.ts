import { z } from 'zod';

/**
 * Configuration schemas for validation with Zod
 */

export const scraperConfigSchema = z.object({
  userAgent: z.string().default('Mozilla/5.0 (compatible; JobDorker/1.0)'),
  delay: z.number().min(1000).max(10000).default(2000), // 1-10 seconds
  retries: z.number().min(0).max(5).default(3),
  timeout: z.number().min(5000).max(60000).default(30000), // 5-60 seconds
  respectRobotsTxt: z.boolean().default(true),
  rateLimit: z.object({
    requestsPerSecond: z.number().min(0.1).max(10).default(0.5), // Max 0.5 requests/second (respectful)
    burst: z.number().min(1).max(10).default(2),
  }),
});

export const googleDorkConfigSchema = z.object({
  site: z.string().min(1),
  keywords: z.array(z.string()).min(1),
  excludeKeywords: z.array(z.string()).optional(),
  fileTypes: z.array(z.string()).optional(),
  customParams: z.record(z.string()).optional(),
});

export const jobSearchCriteriaSchema = z.object({
  keywords: z.array(z.string()).min(1),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  salaryMin: z.number().min(0).optional(),
  salaryMax: z.number().min(0).optional(),
  employmentTypes: z.array(z.enum(['full-time', 'part-time', 'contract', 'temporary', 'internship', 'freelance'])).optional(),
  excludeKeywords: z.array(z.string()).optional(),
  datePosted: z.enum(['today', 'week', 'month', 'any']).optional(),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'executive']).optional(),
  maxResults: z.number().min(1).max(1000).default(100),
});

export const reportOptionsSchema = z.object({
  format: z.enum(['csv', 'json', 'pdf']).default('json'),
  outputPath: z.string().optional(),
  template: z.string().optional(),
  filters: z.object({
    minSalary: z.number().min(0).optional(),
    maxSalary: z.number().min(0).optional(),
    location: z.string().optional(),
    remote: z.boolean().optional(),
    keywords: z.array(z.string()).optional(),
  }).optional(),
  analytics: z.boolean().default(false),
  groupBy: z.enum(['company', 'location', 'salary', 'employmentType']).optional(),
});

export const appConfigSchema = z.object({
  environment: z.enum(['development', 'production', 'test']).default('development'),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    pretty: z.boolean().default(true),
  }),
  scraper: scraperConfigSchema,
  database: z.object({
    url: z.string().default('sqlite:./data/jobs.db'),
    enableWal: z.boolean().default(true),
  }),
  queue: z.object({
    redis: z.object({
      url: z.string().default('redis://localhost:6379'),
      db: z.number().min(0).max(15).default(0),
    }),
    defaultJobOptions: z.object({
      removeOnComplete: z.number().default(100),
      removeOnFail: z.number().default(50),
      attempts: z.number().default(3),
      backoff: z.object({
        type: z.enum(['exponential', 'fixed']).default('exponential'),
        delay: z.number().default(2000),
      }),
    }),
  }),
  web: z.object({
    enabled: z.boolean().default(false),
    port: z.number().min(1).max(65535).default(3000),
    host: z.string().default('localhost'),
    cors: z.object({
      origin: z.union([z.string(), z.array(z.string()), z.boolean()]).default(false),
      credentials: z.boolean().default(false),
    }),
  }),
  reports: z.object({
    outputDirectory: z.string().default('./reports'),
    maxFileSize: z.number().default(50 * 1024 * 1024), // 50MB
    cleanupAfterDays: z.number().default(30),
  }),
});

// Export inferred types
export type ScraperConfig = z.infer<typeof scraperConfigSchema>;
export type GoogleDorkConfig = z.infer<typeof googleDorkConfigSchema>;
export type JobSearchCriteria = z.infer<typeof jobSearchCriteriaSchema>;
export type ReportOptions = z.infer<typeof reportOptionsSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;