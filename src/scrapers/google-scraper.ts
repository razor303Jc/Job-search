import { buildDorkQuery, getRecommendedDorks } from '@/config/dorks.js';
import type { JobSearchCriteria, ScraperConfig } from '@/config/schemas.js';
import { logger } from '@/utils/logger.js';
import { BaseScraper, type JobListing, type ScrapingResult } from './base-scraper.js';

/**
 * Google search scraper for Google Dorks job searching
 */
export class GoogleScraper extends BaseScraper {
  private static readonly GOOGLE_BASE_URL = 'https://www.google.com/search';
  private static readonly RESULTS_PER_PAGE = 10;

  constructor(scraperConfig: ScraperConfig) {
    // Create a basic site config for Google
    const googleSiteConfig = {
      id: 'google',
      name: 'Google Search',
      baseUrl: GoogleScraper.GOOGLE_BASE_URL,
      enabled: true,
      scraping: {
        type: 'static' as const,
        respectRobotsTxt: true,
        rateLimit: {
          requestsPerMinute: 20, // Be very respectful to Google
          burstLimit: 3,
        },
        retries: 2,
        timeout: 30000,
      },
      selectors: {
        // Google search result selectors
        jobCard: '.g',
        jobLink: 'h3 a',
        title: 'h3',
        company: '.VwiC3b', // Description can contain company info
        location: '.VwiC3b', // Description can contain location info
        description: '.VwiC3b',
        // Google-specific selectors
        nextButton: '#pnnext',
        totalResults: '#result-stats',
      },
      search: {
        searchUrl: GoogleScraper.GOOGLE_BASE_URL,
        queryParams: {
          keywords: 'q',
          page: 'start',
        },
      },
      processing: {
        dateFormats: ['relative'],
      },
      features: {
        hasJobAlerts: false,
        hasSalaryData: false,
        hasCompanyReviews: false,
        requiresLogin: false,
        hasApplyButton: false,
        supportsBulkExport: false,
      },
    };

    super(googleSiteConfig, scraperConfig);
  }

  /**
   * Search for jobs using Google Dorks
   */
  async searchWithDorks(criteria: JobSearchCriteria): Promise<ScrapingResult> {
    this.startScraping();

    try {
      logger.info('Starting Google Dorks job search', { criteria });

      // Get recommended dorks for the criteria
      const dorksCriteria: {
        keywords: string[];
        location?: string;
        remote?: boolean;
        company?: string;
      } = {
        keywords: criteria.keywords,
      };

      if (criteria.location) {
        dorksCriteria.location = criteria.location;
      }
      if (criteria.remote !== undefined) {
        dorksCriteria.remote = criteria.remote;
      }

      const dorks = getRecommendedDorks(dorksCriteria);

      logger.info(`Using ${dorks.length} Google Dorks`, {
        dorks: dorks.map((d) => d.name),
      });

      const allJobs: JobListing[] = [];
      const maxJobsPerDork = Math.ceil(criteria.maxResults / dorks.length);

      // Execute each dork
      for (const dork of dorks) {
        try {
          logger.debug(`Executing dork: ${dork.name}`, { pattern: dork.pattern });

          const dorkQuery = buildDorkQuery(dork, criteria.keywords, criteria.location);
          const dorkJobs = await this.executeGoogleDork(dorkQuery, maxJobsPerDork);

          allJobs.push(...dorkJobs);

          this.emit('dorkComplete', {
            dork: dork.name,
            query: dorkQuery,
            jobsFound: dorkJobs.length,
            totalJobs: allJobs.length,
          });

          // Respectful delay between dorks
          await new Promise((resolve) => setTimeout(resolve, this.scraperConfig.delay * 2));
        } catch (error) {
          logger.warn(`Failed to execute dork: ${dork.name}`, {
            error: (error as Error).message,
            dork: dork.pattern,
          });
        }

        // Stop if we have enough results
        if (allJobs.length >= criteria.maxResults) {
          break;
        }
      }

      // Remove duplicates and limit results
      const uniqueJobs = this.deduplicateJobs(allJobs);
      const limitedJobs = uniqueJobs.slice(0, criteria.maxResults);

      const result: ScrapingResult = {
        success: true,
        data: limitedJobs,
        metadata: {
          url: GoogleScraper.GOOGLE_BASE_URL,
          timestamp: new Date(),
          duration: 0, // Will be set in finishScraping
          itemsFound: limitedJobs.length,
          pagesParsed: this.metrics.pagesParsed,
          retries: this.metrics.retries,
        },
      };

      return this.finishScraping(result);
    } catch (error) {
      return this.handleError(error as Error, criteria.keywords.join(', '));
    }
  }

  /**
   * Main scraping method (delegates to searchWithDorks)
   */
  async scrape(searchParams: Record<string, string>): Promise<ScrapingResult> {
    const criteria: JobSearchCriteria = {
      keywords: searchParams.keywords?.split(',') || ['software engineer'],
      location: searchParams.location,
      remote: searchParams.remote === 'true',
      maxResults: Number.parseInt(searchParams.maxResults || '100', 10),
    };

    return this.searchWithDorks(criteria);
  }

  /**
   * Execute a single Google Dork query
   */
  private async executeGoogleDork(query: string, maxResults: number): Promise<JobListing[]> {
    logger.debug('Executing Google Dork', { query, maxResults });

    const jobs: JobListing[] = [];
    let currentPage = 0;
    const maxPages = Math.ceil(maxResults / GoogleScraper.RESULTS_PER_PAGE);

    for (let page = 0; page < maxPages; page++) {
      try {
        const searchUrl = this.buildGoogleSearchUrl(query, currentPage);
        logger.debug(`Scraping Google page ${page + 1}`, { url: searchUrl });

        const { content } = await this.fetchWithRetries(searchUrl);
        const pageJobs = this.parseGoogleResults(content, query);

        if (pageJobs.length === 0) {
          logger.debug('No more results found, stopping pagination');
          break;
        }

        jobs.push(...pageJobs);
        this.metrics.itemsFound += pageJobs.length;
        this.metrics.pagesParsed++;

        currentPage += GoogleScraper.RESULTS_PER_PAGE;

        // Stop if we have enough results
        if (jobs.length >= maxResults) {
          break;
        }

        // Respectful delay between Google pages
        await new Promise((resolve) => setTimeout(resolve, this.scraperConfig.delay));
      } catch (error) {
        logger.warn(`Failed to scrape Google page ${page + 1}`, {
          error: (error as Error).message,
          query,
        });

        // Be more conservative with Google errors
        if (this.isGoogleBlocked(error as Error)) {
          logger.error('Google has blocked our requests, stopping');
          break;
        }
      }
    }

    return jobs;
  }

  /**
   * Parse Google search results page
   */
  protected parsePage(content: string, url: string): JobListing[] {
    return this.parseGoogleResults(content, url);
  }

  /**
   * Parse Google search results
   */
  private parseGoogleResults(content: string, query: string): JobListing[] {
    const cheerio = require('cheerio');
    const $ = cheerio.load(content);
    const jobs: JobListing[] = [];

    // Google search result selector
    $('.g').each((index: number, element: any) => {
      try {
        const $result = $(element);

        // Extract title and URL
        const $titleLink = $result.find('h3').first().parent('a');
        const title = $titleLink.find('h3').text().trim();
        const url = $titleLink.attr('href');

        if (!title || !url) {
          return; // Skip invalid results
        }

        // Extract description/snippet
        const description = $result.find('.VwiC3b, .s').first().text().trim();

        // Try to extract company and location from URL and description
        const { company, location } = this.extractCompanyAndLocation(url, description, title);

        if (!company) {
          return; // Skip if we can't determine company
        }

        // Create job listing
        const job: Partial<JobListing> = {
          id: this.generateJobId(title, company, url),
          title: this.cleanText(title),
          company: this.cleanText(company),
          location: location ? this.cleanText(location) : 'Remote/Various',
          url,
          source: 'google-dork',
          raw: {
            html: $result.html(),
            text: $result.text(),
            query,
          },
          metadata: {
            scrapedAt: new Date(),
            confidence: this.calculateGoogleConfidence(title, company, description, url),
            hasDetails: Boolean(description && description.length > 100),
          },
        };

        if (description) {
          job.description = this.cleanText(description);
        }

        if (this.validateJob(job)) {
          jobs.push(job as JobListing);
        }
      } catch (error) {
        logger.debug('Error parsing Google result', {
          error: (error as Error).message,
          index,
        });
      }
    });

    logger.debug(`Parsed ${jobs.length} jobs from Google results`);
    return jobs;
  }

  /**
   * Build Google search URL
   */
  private buildGoogleSearchUrl(query: string, start = 0): string {
    const url = new URL(GoogleScraper.GOOGLE_BASE_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('hl', 'en'); // English results
    url.searchParams.set('gl', 'us'); // US region
    url.searchParams.set('num', GoogleScraper.RESULTS_PER_PAGE.toString());

    if (start > 0) {
      url.searchParams.set('start', start.toString());
    }

    return url.toString();
  }

  /**
   * Extract company and location from URL and description
   */
  private extractCompanyAndLocation(
    url: string,
    description: string,
    title: string,
  ): {
    company: string | null;
    location: string | null;
  } {
    let company: string | null = null;
    let location: string | null = null;

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      // Extract company from domain
      if (domain.includes('linkedin.com')) {
        company = 'LinkedIn';
      } else if (domain.includes('indeed.com')) {
        company = 'Indeed';
      } else if (domain.includes('glassdoor.com')) {
        company = 'Glassdoor';
      } else {
        // Try to extract company from domain
        const domainParts = domain.split('.');
        if (domainParts.length >= 2) {
          const domainPart = domainParts[domainParts.length - 2];
          if (domainPart) {
            company = domainPart.charAt(0).toUpperCase() + domainPart.slice(1);
          }
        }
      }

      // Try to extract company from title or description
      const companyMatches = [
        title.match(/at\s+([^-•|]+)/i),
        description.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+is\s+hiring/i),
        description.match(/Join\s+([^.!]+)/i),
      ];

      for (const match of companyMatches) {
        if (match?.[1]) {
          const extractedCompany = match[1].trim();
          if (extractedCompany.length > 2 && extractedCompany.length < 50) {
            company = extractedCompany;
            break;
          }
        }
      }

      // Try to extract location
      const locationMatches = [
        description.match(
          /\b(Remote|San Francisco|New York|Seattle|Austin|Boston|Los Angeles|Chicago|Denver|Portland|Atlanta|Washington|Miami|Dallas|Phoenix|Philadelphia|San Diego|Tampa|Orlando|Nashville|Charlotte|Pittsburgh|Minneapolis|Detroit|St\. Louis|Baltimore|Sacramento|Cincinnati|Cleveland|Columbus|Indianapolis|Kansas City|Louisville|Memphis|Milwaukee|New Orleans|Oklahoma City|Richmond|Salt Lake City|Tulsa|Virginia Beach),?\s*([A-Z]{2})?\b/i,
        ),
        title.match(/\|\s*([^|]+)$/),
      ];

      for (const match of locationMatches) {
        if (match?.[1]) {
          location = match[1].trim();
          break;
        }
      }
    } catch (error) {
      logger.debug('Error extracting company/location', { error: (error as Error).message });
    }

    return { company, location };
  }

  /**
   * Calculate confidence score for Google results
   */
  private calculateGoogleConfidence(
    title: string,
    _company: string,
    description?: string,
    url?: string,
  ): number {
    let confidence = 0.3; // Lower base confidence for Google results

    // Title quality
    if (title.includes('job') || title.includes('career') || title.includes('position')) {
      confidence += 0.2;
    }

    // URL quality (job sites are more reliable)
    if (url) {
      if (
        url.includes('linkedin.com') ||
        url.includes('indeed.com') ||
        url.includes('glassdoor.com')
      ) {
        confidence += 0.3;
      } else if (url.includes('jobs') || url.includes('career')) {
        confidence += 0.2;
      }
    }

    // Description quality
    if (description) {
      if (
        description.includes('apply') ||
        description.includes('hire') ||
        description.includes('position')
      ) {
        confidence += 0.1;
      }
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Remove duplicate jobs based on title and company
   */
  private deduplicateJobs(jobs: JobListing[]): JobListing[] {
    const seen = new Set<string>();
    const unique: JobListing[] = [];

    for (const job of jobs) {
      const key = `${job.title.toLowerCase()}-${job.company.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(job);
      }
    }

    logger.debug(`Deduplicated ${jobs.length} jobs to ${unique.length} unique jobs`);
    return unique;
  }

  /**
   * Check if Google has blocked our requests
   */
  private isGoogleBlocked(error: Error): boolean {
    const message = error.message.toLowerCase();

    return (
      message.includes('429') || // Too Many Requests
      message.includes('captcha') ||
      message.includes('unusual traffic') ||
      message.includes('blocked')
    );
  }

  /**
   * Override makeRequest to add Google-specific headers
   */
  protected override async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const googleOptions: RequestInit = {
      ...options,
      headers: {
        'User-Agent': this.scraperConfig.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
        ...options.headers,
      },
    };

    return super.makeRequest(url, googleOptions);
  }
}
