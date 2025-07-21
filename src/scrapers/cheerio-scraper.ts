import type { JobListing, ScrapeResult, ScraperConfig } from '@/types/index.js';
import { createTimer, logger } from '@/utils/logger.js';
import { load } from 'cheerio';
import { BaseScraper } from './base-scraper.js';
import type { JobSelectors } from './playwright-scraper.js';

/**
 * Cheerio-based scraper for static HTML content
 * Faster and more lightweight than Playwright for simple HTML parsing
 */
export class CheerioScraper extends BaseScraper {
  private userAgents: string[];
  private currentUserAgentIndex = 0;

  constructor(config: ScraperConfig) {
    super(config);

    // Rotate user agents to avoid detection
    this.userAgents = [
      config.userAgent,
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    ];
  }

  /**
   * Get next user agent in rotation
   */
  private getNextUserAgent(): string {
    const userAgent = this.userAgents[this.currentUserAgentIndex];
    this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgents.length;
    return userAgent;
  }

  /**
   * Make HTTP request and return response
   */
  async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    await this.rateLimiter.consume('request');

    const timer = createTimer();
    this.emit('request:start', url);

    const requestOptions: RequestInit = {
      method: 'GET',
      headers: {
        'User-Agent': this.getNextUserAgent(),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.emit('request:success', url, timer.elapsed());
      return response;
    } catch (error) {
      const scrapingError = {
        type: 'network' as const,
        message: error instanceof Error ? error.message : 'Unknown network error',
        url,
        timestamp: new Date(),
        retry: true,
      };

      this.emit('request:error', url, scrapingError);
      throw error;
    }
  }

  /**
   * Make request with retry logic
   */
  async makeRequestWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        return await this.makeRequest(url, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry on permanent errors
        if (error instanceof Error && error.message.includes('40')) {
          const statusCode = error.message.match(/\d{3}/)?.[0];
          if (statusCode && ['400', '401', '403', '404', '410'].includes(statusCode)) {
            throw error;
          }
        }

        if (attempt < this.config.retries) {
          const delay = Math.min(1000 * 2 ** attempt, 10000);
          logger.debug({ url, attempt, delay, error: lastError.message }, 'Retrying request');
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Fetch and parse HTML content
   */
  async fetchAndParse(url: string): Promise<CheerioAPI> {
    const response = await this.makeRequestWithRetry(url);
    const html = await response.text();
    return load(html);
  }

  /**
   * Extract job listings from HTML using selectors
   */
  extractJobsFromHtml(
    $: CheerioAPI,
    selectors: JobSelectors,
    baseUrl: string,
  ): Partial<JobListing>[] {
    const jobs: Partial<JobListing>[] = [];

    try {
      $(selectors.jobContainer).each((_, element) => {
        try {
          const $element = $(element);

          const title = $element.find(selectors.title).text().trim();
          const company = $element.find(selectors.company).text().trim();
          const location = $element.find(selectors.location).text().trim();

          if (!title || !company) {
            return; // Skip if essential fields are missing
          }

          let url = '';
          const linkElement = $element.find(selectors.link);
          if (linkElement.length > 0) {
            const href = linkElement.attr('href') || '';
            url = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
          }

          const job: Partial<JobListing> = {
            title,
            company,
            location,
            url,
            description: selectors.description
              ? $element.find(selectors.description).text().trim()
              : '',
            source: {
              site: new URL(baseUrl).hostname,
              originalUrl: baseUrl,
              scrapedAt: new Date(),
            },
          };

          // Extract optional fields
          if (selectors.salary) {
            const salaryText = $element.find(selectors.salary).text().trim();
            if (salaryText) {
              job.metadata = {
                ...(job.metadata || {}),
                salaryText,
              };
            }
          }

          if (selectors.postedDate) {
            const dateText = $element.find(selectors.postedDate).text().trim();
            if (dateText) {
              job.metadata = {
                ...(job.metadata || {}),
                postedDateText: dateText,
              };
            }
          }

          if (selectors.employmentType) {
            const typeText = $element.find(selectors.employmentType).text().trim();
            if (typeText) {
              job.metadata = {
                ...(job.metadata || {}),
                employmentTypeText: typeText,
              };
            }
          }

          // Store raw HTML for debugging
          job.metadata = {
            confidence: title && company ? 0.8 : 0.5,
            ...(job.metadata || {}),
            rawData: { html: $element.html() || '' },
          };

          jobs.push(job);
        } catch (error) {
          logger.warn(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            'Error extracting job data',
          );
        }
      });
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Error parsing job container',
      );
    }

    return jobs;
  }

  /**
   * Search for jobs using search terms
   */
  async searchJobs(
    searchUrl: string,
    selectors: JobSelectors,
    maxResults = 50,
  ): Promise<Partial<JobListing>[]> {
    const timer = createTimer();
    const allJobs: Partial<JobListing>[] = [];

    try {
      logger.info({ url: searchUrl }, 'Starting job search');

      const $ = await this.fetchAndParse(searchUrl);
      const jobs = this.extractJobsFromHtml($, selectors, searchUrl);

      allJobs.push(...jobs.slice(0, maxResults));

      logger.info(
        {
          jobsFound: jobs.length,
          totalCollected: allJobs.length,
          duration: timer.elapsed(),
        },
        'Job search completed',
      );

      return allJobs;
    } catch (error) {
      logger.error(
        {
          url: searchUrl,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: timer.elapsed(),
        },
        'Job search failed',
      );
      throw error;
    }
  }

  /**
   * Scrape jobs using search terms (implementation required by base class)
   */
  async scrape(_searchTerms: string[], _maxResults = 50): Promise<ScrapeResult> {
    const timer = createTimer();
    this.emit('scraping:start');
    this.isRunning = true;

    try {
      // This is a base implementation
      // Site-specific scrapers should override this method
      const allJobs: JobListing[] = [];

      this.emit('scraping:complete', {
        jobsFound: allJobs.length,
        totalScraped: allJobs.length,
        successRate: this.getSuccessRate(),
        duration: timer.elapsed(),
        errors: this.errors.length,
      });

      return {
        jobs: allJobs,
        metadata: {
          totalFound: allJobs.length,
          totalScraped: allJobs.length,
          successRate: this.getSuccessRate(),
          duration: timer.elapsed(),
          errors: this.errors,
          sources: [...new Set(allJobs.map((job) => job.source.site))],
        },
      };
    } finally {
      this.isRunning = false;
      this.emit('scraping:stop');
    }
  }

  /**
   * Check if a URL contains job listings (heuristic)
   */
  isJobListingPage(url: string): boolean {
    const jobKeywords = [
      'job',
      'career',
      'position',
      'employment',
      'vacancy',
      'hiring',
      'recruit',
      'opportunity',
      'opening',
    ];

    const lowercaseUrl = url.toLowerCase();
    return jobKeywords.some((keyword) => lowercaseUrl.includes(keyword));
  }

  /**
   * Extract metadata from page
   */
  extractPageMetadata($: CheerioAPI): { title: string; description: string } {
    const title =
      $('title').text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text().trim() ||
      '';

    const description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '';

    return { title, description };
  }

  /**
   * Get pagination URLs if available
   */
  extractPaginationUrls($: CheerioAPI, baseUrl: string): string[] {
    const urls: string[] = [];

    // Common pagination selectors
    const paginationSelectors = [
      'a[aria-label*="next"]',
      'a[aria-label*="Next"]',
      '.pagination a',
      '.pager a',
      'a:contains("Next")',
      'a:contains(">")',
    ];

    for (const selector of paginationSelectors) {
      $(selector).each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
          urls.push(fullUrl);
        }
      });

      if (urls.length > 0) break; // Use first successful selector
    }

    return [...new Set(urls)]; // Remove duplicates
  }
}

export type CheerioAPI = ReturnType<typeof load>;
