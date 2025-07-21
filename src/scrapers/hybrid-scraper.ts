import type { JobListing, ScrapeResult, ScraperConfig } from '@/types/index.js';
import { createTimer, logger } from '@/utils/logger.js';
import { CheerioScraper } from './cheerio-scraper.js';
import { PlaywrightScraper } from './playwright-scraper.js';
import type { JobSelectors } from './playwright-scraper.js';

/**
 * Configuration for hybrid scraping strategy
 */
export interface HybridScraperConfig extends ScraperConfig {
  preferStatic?: boolean;
  jsDetectionTimeout?: number;
  fallbackToDynamic?: boolean;
}

/**
 * Intelligent scraper that chooses between static (Cheerio) and dynamic (Playwright) scraping
 * based on the content type and site characteristics
 */
export class HybridScraper {
  private cheerioScraper: CheerioScraper;
  private playwrightScraper: PlaywrightScraper;
  private config: HybridScraperConfig;
  private siteStrategies: Map<string, 'static' | 'dynamic'> = new Map();

  constructor(config: HybridScraperConfig) {
    this.config = {
      jsDetectionTimeout: 3000,
      fallbackToDynamic: true,
      ...config,
    };

    this.cheerioScraper = new CheerioScraper(config);
    this.playwrightScraper = new PlaywrightScraper(config, {
      headless: true,
      maxPages: 2,
    });

    // Pre-configure known site strategies
    this.initializeSiteStrategies();
  }

  /**
   * Initialize known strategies for popular job sites
   */
  private initializeSiteStrategies(): void {
    // Sites that work well with static scraping
    const staticSites = [
      'stackoverflow.com',
      'indeed.com',
      'dice.com',
      'monster.com',
      'careerbuilder.com',
      'craigslist.org',
    ];

    // Sites that require dynamic scraping
    const dynamicSites = [
      'linkedin.com',
      'glassdoor.com',
      'angel.co',
      'wellfound.com',
      'lever.co',
      'greenhouse.io',
      'workday.com',
    ];

    for (const site of staticSites) {
      this.siteStrategies.set(site, 'static');
    }
    for (const site of dynamicSites) {
      this.siteStrategies.set(site, 'dynamic');
    }
  }

  /**
   * Determine the best scraping strategy for a URL
   */
  async determineStrategy(url: string): Promise<'static' | 'dynamic'> {
    const hostname = new URL(url).hostname.replace('www.', '');

    // Check if we have a known strategy for this site
    if (this.siteStrategies.has(hostname)) {
      const strategy = this.siteStrategies.get(hostname);
      if (strategy) {
        logger.debug({ url, strategy, source: 'known-site' }, 'Using known scraping strategy');
        return strategy;
      }
    }

    // If configured to prefer static, try static first
    if (this.config.preferStatic) {
      logger.debug(
        { url, strategy: 'static', source: 'preference' },
        'Using preferred static strategy',
      );
      return 'static';
    }

    // Analyze the page to determine if it needs JavaScript
    try {
      const needsJs = await this.detectJavaScriptRequirement(url);
      const strategy = needsJs ? 'dynamic' : 'static';

      // Cache the strategy for future use
      this.siteStrategies.set(hostname, strategy);

      logger.debug({ url, strategy, needsJs, source: 'detection' }, 'Detected scraping strategy');
      return strategy;
    } catch (error) {
      logger.warn(
        { url, error: error instanceof Error ? error.message : 'Unknown error' },
        'Strategy detection failed, using static',
      );
      return 'static';
    }
  }

  /**
   * Detect if a page requires JavaScript for content loading
   */
  private async detectJavaScriptRequirement(url: string): Promise<boolean> {
    const timer = createTimer();

    try {
      // First, try to fetch with static scraping
      const response = await this.cheerioScraper.makeRequest(url);
      const html = await response.text();

      // Heuristics to detect if JavaScript is required
      const indicators = [
        // Common JS frameworks and libraries
        /<script[^>]*(?:react|angular|vue|ember|backbone)/i,
        /<script[^>]*(?:requirejs|webpack|browserify)/i,

        // Single Page Application indicators
        /<div[^>]*id=["\'](?:app|root|main)["\'][^>]*><\/div>/i,
        /<div[^>]*class=["\'][^"\']*(?:app|spa|single-page)[^"\']*["\'][^>]*><\/div>/i,

        // Loading indicators
        /(?:loading|spinner|skeleton|placeholder)/i.test(html),

        // Minimal content with lots of scripts
        (html.match(/<script/gi) || []).length > 5 && html.length < 50000,

        // Common job site dynamic indicators
        /data-react|data-vue|ng-app|v-app/i.test(html),

        // AJAX/API loading patterns
        /fetch\(|XMLHttpRequest|axios\.get|\.ajax\(/i.test(html),

        // Placeholder content
        /<div[^>]*class=["\'][^"\']*(?:placeholder|loading)[^"\']*["\']/.test(html),
      ];

      const jsRequired = indicators.some((indicator) =>
        typeof indicator === 'boolean' ? indicator : indicator.test(html),
      );

      logger.debug(
        {
          url,
          jsRequired,
          htmlLength: html.length,
          scriptTags: (html.match(/<script/gi) || []).length,
          duration: timer.elapsed(),
        },
        'JavaScript requirement analysis',
      );

      return jsRequired;
    } catch (error) {
      logger.warn(
        { url, error: error instanceof Error ? error.message : 'Unknown error' },
        'JS detection failed',
      );
      return true; // Default to dynamic scraping if detection fails
    }
  }

  /**
   * Scrape jobs with automatic strategy selection
   */
  async scrapeJobs(
    url: string,
    selectors: JobSelectors,
    maxResults = 50,
  ): Promise<Partial<JobListing>[]> {
    const timer = createTimer();
    let strategy = await this.determineStrategy(url);

    try {
      let jobs: Partial<JobListing>[] = [];

      if (strategy === 'static') {
        logger.info({ url, strategy }, 'Using static scraping');
        jobs = await this.cheerioScraper.searchJobs(url, selectors, maxResults);

        // If static scraping yields poor results and fallback is enabled, try dynamic
        if (jobs.length === 0 && this.config.fallbackToDynamic) {
          logger.info({ url }, 'Static scraping yielded no results, falling back to dynamic');
          strategy = 'dynamic';
        }
      }

      if (strategy === 'dynamic' || jobs.length === 0) {
        logger.info({ url, strategy }, 'Using dynamic scraping');

        await this.playwrightScraper.initialize();
        const page = await this.playwrightScraper.navigateToPage(url);

        try {
          jobs = await this.playwrightScraper.extractJobsFromPage(page, selectors);
          this.playwrightScraper.returnPage(page);
        } catch (error) {
          this.playwrightScraper.returnPage(page);
          throw error;
        }
      }

      logger.info(
        {
          url,
          strategy,
          jobsFound: jobs.length,
          duration: timer.elapsed(),
        },
        'Hybrid scraping completed',
      );

      return jobs;
    } catch (error) {
      logger.error(
        {
          url,
          strategy,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: timer.elapsed(),
        },
        'Hybrid scraping failed',
      );
      throw error;
    }
  }

  /**
   * Test both strategies and compare results (for optimization)
   */
  async testStrategies(
    url: string,
    selectors: JobSelectors,
  ): Promise<{
    static: { jobs: Partial<JobListing>[]; duration: number; error?: string };
    dynamic: { jobs: Partial<JobListing>[]; duration: number; error?: string };
    recommendation: 'static' | 'dynamic';
  }> {
    const results = {
      static: { jobs: [] as Partial<JobListing>[], duration: 0 },
      dynamic: { jobs: [] as Partial<JobListing>[], duration: 0 },
      recommendation: 'static' as 'static' | 'dynamic',
    };

    // Test static scraping
    try {
      const staticTimer = createTimer();
      results.static.jobs = await this.cheerioScraper.searchJobs(url, selectors, 10);
      results.static.duration = staticTimer.elapsed();
    } catch (error) {
      results.static.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Test dynamic scraping
    try {
      const dynamicTimer = createTimer();
      await this.playwrightScraper.initialize();
      const page = await this.playwrightScraper.navigateToPage(url);

      try {
        results.dynamic.jobs = await this.playwrightScraper.extractJobsFromPage(page, selectors);
        results.dynamic.duration = dynamicTimer.elapsed();
        this.playwrightScraper.returnPage(page);
      } catch (error) {
        this.playwrightScraper.returnPage(page);
        throw error;
      }
    } catch (error) {
      results.dynamic.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Determine recommendation based on results
    const staticScore =
      results.static.jobs.length > 0
        ? results.static.jobs.length / Math.max(results.static.duration, 1)
        : 0;
    const dynamicScore =
      results.dynamic.jobs.length > 0
        ? results.dynamic.jobs.length / Math.max(results.dynamic.duration, 1)
        : 0;

    results.recommendation = staticScore >= dynamicScore ? 'static' : 'dynamic';

    logger.info(
      {
        url,
        staticJobs: results.static.jobs.length,
        dynamicJobs: results.dynamic.jobs.length,
        staticDuration: results.static.duration,
        dynamicDuration: results.dynamic.duration,
        recommendation: results.recommendation,
      },
      'Strategy comparison completed',
    );

    return results;
  }

  /**
   * Get performance metrics for both scrapers
   */
  getMetrics() {
    return {
      cheerio: {
        successRate: this.cheerioScraper.getSuccessRate(),
        totalRequests: this.cheerioScraper.getTotalRequests(),
        errors: this.cheerioScraper.getErrors(),
      },
      playwright: {
        successRate: this.playwrightScraper.getSuccessRate(),
        totalRequests: this.playwrightScraper.getTotalRequests(),
        errors: this.playwrightScraper.getErrors(),
      },
      siteStrategies: Object.fromEntries(this.siteStrategies),
    };
  }

  /**
   * Update site strategy based on performance
   */
  updateSiteStrategy(hostname: string, strategy: 'static' | 'dynamic'): void {
    this.siteStrategies.set(hostname.replace('www.', ''), strategy);
    logger.debug({ hostname, strategy }, 'Updated site strategy');
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.playwrightScraper.cleanup();
    logger.info('Hybrid scraper cleanup completed');
  }
}
