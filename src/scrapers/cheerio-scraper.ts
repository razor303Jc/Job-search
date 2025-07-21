import { buildSearchUrl } from '@/config/sites.js';
import { logger } from '@/utils/logger.js';
import * as cheerio from 'cheerio';
import { BaseScraper, type JobListing, type ScrapingResult } from './base-scraper.js';

/**
 * Cheerio-based scraper for static HTML content
 */
export class CheerioScraper extends BaseScraper {
  /**
   * Main scraping method
   */
  async scrape(searchParams: Record<string, string>): Promise<ScrapingResult> {
    this.startScraping();

    try {
      const searchUrl = buildSearchUrl(this.siteConfig.id, searchParams);
      logger.info(`Starting scrape for ${this.siteConfig.name}`, { url: searchUrl });

      const jobs: JobListing[] = [];
      let currentPage = 1;
      let hasNextPage = true;
      const maxPages = 10; // Safety limit

      while (hasNextPage && currentPage <= maxPages) {
        try {
          const pageUrl = this.buildPageUrl(searchUrl, currentPage);
          logger.debug(`Scraping page ${currentPage}`, { url: pageUrl });

          const { content } = await this.fetchWithRetries(pageUrl);
          const pageJobs = this.parsePage(content, pageUrl);

          jobs.push(...pageJobs);
          this.metrics.itemsFound += pageJobs.length;
          this.metrics.pagesParsed++;

          this.emit('pageComplete', {
            page: currentPage,
            jobsFound: pageJobs.length,
            totalJobs: jobs.length,
          });

          // Check if there's a next page
          hasNextPage = this.hasNextPage(content);
          currentPage++;

          // Respect delay between pages
          if (hasNextPage && this.scraperConfig.delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.scraperConfig.delay));
          }
        } catch (error) {
          logger.warn(`Failed to scrape page ${currentPage}`, {
            error: (error as Error).message,
            page: currentPage,
          });

          // Continue to next page unless it's a critical error
          if (this.isCriticalError(error as Error)) {
            throw error;
          }

          currentPage++;
        }
      }

      const result: ScrapingResult = {
        success: true,
        data: jobs,
        metadata: {
          url: searchUrl,
          timestamp: new Date(),
          duration: 0, // Will be set in finishScraping
          itemsFound: jobs.length,
          pagesParsed: this.metrics.pagesParsed,
          retries: this.metrics.retries,
        },
      };

      return this.finishScraping(result);
    } catch (error) {
      return this.handleError(error as Error, searchParams.toString());
    }
  }

  /**
   * Parse a single page of job listings
   */
  protected parsePage(content: string, url: string): JobListing[] {
    const $ = cheerio.load(content);
    const jobs: JobListing[] = [];
    const selectors = this.siteConfig.selectors;

    logger.debug(`Parsing page with selector: ${selectors.jobCard}`);

    $(selectors.jobCard).each((index, element) => {
      try {
        const $job = $(element);

        // Extract basic job information
        const title = this.extractText($job, selectors.title);
        const company = this.extractText($job, selectors.company);
        const location = this.extractText($job, selectors.location);
        const jobUrl = this.extractUrl($job, selectors.jobLink, url);

        if (!title || !company || !jobUrl) {
          logger.debug('Skipping job with missing required fields', {
            title,
            company,
            jobUrl,
            index,
          });
          return;
        }

        // Extract optional fields
        const description = this.extractText($job, selectors.description);
        const salary = this.extractText($job, selectors.salary);
        const postedDate = this.extractText($job, selectors.postedDate);

        // Create job listing
        const job: Partial<JobListing> = {
          id: this.generateJobId(title, company, jobUrl),
          title: this.cleanText(title),
          company: this.cleanText(company),
          location: this.cleanText(location),
          url: jobUrl,
          source: this.siteConfig.id,
          raw: {
            html: $job.html(),
            text: $job.text(),
          },
          metadata: {
            scrapedAt: new Date(),
            confidence: this.calculateConfidence(title, company, description),
            hasDetails: Boolean(description && description.length > 50),
          },
        };

        // Add optional fields if they exist
        if (description) {
          job.description = this.cleanText(description);
        }
        if (salary) {
          const parsedSalary = this.parseSalary(salary);
          if (parsedSalary) {
            job.salary = parsedSalary;
          }
        }
        if (postedDate) {
          const parsedDate = this.parseDate(postedDate);
          if (parsedDate) {
            job.postedDate = parsedDate;
          }
        }

        if (this.validateJob(job)) {
          jobs.push(job as JobListing);
        }
      } catch (error) {
        logger.warn('Error parsing job element', {
          error: (error as Error).message,
          index,
          html: $(element).html()?.substring(0, 200),
        });
      }
    });

    logger.debug(`Parsed ${jobs.length} jobs from page`, { url });
    return jobs;
  }

  /**
   * Extract text content using selector
   */
  private extractText($context: cheerio.Cheerio<any>, selector?: string): string | undefined {
    if (!selector) return undefined;

    try {
      const element = $context.find(selector).first();
      if (element.length === 0) {
        // Try selector on context itself
        if ($context.is(selector)) {
          return $context.text().trim();
        }
        return undefined;
      }

      return element.text().trim();
    } catch (error) {
      logger.debug('Error extracting text', { selector, error: (error as Error).message });
      return undefined;
    }
  }

  /**
   * Extract URL using selector and resolve relative URLs
   */
  private extractUrl(
    $context: cheerio.Cheerio<any>,
    selector?: string,
    baseUrl?: string,
  ): string | undefined {
    if (!selector) return undefined;

    try {
      const element = $context.find(selector).first();
      if (element.length === 0) {
        return undefined;
      }

      let href = element.attr('href');
      if (!href) {
        // Try data attributes or other URL sources
        href = element.attr('data-href') || element.attr('data-url');
      }

      if (!href) return undefined;

      // Resolve relative URLs
      if (href.startsWith('/') && baseUrl) {
        const base = new URL(baseUrl);
        return `${base.protocol}//${base.host}${href}`;
      }

      // Ensure it's a valid URL
      if (href.startsWith('http')) {
        return href;
      }

      // Handle protocol-relative URLs
      if (href.startsWith('//') && baseUrl) {
        const base = new URL(baseUrl);
        return `${base.protocol}${href}`;
      }

      return href;
    } catch (error) {
      logger.debug('Error extracting URL', { selector, error: (error as Error).message });
      return undefined;
    }
  }

  /**
   * Build URL for specific page
   */
  private buildPageUrl(baseUrl: string, page: number): string {
    if (page === 1) return baseUrl;

    const url = new URL(baseUrl);
    const pageParam = this.siteConfig.search.queryParams.page;

    if (pageParam) {
      // Different sites use different pagination schemes
      if (this.siteConfig.id === 'indeed') {
        // Indeed uses start parameter (0, 10, 20, ...)
        url.searchParams.set(pageParam, ((page - 1) * 10).toString());
      } else if (this.siteConfig.id === 'linkedin') {
        // LinkedIn uses start parameter (0, 25, 50, ...)
        url.searchParams.set(pageParam, ((page - 1) * 25).toString());
      } else {
        // Default to page number
        url.searchParams.set(pageParam, page.toString());
      }
    }

    return url.toString();
  }

  /**
   * Check if there's a next page
   */
  private hasNextPage(content: string): boolean {
    const $ = cheerio.load(content);
    const nextButton = this.siteConfig.selectors.nextButton;

    if (!nextButton) return false;

    const $nextButton = $(nextButton);

    // Check if next button exists and is not disabled
    if ($nextButton.length === 0) return false;

    // Check for disabled state (common patterns)
    if (
      $nextButton.hasClass('disabled') ||
      $nextButton.attr('disabled') ||
      $nextButton.attr('aria-disabled') === 'true'
    ) {
      return false;
    }

    // Check if href is present for links
    if ($nextButton.is('a') && !$nextButton.attr('href')) {
      return false;
    }

    return true;
  }

  /**
   * Calculate confidence score for job listing
   */
  private calculateConfidence(title?: string, company?: string, description?: string): number {
    let confidence = 0.5; // Base confidence

    // Title quality
    if (title) {
      if (title.length > 10 && title.length < 100) confidence += 0.2;
      if (/\b(engineer|developer|analyst|manager|specialist)\b/i.test(title)) confidence += 0.1;
    }

    // Company quality
    if (company) {
      if (company.length > 2 && company.length < 50) confidence += 0.1;
      if (!/\b(unknown|n\/a|null)\b/i.test(company)) confidence += 0.1;
    }

    // Description quality
    if (description) {
      if (description.length > 100) confidence += 0.1;
      if (description.length > 500) confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Determine if error is critical (should stop scraping)
   */
  private isCriticalError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Network errors that might be temporary
    if (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('network')
    ) {
      return false;
    }

    // HTTP errors
    if (message.includes('http 403') || message.includes('http 429')) {
      return true; // Rate limited or blocked
    }

    if (message.includes('http 404')) {
      return false; // Page not found, try next page
    }

    // Parsing errors are usually not critical
    if (message.includes('parse') || message.includes('selector')) {
      return false;
    }

    return true; // Unknown errors are considered critical
  }
}
