import type { JobListing, ScrapeResult, ScraperConfig } from '@/types/index.js';
import { createTimer, logger } from '@/utils/logger.js';
import { type Browser, type BrowserContext, type Page, chromium } from 'playwright';
import { BaseScraper } from './base-scraper.js';

/**
 * Playwright-based scraper for dynamic content and JavaScript-heavy sites
 */
export class PlaywrightScraper extends BaseScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private pool: Page[] = [];
  private readonly maxPages: number;
  private readonly headless: boolean;

  constructor(config: ScraperConfig, options: { maxPages?: number; headless?: boolean } = {}) {
    super(config);
    this.maxPages = options.maxPages || 3;
    this.headless = options.headless !== false;
  }

  /**
   * Initialize browser and context
   */
  async initialize(): Promise<void> {
    if (this.browser) return;

    const timer = createTimer();

    try {
      this.browser = await chromium.launch({
        headless: this.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });

      this.context = await this.browser.newContext({
        userAgent: this.config.userAgent,
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      });

      // Create initial page pool
      for (let i = 0; i < this.maxPages; i++) {
        const page = await this.context.newPage();
        await this.configurePage(page);
        this.pool.push(page);
      }

      logger.info(
        {
          duration: timer.elapsed(),
          pages: this.maxPages,
          headless: this.headless,
        },
        'Playwright browser initialized',
      );
    } catch (error) {
      logger.error({ error, duration: timer.elapsed() }, 'Failed to initialize Playwright browser');
      throw error;
    }
  }

  /**
   * Configure page with common settings
   */
  private async configurePage(page: Page): Promise<void> {
    // Set timeout
    page.setDefaultTimeout(this.config.timeout);

    // Block unnecessary resources to speed up loading
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Handle console logs
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        logger.debug({ url: page.url(), message: msg.text() }, 'Page console error');
      }
    });

    // Handle page errors
    page.on('pageerror', (error) => {
      logger.debug({ url: page.url(), error: error.message }, 'Page error');
    });
  }

  /**
   * Get an available page from the pool
   */
  private async getPage(): Promise<Page> {
    if (this.pool.length === 0) {
      // Create new page if pool is empty
      if (!this.context) throw new Error('Browser context not initialized');
      const page = await this.context.newPage();
      await this.configurePage(page);
      return page;
    }

    const page = this.pool.pop();
    if (!page) {
      throw new Error('Failed to get page from pool');
    }
    return page;
  }

  /**
   * Return page to pool
   */
  private returnPage(page: Page): void {
    this.pool.push(page);
  }

  /**
   * Navigate to URL and wait for content
   */
  async navigateToPage(url: string, waitForSelector?: string): Promise<Page> {
    await this.rateLimiter.consume('request');

    const timer = createTimer();
    const page = await this.getPage();

    this.emit('request:start', url);

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout,
      });

      // Wait for specific selector if provided
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 5000 });
      }

      // Random delay to appear more human-like
      await page.waitForTimeout(Math.random() * 1000 + 500);

      this.emit('request:success', url, timer.elapsed());
      logger.debug({ url, duration: timer.elapsed() }, 'Page loaded successfully');

      return page;
    } catch (error) {
      this.emit('request:error', url, {
        type: 'network',
        message: error instanceof Error ? error.message : 'Unknown navigation error',
        url,
        timestamp: new Date(),
        retry: true,
      });

      this.returnPage(page);
      throw error;
    }
  }

  /**
   * Extract job listings from a page
   */
  async extractJobsFromPage(page: Page, selectors: JobSelectors): Promise<Partial<JobListing>[]> {
    const timer = createTimer();

    try {
      // Wait for job listings to load
      await page.waitForSelector(selectors.jobContainer, { timeout: 10000 });

      const jobs = await page.evaluate((sel) => {
        const containers = document.querySelectorAll(sel.jobContainer);
        const results: Array<{
          title: string;
          company: string;
          location: string;
          url: string;
          description: string;
          salaryText: string;
          postedDateText: string;
          rawHtml: string;
        }> = [];

        for (const container of containers) {
          try {
            const titleEl = container.querySelector(sel.title);
            const companyEl = container.querySelector(sel.company);
            const locationEl = container.querySelector(sel.location);
            const linkEl = container.querySelector(sel.link);
            const descriptionEl = container.querySelector(sel.description);
            const salaryEl = container.querySelector(sel.salary);
            const dateEl = container.querySelector(sel.postedDate);

            if (titleEl && companyEl) {
              results.push({
                title: titleEl.textContent?.trim() || '',
                company: companyEl.textContent?.trim() || '',
                location: locationEl?.textContent?.trim() || '',
                url: linkEl?.getAttribute('href') || '',
                description: descriptionEl?.textContent?.trim() || '',
                salaryText: salaryEl?.textContent?.trim() || '',
                postedDateText: dateEl?.textContent?.trim() || '',
                rawHtml: container.innerHTML,
              });
            }
          } catch (err) {
            console.warn('Error extracting job data:', err);
          }
        }

        return results;
      }, selectors);

      logger.debug(
        {
          url: page.url(),
          jobsFound: jobs.length,
          duration: timer.elapsed(),
        },
        'Jobs extracted from page',
      );

      return jobs.map((job) => ({
        ...job,
        source: {
          site: new URL(page.url()).hostname,
          originalUrl: page.url(),
          scrapedAt: new Date(),
        },
      }));
    } catch (error) {
      logger.error(
        {
          url: page.url(),
          error: error instanceof Error ? error.message : 'Unknown extraction error',
          duration: timer.elapsed(),
        },
        'Failed to extract jobs from page',
      );
      return [];
    }
  }

  /**
   * Scrape jobs using search terms
   */
  async scrape(_searchTerms: string[], _maxResults = 50): Promise<ScrapeResult> {
    await this.initialize();

    const timer = createTimer();
    this.emit('scraping:start');
    this.isRunning = true;

    try {
      const allJobs: JobListing[] = [];

      // This is a placeholder implementation
      // Each site-specific scraper will override this method

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
   * Take screenshot for debugging
   */
  async takeScreenshot(page: Page, filename?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = filename || `/tmp/screenshot-${timestamp}.png`;

    await page.screenshot({ path: screenshotPath, fullPage: true });
    logger.debug({ path: screenshotPath }, 'Screenshot saved');

    return screenshotPath;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    const timer = createTimer();

    try {
      // Close all pages
      for (const page of this.pool) {
        await page.close();
      }
      this.pool = [];

      // Close context and browser
      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      logger.info({ duration: timer.elapsed() }, 'Playwright browser cleaned up');
    } catch (error) {
      logger.error({ error, duration: timer.elapsed() }, 'Error during cleanup');
    }
  }

  /**
   * Handle process cleanup
   */
  onExit(): void {
    if (this.browser) {
      this.cleanup().catch((err) => logger.error({ error: err }, 'Error during exit cleanup'));
    }
  }
}

/**
 * CSS selectors for extracting job data
 */
export interface JobSelectors {
  jobContainer: string;
  title: string;
  company: string;
  location: string;
  link: string;
  description?: string;
  salary?: string;
  postedDate?: string;
  employmentType?: string;
}

// Graceful shutdown
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});
