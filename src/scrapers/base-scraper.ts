import { EventEmitter } from 'node:events';
import type { JobListing, ScraperConfig, ScrapingError, ScrapeResult } from '@/types/index.js';
import { logger, createTimer } from '@/utils/logger.js';
import { RateLimiterMemory } from 'rate-limiter-flexible';

/**
 * Base abstract class for all scrapers
 * Provides common functionality like rate limiting, error handling, and metrics
 */
export abstract class BaseScraper extends EventEmitter {
  protected config: ScraperConfig;
  protected rateLimiter: RateLimiterMemory;
  protected isRunning = false;
  protected totalRequests = 0;
  protected successfulRequests = 0;
  protected errors: ScrapingError[] = [];

  constructor(config: ScraperConfig) {
    super();
    this.config = config;
    
    // Initialize rate limiter
    this.rateLimiter = new RateLimiterMemory({
      points: this.config.rateLimit.burst,
      duration: 1, // per second
      blockDuration: 1, // block for 1 second if exceeded
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('request:start', (url: string) => {
      this.totalRequests++;
      logger.debug({ url, totalRequests: this.totalRequests }, 'Starting request');
    });

    this.on('request:success', (url: string, responseTime: number) => {
      this.successfulRequests++;
      logger.debug({ 
        url, 
        responseTime, 
        successRate: this.getSuccessRate() 
      }, 'Request successful');
    });

    this.on('request:error', (url: string, error: ScrapingError) => {
      this.errors.push(error);
      logger.warn({ 
        url, 
        error: error.message, 
        errorType: error.type,
        totalErrors: this.errors.length 
      }, 'Request failed');
    });

    this.on('scraping:start', () => {
      this.isRunning = true;
      logger.info('Scraping session started');
    });

    this.on('scraping:complete', (result: ScrapeResult) => {
      this.isRunning = false;
      logger.info({
        jobsFound: result.jobs.length,
        totalScraped: result.metadata.totalScraped,
        successRate: result.metadata.successRate,
        duration: result.metadata.duration,
        errors: result.metadata.errors.length,
      }, 'Scraping session completed');
    });
  }

  /**
   * Abstract method that must be implemented by concrete scrapers
   */
  abstract scrape(searchTerms: string[], maxResults?: number): Promise<ScrapeResult>;

  /**
   * Make an HTTP request with rate limiting and error handling
   */
  protected async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const timer = createTimer('http_request');

    try {
      // Rate limiting
      await this.rateLimiter.consume(1);
      
      // Add delay between requests
      if (this.totalRequests > 0) {
        await this.delay(this.config.delay);
      }

      this.emit('request:start', url);

      // Set up request options with defaults
      const requestOptions: RequestInit = {
        method: 'GET',
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          ...options.headers,
        },
        ...options,
      };

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseTime = timer.end(true);
        this.emit('request:success', url, responseTime);

        return response;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      const scrapingError: ScrapingError = {
        type: this.categorizeError(error),
        message: error instanceof Error ? error.message : 'Unknown error',
        url,
        timestamp: new Date(),
        retry: this.shouldRetry(error),
      };

      timer.end(false, undefined, error instanceof Error ? error : new Error(String(error)));
      this.emit('request:error', url, scrapingError);

      throw scrapingError;
    }
  }

  /**
   * Make request with automatic retries
   */
  protected async makeRequestWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
    let lastError: ScrapingError | null = null;

    for (let attempt = 1; attempt <= this.config.retries + 1; attempt++) {
      try {
        return await this.makeRequest(url, options);
      } catch (error) {
        lastError = error as ScrapingError;

        if (attempt <= this.config.retries && lastError.retry) {
          const backoffDelay = this.calculateBackoffDelay(attempt);
          logger.debug({ 
            url, 
            attempt, 
            maxAttempts: this.config.retries + 1, 
            backoffDelay,
            error: lastError.message 
          }, 'Request failed, retrying...');
          
          await this.delay(backoffDelay);
          continue;
        }

        break;
      }
    }

    throw lastError;
  }

  /**
   * Extract text content safely from HTML elements
   */
  protected extractText(element: any, selector?: string): string {
    try {
      const target = selector ? element.querySelector(selector) : element;
      return target?.textContent?.trim() || '';
    } catch (error) {
      logger.debug({ selector, error }, 'Failed to extract text');
      return '';
    }
  }

  /**
   * Extract attribute value safely from HTML elements
   */
  protected extractAttribute(element: any, attribute: string, selector?: string): string {
    try {
      const target = selector ? element.querySelector(selector) : element;
      return target?.getAttribute?.(attribute)?.trim() || '';
    } catch (error) {
      logger.debug({ selector, attribute, error }, 'Failed to extract attribute');
      return '';
    }
  }

  /**
   * Parse salary information from text
   */
  protected parseSalary(text: string): JobListing['salary'] | undefined {
    if (!text) return undefined;

    // Keep original text for currency/period detection, create clean version for matching
    const cleanText = text.toLowerCase().replace(/[,\s]/g, '');
    
    // Common salary patterns
    const patterns = [
      // $50,000 - $80,000 per year (with commas)
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
      if (match && match[1] && match[2]) {
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
        let period: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' = 'yearly';
        if (text.toLowerCase().includes('hour')) period = 'hourly';
        else if (text.toLowerCase().includes('month')) period = 'monthly';

        return { min, max, currency, period };
      }
    }

    return undefined;
  }

  /**
   * Normalize employment type from various text formats
   */
  protected parseEmploymentType(text: string): JobListing['employmentType'] {
    const normalized = text.toLowerCase().trim();
    
    if (normalized.includes('full') && normalized.includes('time')) return 'full-time';
    if (normalized.includes('part') && normalized.includes('time')) return 'part-time';
    if (normalized.includes('contract')) return 'contract';
    if (normalized.includes('temporary') || normalized.includes('temp')) return 'temporary';
    if (normalized.includes('intern')) return 'internship';
    if (normalized.includes('freelance') || normalized.includes('consultant')) return 'freelance';
    
    return 'full-time'; // Default
  }

  /**
   * Check if job is remote based on text content
   */
  protected isRemoteJob(locationText: string, descriptionText: string = ''): boolean {
    const text = `${locationText} ${descriptionText}`.toLowerCase();
    const remoteKeywords = ['remote', 'work from home', 'wfh', 'distributed', 'anywhere'];
    
    return remoteKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Generate unique job ID from job data
   */
  protected generateJobId(title: string, company: string, url: string): string {
    const baseString = `${title}-${company}-${url}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Simple hash function for generating consistent IDs
    let hash = 0;
    for (let i = 0; i < baseString.length; i++) {
      const char = baseString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Get current scraping statistics
   */
  public getStats() {
    return {
      isRunning: this.isRunning,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      successRate: this.getSuccessRate(),
      errors: this.errors.length,
      recentErrors: this.errors.slice(-5),
    };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.errors = [];
  }

  /**
   * Stop the scraper
   */
  public stop(): void {
    this.isRunning = false;
    this.emit('scraping:stopped');
    logger.info('Scraping stopped');
  }

  // Private helper methods

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getSuccessRate(): number {
    return this.totalRequests === 0 ? 0 : (this.successfulRequests / this.totalRequests) * 100;
  }

  private categorizeError(error: unknown): ScrapingError['type'] {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('timeout') || message.includes('aborted')) return 'network';
      if (message.includes('rate') || message.includes('limit')) return 'rate-limit';
      if (message.includes('403') || message.includes('blocked') || message.includes('captcha')) return 'blocked';
      if (message.includes('parse') || message.includes('selector')) return 'parsing';
    }
    
    return 'unknown';
  }

  private shouldRetry(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Don't retry on permanent errors
      if (message.includes('404') || message.includes('403')) return false;
      if (message.includes('captcha') || message.includes('blocked')) return false;
      
      // Retry on temporary errors
      if (message.includes('timeout') || message.includes('network')) return true;
      if (message.includes('500') || message.includes('502') || message.includes('503')) return true;
    }
    
    return true;
  }

  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
    const jitter = Math.random() * 0.1 * baseDelay;
    return baseDelay + jitter;
  }
}