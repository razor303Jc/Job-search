import { createLogger } from '../utils/logger.js';
import type { JobListing, JobSalary } from './schemas/job.schema.js';
import { JobListingSchema } from './schemas/job.schema.js';

const logger = createLogger({ module: 'job-parser' });

/**
 * Salary parsing utilities
 */
export class SalaryParser {
  // Common salary patterns - order matters, most specific patterns first
  private static readonly SALARY_PATTERNS = [
    // RANGE PATTERNS FIRST
    // $50,000 - $75,000 per year
    /\$?([\d,]+k?)\s*-\s*\$?([\d,]+k?)\s*\/?\s*(?:per\s+)?(year|annually|yearly|annual)/i,
    // $25-30/hour
    /\$?([\d,]+k?)\s*-\s*\$?([\d,]+k?)\s*\/?\s*(?:per\s+)?(hour|hourly)/i,
    // $5000-6000/month
    /\$?([\d,]+k?)\s*-\s*\$?([\d,]+k?)\s*\/?\s*(?:per\s+)?(month|monthly)/i,
    // £40,000 - £60,000
    /£([\d,]+k?)\s*-\s*£?([\d,]+k?)\s*\/?\s*(?:per\s+)?(year|annually|yearly|annual)?/i,
    // €45,000 - €50,000
    /€([\d,]+k?)\s*-\s*€?([\d,]+k?)\s*\/?\s*(?:per\s+)?(year|annually|yearly|annual)?/i,

    // SINGLE AMOUNT PATTERNS
    // $60,000/year or $60k/year - with explicit period
    /\$?([\d,]+k?)\s*\/?\s*(?:per\s+)?(year|annually|yearly|annual)/i,
    // $25/hour - with explicit period
    /\$?([\d,]+k?)\s*\/?\s*(?:per\s+)?(hour|hourly)/i,
    // $5000/month - with explicit period
    /\$?([\d,]+k?)\s*\/?\s*(?:per\s+)?(month|monthly)/i,
    // €45,000/year - with explicit period
    /€([\d,]+k?)\s*\/?\s*(?:per\s+)?(year|annually|yearly|annual)/i,
    // £45,000 - assumes yearly if no period specified
    /£([\d,]+k?)(?!\s*-)/i,
    // €45,000 - assumes yearly if no period specified
    /€([\d,]+k?)(?!\s*-)/i,
  ];

  private static readonly CURRENCY_SYMBOLS = {
    $: 'USD',
    '£': 'GBP',
    '€': 'EUR',
    '¥': 'JPY',
    '₹': 'INR',
  };

  /**
   * Parse salary information from text
   */
  static parseSalary(text: string): JobSalary | null {
    if (!text) return null;

    const cleanText = text.replace(/\s+/g, ' ').trim();

    for (const pattern of SalaryParser.SALARY_PATTERNS) {
      const match = cleanText.match(pattern);
      if (match) {
        return SalaryParser.extractSalaryFromMatch(match, cleanText);
      }
    }

    return null;
  }

  private static extractSalaryFromMatch(
    match: RegExpMatchArray,
    originalText: string,
  ): JobSalary | null {
    try {
      const currency = SalaryParser.detectCurrency(originalText);

      // Check if this is a range pattern (has multiple amounts)
      if (match.length >= 4 && match[2] && /^\d/.test(match[2])) {
        // Range pattern: match[1] is min, match[2] is max, match[3] is period
        const minStr = match[1];
        const maxStr = match[2];
        const period = SalaryParser.normalizePeriod(match[3] || 'yearly');

        if (minStr && maxStr) {
          const min = SalaryParser.parseAmount(minStr);
          const max = SalaryParser.parseAmount(maxStr);

          if (min && max) {
            return {
              min: Math.min(min, max),
              max: Math.max(min, max),
              currency,
              period,
            };
          }
        }
      } else if (match.length >= 2) {
        // Single amount pattern: match[1] is amount, match[2] is period (if present)
        const amountStr = match[1];
        const period = SalaryParser.normalizePeriod(match[2] || 'yearly');

        if (amountStr) {
          const amount = SalaryParser.parseAmount(amountStr);
          if (amount) {
            return {
              min: amount,
              max: amount,
              currency,
              period,
            };
          }
        }
      }
    } catch (error) {
      logger.debug('Error parsing salary match:', { match, error });
    }

    return null;
  }

  private static parseAmount(amountStr: string): number | null {
    if (!amountStr) return null;

    // Remove commas and normalize
    const cleanAmount = amountStr.replace(/,/g, '').toLowerCase();

    // Handle 'k' suffix (thousands)
    if (cleanAmount.endsWith('k')) {
      const num = Number.parseFloat(cleanAmount.slice(0, -1));
      return Number.isNaN(num) ? null : num * 1000;
    }

    const num = Number.parseFloat(cleanAmount);
    return Number.isNaN(num) ? null : num;
  }

  private static detectCurrency(text: string): string {
    for (const [symbol, code] of Object.entries(SalaryParser.CURRENCY_SYMBOLS)) {
      if (text.includes(symbol)) {
        return code;
      }
    }
    return 'USD'; // Default to USD
  }

  private static normalizePeriod(period: string): JobSalary['period'] {
    const p = period.toLowerCase();
    if (p.includes('hour')) return 'hourly';
    if (p.includes('day')) return 'daily';
    if (p.includes('week')) return 'weekly';
    if (p.includes('month')) return 'monthly';
    return 'yearly';
  }
}

/**
 * Date parsing utilities
 */
export class DateParser {
  /**
   * Parse date from text
   */
  static parseDate(text: string): Date | null {
    if (!text) return null;

    const cleanText = text.replace(/\s+/g, ' ').trim().toLowerCase();

    // Try relative dates first
    const relativeDate = DateParser.parseRelativeDate(cleanText);
    if (relativeDate) return relativeDate;

    // Try absolute dates
    return DateParser.parseAbsoluteDate(text);
  }

  private static parseRelativeDate(text: string): Date | null {
    const now = new Date();

    // Days ago
    const daysMatch = text.match(/(\d+)\s+(day|days)\s+ago/);
    if (daysMatch?.[1]) {
      const days = Number.parseInt(daysMatch[1]);
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    // Weeks ago
    const weeksMatch = text.match(/(\d+)\s+(week|weeks)\s+ago/);
    if (weeksMatch?.[1]) {
      const weeks = Number.parseInt(weeksMatch[1]);
      return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    }

    // Months ago
    const monthsMatch = text.match(/(\d+)\s+(month|months)\s+ago/);
    if (monthsMatch?.[1]) {
      const months = Number.parseInt(monthsMatch[1]);
      const date = new Date(now);
      date.setMonth(date.getMonth() - months);
      return date;
    }

    return null;
  }

  private static parseAbsoluteDate(text: string): Date | null {
    try {
      // Try parsing as ISO date or common formats
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }
}

/**
 * Main job parser class
 */
export class JobParser {
  /**
   * Parse raw job data into structured JobListing
   */
  static parseJob(
    rawData: Record<string, unknown>,
    source: {
      site: string;
      originalUrl: string;
    },
  ): JobListing | null {
    try {
      // Extract basic fields
      const title = JobParser.extractString(rawData.title);
      const company = JobParser.extractString(rawData.company);
      const location = JobParser.extractString(rawData.location);
      const description = JobParser.extractString(rawData.description);
      const url = JobParser.extractString(rawData.url);

      if (!title || !company || !location || !description || !url) {
        logger.debug('Missing required fields in job data', { rawData });
        return null;
      }

      // Generate ID from URL or create hash
      const id = JobParser.generateJobId(url, title, company);

      // Parse optional fields
      const salary =
        SalaryParser.parseSalary(JobParser.extractString(rawData.salary) || description) ||
        undefined; // Convert null to undefined

      const postedDate =
        DateParser.parseDate(
          JobParser.extractString(rawData.postedDate) ||
            JobParser.extractString(rawData.posted) ||
            '',
        ) || undefined; // Convert null to undefined

      const requirements = JobParser.extractStringArray(rawData.requirements);
      const benefits = JobParser.extractStringArray(rawData.benefits);
      const tags = JobParser.extractStringArray(rawData.tags);

      // Determine employment type
      const employmentType = JobParser.parseEmploymentType(
        JobParser.extractString(rawData.employmentType) || description,
      );

      // Determine if remote
      const remote = JobParser.parseRemoteStatus(location, description);

      // Create job listing
      const jobData = {
        id,
        title,
        company,
        location,
        description,
        url,
        salary,
        employmentType,
        remote,
        postedDate,
        requirements,
        benefits,
        tags,
        source: {
          site: source.site,
          originalUrl: source.originalUrl,
          scrapedAt: new Date(),
        },
        metadata: {
          confidence: JobParser.calculateConfidence(rawData),
          rawData,
        },
      };

      // Validate with schema
      const validatedJob = JobListingSchema.parse(jobData);
      return validatedJob;
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Error parsing job data:', {
          error: error.message,
          rawDataSample: `${JSON.stringify(rawData).substring(0, 200)}...`,
        });
      } else {
        logger.error('Unknown error parsing job data:', {
          error: JSON.stringify(error),
          rawDataSample: `${JSON.stringify(rawData).substring(0, 200)}...`,
        });
      }
      return null;
    }
  }

  private static extractString(value: unknown): string | null {
    if (typeof value === 'string') return value.trim() || null;
    if (typeof value === 'number') return value.toString();
    return null;
  }

  private static extractStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => JobParser.extractString(item))
        .filter((item): item is string => item !== null);
    }
    if (typeof value === 'string') {
      // Split by common delimiters
      return value
        .split(/[,;·•\n]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    return [];
  }

  private static generateJobId(url: string, title: string, company: string): string {
    // Use URL if it contains an ID
    const urlId = url.match(/\/(\d+)$/)?.[1];
    if (urlId) return urlId;

    // Create hash from title + company
    const text = `${title}-${company}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    return text.substring(0, 32) + Date.now().toString(36);
  }

  private static parseEmploymentType(text: string): JobListing['employmentType'] {
    if (!text) return 'full-time';

    const lower = text.toLowerCase();
    if (lower.includes('part-time') || lower.includes('part time')) return 'part-time';
    if (lower.includes('contract') || lower.includes('contractor')) return 'contract';
    if (lower.includes('temporary') || lower.includes('temp')) return 'temporary';
    if (lower.includes('intern')) return 'internship';
    if (lower.includes('freelance') || lower.includes('freelancer')) return 'freelance';

    return 'full-time';
  }

  private static parseRemoteStatus(location: string, description: string): boolean {
    const text = `${location} ${description}`.toLowerCase();
    return (
      text.includes('remote') ||
      text.includes('work from home') ||
      text.includes('wfh') ||
      text.includes('distributed')
    );
  }

  private static calculateConfidence(rawData: Record<string, unknown>): number {
    let score = 0.5; // Base score

    // Boost for having salary info
    if (rawData.salary) score += 0.1;

    // Boost for having posted date
    if (rawData.postedDate || rawData.posted) score += 0.1;

    // Boost for having requirements
    if (rawData.requirements) score += 0.1;

    // Boost for having benefits
    if (rawData.benefits) score += 0.1;

    // Boost for longer description
    const description = JobParser.extractString(rawData.description);
    if (description && description.length > 500) score += 0.1;

    return Math.min(score, 1.0);
  }
}
