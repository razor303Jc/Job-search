import { z } from 'zod';

/**
 * Zod schemas for job data validation and parsing
 */

export const salarySchema = z
  .object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
    currency: z.string().length(3).default('USD'), // ISO 4217 currency codes
    period: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'yearly']).default('yearly'),
  })
  .refine((data) => !data.min || !data.max || data.min <= data.max, {
    message: 'Minimum salary must be less than or equal to maximum salary',
  });

export const jobSourceSchema = z.object({
  site: z.string().min(1),
  originalUrl: z.string().url(),
  scrapedAt: z.date(),
});

export const jobMetadataSchema = z.object({
  confidence: z.number().min(0).max(1), // 0-1 score for parsing confidence
  rawData: z.record(z.unknown()).optional(),
});

export const jobListingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().min(1),
  description: z.string().min(1),
  url: z.string().url(),
  salary: salarySchema.optional(),
  employmentType: z.enum([
    'full-time',
    'part-time',
    'contract',
    'temporary',
    'internship',
    'freelance',
  ]),
  remote: z.boolean(),
  postedDate: z.date().optional(),
  expiryDate: z.date().optional(),
  requirements: z.array(z.string()),
  benefits: z.array(z.string()),
  tags: z.array(z.string()),
  source: jobSourceSchema,
  metadata: jobMetadataSchema,
});

export const scrapingErrorSchema = z.object({
  type: z.enum(['network', 'parsing', 'rate-limit', 'blocked', 'unknown']),
  message: z.string().min(1),
  url: z.string().url().optional(),
  timestamp: z.date(),
  retry: z.boolean().optional(),
});

export const scrapeResultMetadataSchema = z.object({
  totalFound: z.number().min(0),
  totalScraped: z.number().min(0),
  successRate: z.number().min(0).max(100),
  duration: z.number().min(0),
  errors: z.array(scrapingErrorSchema),
  sources: z.array(z.string()),
});

export const scrapeResultSchema = z.object({
  jobs: z.array(jobListingSchema),
  metadata: scrapeResultMetadataSchema,
});

/**
 * Raw job data schema for initial parsing before validation
 */
export const rawJobDataSchema = z.object({
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  salaryText: z.string().optional(),
  employmentTypeText: z.string().optional(),
  postedDateText: z.string().optional(),
  requirementsText: z.string().optional(),
  benefitsText: z.string().optional(),
  tagsText: z.string().optional(),
  rawHtml: z.string().optional(),
});

/**
 * Database job listing schema (with string dates for SQLite)
 */
export const dbJobListingSchema = jobListingSchema
  .extend({
    postedDate: z.string().optional(), // ISO string for SQLite
    expiryDate: z.string().optional(), // ISO string for SQLite
    sourceData: z.string(), // JSON string
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .omit({ source: true });

/**
 * Job validation and transformation utilities
 */
export class JobValidator {
  /**
   * Validate a job listing against the schema
   */
  static validateJob(
    data: unknown,
  ): z.SafeParseReturnType<unknown, z.infer<typeof jobListingSchema>> {
    return jobListingSchema.safeParse(data);
  }

  /**
   * Validate raw job data
   */
  static validateRawJobData(
    data: unknown,
  ): z.SafeParseReturnType<unknown, z.infer<typeof rawJobDataSchema>> {
    return rawJobDataSchema.safeParse(data);
  }

  /**
   * Transform raw job data to validated job listing
   */
  static transformRawToJob(
    rawData: z.infer<typeof rawJobDataSchema>,
    source: z.infer<typeof jobSourceSchema>,
  ): Partial<z.infer<typeof jobListingSchema>> {
    const id = JobValidator.generateJobId(
      rawData.title || '',
      rawData.company || '',
      rawData.url || '',
    );

    return {
      id,
      title: rawData.title?.trim() || 'Unknown Title',
      company: rawData.company?.trim() || 'Unknown Company',
      location: rawData.location?.trim() || 'Unknown Location',
      description: rawData.description?.trim() || '',
      url: rawData.url || source.originalUrl,
      salary: JobValidator.parseSalary(rawData.salaryText),
      employmentType: JobValidator.parseEmploymentType(rawData.employmentTypeText),
      remote: JobValidator.isRemoteJob(rawData.location, rawData.description),
      postedDate: JobValidator.parseDate(rawData.postedDateText),
      requirements: JobValidator.parseList(rawData.requirementsText),
      benefits: JobValidator.parseList(rawData.benefitsText),
      tags: JobValidator.parseList(rawData.tagsText),
      source,
      metadata: {
        confidence: JobValidator.calculateConfidence(rawData),
        rawData: rawData.rawHtml ? { html: rawData.rawHtml } : undefined,
      },
    };
  }

  /**
   * Calculate parsing confidence score based on available data
   */
  private static calculateConfidence(rawData: z.infer<typeof rawJobDataSchema>): number {
    let score = 0;
    const weights = {
      title: 0.25,
      company: 0.2,
      location: 0.15,
      description: 0.15,
      url: 0.1,
      salaryText: 0.05,
      employmentTypeText: 0.05,
      postedDateText: 0.05,
    };

    for (const [field, weight] of Object.entries(weights)) {
      if (rawData[field as keyof typeof rawData]) {
        score += weight;
      }
    }

    return Math.round(score * 100) / 100;
  }

  /**
   * Generate unique job ID
   */
  private static generateJobId(title: string, company: string, url: string): string {
    const baseString = `${title}-${company}-${url}`.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < baseString.length; i++) {
      const char = baseString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Parse salary information from text
   */
  private static parseSalary(text?: string): z.infer<typeof salarySchema> | undefined {
    if (!text) return undefined;

    // Clean up the text but keep original for currency/period detection
    const cleanText = text.toLowerCase().replace(/[,\s]/g, '');

    const patterns = [
      // $80,000 - $110,000 per year (with commas)
      /\$(\d+)(?:,\d{3})*-\$?(\d+)(?:,\d{3})*(?:peryear|annually|yearly)?/,
      // $50k - $80k
      /\$(\d+)k-\$?(\d+)k/,
      // £40,000 - £60,000
      /£(\d+)(?:,\d{3})*-£?(\d+)(?:,\d{3})*/,
      // €45,000 - €65,000
      /€(\d+)(?:,\d{3})*-€?(\d+)(?:,\d{3})*/,
      // $25 - $35 per hour
      /\$(\d+)-\$?(\d+)(?:perhour|hourly|hour)?/,
    ];

    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match?.[1] && match[2]) {
        let min = Number.parseInt(match[1], 10);
        let max = Number.parseInt(match[2], 10);

        // Handle 'k' notation
        if (text.toLowerCase().includes('k')) {
          min *= 1000;
          max *= 1000;
        }

        // Determine currency
        let currency = 'USD';
        if (text.includes('£')) currency = 'GBP';
        else if (text.includes('€')) currency = 'EUR';

        // Determine period
        let period: z.infer<typeof salarySchema>['period'] = 'yearly';
        if (text.toLowerCase().includes('hour')) period = 'hourly';
        else if (text.toLowerCase().includes('month')) period = 'monthly';

        return { min, max, currency, period };
      }
    }

    return undefined;
  }

  /**
   * Parse employment type from text
   */
  private static parseEmploymentType(
    text?: string,
  ): z.infer<typeof jobListingSchema>['employmentType'] {
    if (!text) return 'full-time';

    const normalized = text.toLowerCase().trim();

    if (normalized.includes('full') && normalized.includes('time')) return 'full-time';
    if (normalized.includes('part') && normalized.includes('time')) return 'part-time';
    if (normalized.includes('contract')) return 'contract';
    if (normalized.includes('temporary') || normalized.includes('temp')) return 'temporary';
    if (normalized.includes('intern')) return 'internship';
    if (normalized.includes('freelance') || normalized.includes('consultant')) return 'freelance';

    return 'full-time';
  }

  /**
   * Check if job is remote
   */
  private static isRemoteJob(location?: string, description?: string): boolean {
    const text = `${location || ''} ${description || ''}`.toLowerCase();
    const remoteKeywords = ['remote', 'work from home', 'wfh', 'distributed', 'anywhere'];

    return remoteKeywords.some((keyword) => text.includes(keyword));
  }

  /**
   * Parse date from various text formats
   */
  private static parseDate(text?: string): Date | undefined {
    if (!text) return undefined;

    try {
      // Handle relative dates
      const now = new Date();
      const normalized = text.toLowerCase().trim();

      if (normalized.includes('today') || normalized.includes('just now')) {
        return now;
      }

      if (normalized.includes('yesterday')) {
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const daysMatch = normalized.match(/(\d+)\s*days?\s*ago/);
      if (daysMatch?.[1]) {
        const days = Number.parseInt(daysMatch[1], 10);
        return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      }

      const weeksMatch = normalized.match(/(\d+)\s*weeks?\s*ago/);
      if (weeksMatch?.[1]) {
        const weeks = Number.parseInt(weeksMatch[1], 10);
        return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
      }

      // Try to parse as regular date
      const parsedDate = new Date(text);
      return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
    } catch {
      return undefined;
    }
  }

  /**
   * Parse comma or newline-separated list
   */
  private static parseList(text?: string): string[] {
    if (!text) return [];

    return text
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
}

// Export inferred types
export type JobListing = z.infer<typeof jobListingSchema>;
export type RawJobData = z.infer<typeof rawJobDataSchema>;
export type ScrapeResult = z.infer<typeof scrapeResultSchema>;
export type ScrapingError = z.infer<typeof scrapingErrorSchema>;
export type DbJobListing = z.infer<typeof dbJobListingSchema>;
