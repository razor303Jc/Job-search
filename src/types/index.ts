import type { z } from 'zod';

/**
 * Core job listing interface
 */
export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  salary?: {
    min?: number;
    max?: number;
    currency: string;
    period: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  };
  employmentType: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship' | 'freelance';
  remote: boolean;
  postedDate?: Date;
  expiryDate?: Date;
  requirements: string[];
  benefits: string[];
  tags: string[];
  source: {
    site: string;
    originalUrl: string;
    scrapedAt: Date;
  };
  metadata: {
    confidence: number; // 0-1 score for parsing confidence
    rawData?: Record<string, unknown>;
  };
}

/**
 * Search criteria for job scraping
 */
export interface JobSearchCriteria {
  keywords: string[];
  location?: string;
  remote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  employmentTypes?: JobListing['employmentType'][];
  excludeKeywords?: string[];
  datePosted?: 'today' | 'week' | 'month' | 'any';
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive';
  maxResults?: number;
}

/**
 * Configuration for Google Dorks
 */
export interface GoogleDorkConfig {
  site: string;
  keywords: string[];
  excludeKeywords?: string[];
  fileTypes?: string[];
  customParams?: Record<string, string>;
}

/**
 * Scraper configuration
 */
export interface ScraperConfig {
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

/**
 * Report generation options
 */
export interface ReportOptions {
  format: 'csv' | 'json' | 'pdf';
  outputPath?: string;
  template?: string;
  filters?: {
    minSalary?: number;
    maxSalary?: number;
    location?: string;
    remote?: boolean;
    keywords?: string[];
  };
  analytics?: boolean;
  groupBy?: 'company' | 'location' | 'salary' | 'employmentType';
}

/**
 * Scraping result with metadata
 */
export interface ScrapeResult {
  jobs: JobListing[];
  metadata: {
    totalFound: number;
    totalScraped: number;
    successRate: number;
    duration: number;
    errors: ScrapingError[];
    sources: string[];
  };
}

/**
 * Error handling for scraping operations
 */
export interface ScrapingError {
  type: 'network' | 'parsing' | 'rate-limit' | 'blocked' | 'unknown';
  message: string;
  url?: string;
  timestamp: Date;
  retry?: boolean;
}

/**
 * Database models
 */
export interface DbJobListing extends Omit<JobListing, 'postedDate' | 'expiryDate' | 'source'> {
  postedDate?: string; // ISO string for SQLite
  expiryDate?: string; // ISO string for SQLite
  sourceData: string; // JSON string
  createdAt: string;
  updatedAt: string;
}

/**
 * CLI command options
 */
export interface CliOptions {
  keywords?: string[];
  location?: string;
  remote?: boolean;
  output?: string;
  format?: ReportOptions['format'];
  maxResults?: number;
  verbose?: boolean;
  config?: string;
}

/**
 * Queue job data
 */
export interface QueueJobData {
  type: 'scrape' | 'parse' | 'report';
  searchCriteria?: JobSearchCriteria;
  reportOptions?: ReportOptions;
  priority?: number;
}

/**
 * Monitoring metrics
 */
export interface ScrapingMetrics {
  timestamp: Date;
  jobsScraped: number;
  successRate: number;
  averageResponseTime: number;
  errorsCount: number;
  memoryUsage: number;
  cpuUsage: number;
}

// Re-export Zod for schema validation
export type { z };

/**
 * Additional utility enums and types
 */
export const DatabaseType = {
  SQLITE: 'sqlite',
  POSTGRES: 'postgres',
  MYSQL: 'mysql',
} as const;

export const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
} as const;

export const JobBoard = {
  LINKEDIN: 'linkedin',
  INDEED: 'indeed',
  GLASSDOOR: 'glassdoor',
  STACKOVERFLOW: 'stackoverflow',
  GITHUB: 'github',
  REMOTE_OK: 'remote-ok',
  WEWORKREMOTELY: 'weworkremotely',
} as const;

export type DatabaseType = (typeof DatabaseType)[keyof typeof DatabaseType];
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];
export type JobBoard = (typeof JobBoard)[keyof typeof JobBoard];

/**
 * Environment configuration
 */
export type Environment = 'development' | 'production' | 'test';
