import { EventEmitter } from 'node:events';
import type { ScraperConfig } from '@/config/schemas.js';
import type { SiteConfig } from '@/config/sites.js';
import { logger } from '@/utils/logger.js';

/**
 * Scraping result interface
 */
export interface ScrapingResult {
  success: boolean;
  data?: JobListing[];
  error?: string;
  metadata: {
    url: string;
    timestamp: Date;
    duration: number;
    itemsFound: number;
    pagesParsed: number;
    retries: number;
  };
}

/**
 * Job listing data structure
 */
export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  description?: string;
  salary?: string;
  postedDate?: string;
  url: string;
  source: string;
  raw?: Record<string, unknown>;

  // Extracted metadata
  metadata: {
    scrapedAt: Date;
    confidence: number;
    hasDetails: boolean;
  };
}

/**
 * Rate limiter for controlling request frequency
 */
export class RateLimiter {
  private requests: number[] = [];

  constructor(
    private requestsPerMinute: number,
    private burstLimit = 10,
  ) {}

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old requests
    this.requests = this.requests.filter((time) => time > oneMinuteAgo);

    // Check if we can make a request
    if (this.requests.length >= this.requestsPerMinute) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = oldestRequest + 60000 - now;

      if (waitTime > 0) {
        logger.debug(`Rate limited, waiting ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return this.waitForSlot();
      }
    }

    // Check burst limit
    const recentRequests = this.requests.filter((time) => time > now - 1000);
    if (recentRequests.length >= this.burstLimit) {
      logger.debug('Burst limit reached, waiting 1 second');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return this.waitForSlot();
    }

    this.requests.push(now);
  }

  reset(): void {
    this.requests = [];
  }
}

/**
 * Abstract base scraper class
 */
export abstract class BaseScraper extends EventEmitter {
  protected rateLimiter: RateLimiter;
  protected startTime = 0;
  protected metrics = {
    requests: 0,
    errors: 0,
    retries: 0,
    itemsFound: 0,
    pagesParsed: 0,
  };

  constructor(
    protected siteConfig: SiteConfig,
    protected scraperConfig: ScraperConfig,
  ) {
    super();

    this.rateLimiter = new RateLimiter(
      siteConfig.scraping.rateLimit.requestsPerMinute,
      siteConfig.scraping.rateLimit.burstLimit,
    );

    // Emit metrics periodically
    setInterval(() => {
      this.emit('metrics', { ...this.metrics });
    }, 30000); // Every 30 seconds
  }

  /**
   * Main scraping method - to be implemented by subclasses
   */
  abstract scrape(searchParams: Record<string, string>): Promise<ScrapingResult>;

  /**
   * Parse a single page of job listings
   */
  protected abstract parsePage(content: string, url: string): JobListing[];

  /**
   * Fetch content from URL with retries and rate limiting
   */
  protected async fetchWithRetries(
    url: string,
    options: RequestInit = {},
  ): Promise<{ content: string; response: Response }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.siteConfig.scraping.retries; attempt++) {
      try {
        // Apply rate limiting
        await this.rateLimiter.waitForSlot();

        // Make request
        const response = await this.makeRequest(url, options);
        const content = await response.text();

        this.metrics.requests++;

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return { content, response };
      } catch (error) {
        lastError = error as Error;
        this.metrics.errors++;

        if (attempt < this.siteConfig.scraping.retries) {
          this.metrics.retries++;
          const delay = 2 ** attempt * 1000; // Exponential backoff

          logger.warn(`Request failed (attempt ${attempt + 1}), retrying in ${delay}ms`, {
            url,
            error: lastError.message,
          });

          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Make HTTP request - can be overridden by subclasses
   */
  protected async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const defaultOptions: RequestInit = {
      headers: {
        'User-Agent': this.scraperConfig.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.siteConfig.scraping.timeout),
    };

    return fetch(url, { ...defaultOptions, ...options });
  }

  /**
   * Extract and clean text content
   */
  protected cleanText(text?: string): string {
    if (!text) return '';

    return text.replace(/\\s+/g, ' ').replace(/\\n+/g, ' ').trim();
  }

  /**
   * Generate unique ID for job listing
   */
  protected generateJobId(title: string, company: string, url: string): string {
    const content = `${title}-${company}-${url}`;

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Parse salary information
   */
  protected parseSalary(salaryText?: string): string | undefined {
    if (!salaryText) return undefined;

    const regexes = this.siteConfig.processing.salaryRegex || [];

    for (const regex of regexes) {
      const match = salaryText.match(regex);
      if (match) {
        return match[0].trim();
      }
    }

    return salaryText.trim();
  }

  /**
   * Parse date information
   */
  protected parseDate(dateText?: string): string | undefined {
    if (!dateText) return undefined;

    const cleaned = dateText.trim().toLowerCase();

    // Handle relative dates
    if (cleaned.includes('today') || cleaned.includes('just posted')) {
      return new Date().toISOString().split('T')[0];
    }

    if (cleaned.includes('yesterday')) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    }

    // Extract number of days/weeks/months ago
    const relativeMatch = cleaned.match(/(\\d+)\\s*(day|week|month)s?\\s*ago/);
    if (relativeMatch) {
      const [, num, unit] = relativeMatch;
      const date = new Date();
      const amount = Number.parseInt(num || '0', 10);

      switch (unit) {
        case 'day':
          date.setDate(date.getDate() - amount);
          break;
        case 'week':
          date.setDate(date.getDate() - amount * 7);
          break;
        case 'month':
          date.setMonth(date.getMonth() - amount);
          break;
      }

      return date.toISOString().split('T')[0];
    }

    // Try to parse as regular date
    const parsedDate = new Date(dateText);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }

    return dateText;
  }

  /**
   * Validate job listing data
   */
  protected validateJob(job: Partial<JobListing>): job is JobListing {
    const required = ['title', 'company', 'url'] as const;

    for (const field of required) {
      if (!job[field] || typeof job[field] !== 'string' || job[field].length === 0) {
        logger.debug(`Job validation failed: missing or invalid ${field}`, { job });
        return false;
      }
    }

    return true;
  }

  /**
   * Start scraping process
   */
  protected startScraping(): void {
    this.startTime = Date.now();
    this.metrics = {
      requests: 0,
      errors: 0,
      retries: 0,
      itemsFound: 0,
      pagesParsed: 0,
    };

    logger.info(`Starting scraping for ${this.siteConfig.name}`, {
      site: this.siteConfig.id,
      rateLimits: this.siteConfig.scraping.rateLimit,
    });

    this.emit('start', { site: this.siteConfig.id });
  }

  /**
   * Finish scraping process
   */
  protected finishScraping(result: ScrapingResult): ScrapingResult {
    const duration = Date.now() - this.startTime;

    // Update result metadata
    result.metadata.duration = duration;
    result.metadata.itemsFound = this.metrics.itemsFound;
    result.metadata.pagesParsed = this.metrics.pagesParsed;
    result.metadata.retries = this.metrics.retries;

    logger.info(`Scraping completed for ${this.siteConfig.name}`, {
      site: this.siteConfig.id,
      success: result.success,
      itemsFound: result.metadata.itemsFound,
      duration,
      metrics: this.metrics,
    });

    this.emit('finish', {
      site: this.siteConfig.id,
      result,
      metrics: this.metrics,
    });

    return result;
  }

  /**
   * Handle scraping errors
   */
  protected handleError(error: Error, url: string): ScrapingResult {
    logger.error(`Scraping failed for ${this.siteConfig.name}`, {
      site: this.siteConfig.id,
      error: error.message,
      url,
      stack: error.stack,
    });

    this.emit('error', {
      site: this.siteConfig.id,
      error,
      url,
    });

    return {
      success: false,
      error: error.message,
      metadata: {
        url,
        timestamp: new Date(),
        duration: Date.now() - this.startTime,
        itemsFound: 0,
        pagesParsed: 0,
        retries: this.metrics.retries,
      },
    };
  }
}

/**
 * Scraper factory function
 */
export function createScraper(siteConfig: SiteConfig, _scraperConfig: ScraperConfig): BaseScraper {
  // This will be extended when we create specific scraper implementations
  throw new Error(`Scraper not implemented for site: ${siteConfig.id}`);
}
