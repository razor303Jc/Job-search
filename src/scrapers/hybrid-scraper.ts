/**
 * Hybrid scraper that intelligently chooses between static and dynamic scraping
 * Uses heuristics to determine the best scraping strategy
 */

import { CheerioScraper } from './cheerio-scraper.js';
import { PlaywrightScraper, type PlaywrightOptions } from './playwright-scraper.js';
import { logger } from '@/utils/logger.js';
import type { ScraperConfig } from '@/config/schemas.js';
import type { SiteConfig } from '@/config/sites.js';

export interface HybridScrapingOptions {
  // Static scraping options
  userAgent?: string;
  headers?: Record<string, string>;
  timeout?: number;
  
  // Dynamic scraping options
  playwright?: PlaywrightOptions;
  
  // Hybrid strategy options
  strategy?: 'auto' | 'static' | 'dynamic';
  fallbackToDynamic?: boolean;
  detectJavaScript?: boolean;
  minContentLength?: number;
}

export interface HybridResult {
  success: boolean;
  data?: string;
  strategy: 'static' | 'dynamic';
  statusCode: number;
  duration: number;
  metadata: {
    url: string;
    timestamp: Date;
    contentLength: number;
    hasJavaScript: boolean;
    fallbackUsed: boolean;
  };
  error?: string;
}

export class HybridScraper {
  private cheerioScraper: CheerioScraper;
  private playwrightScraper: PlaywrightScraper;
  private readonly defaultOptions: Required<HybridScrapingOptions>;

  constructor(
    scraperConfig: ScraperConfig,
    siteConfig: SiteConfig,
    options: HybridScrapingOptions = {}
  ) {
    this.defaultOptions = {
      userAgent: options.userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      headers: options.headers ?? {},
      timeout: options.timeout ?? 10000,
      playwright: options.playwright ?? { headless: true },
      strategy: options.strategy ?? 'auto',
      fallbackToDynamic: options.fallbackToDynamic ?? true,
      detectJavaScript: options.detectJavaScript ?? true,
      minContentLength: options.minContentLength ?? 1000,
    };

    this.cheerioScraper = new CheerioScraper(scraperConfig, siteConfig);
    this.playwrightScraper = new PlaywrightScraper(this.defaultOptions.playwright);
  }

  /**
   * Scrape URL using intelligent strategy selection
   */
  async scrape(url: string, options: HybridScrapingOptions = {}): Promise<HybridResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    logger.info({ url, strategy: mergedOptions.strategy }, 'Starting hybrid scraping');

    try {
      // Determine strategy
      let strategy = mergedOptions.strategy;
      
      if (strategy === 'auto') {
        strategy = await this.determineStrategy(url, mergedOptions);
      }

      if (strategy === 'static') {
        return await this.scrapeStatic(url, mergedOptions, startTime);
      } else {
        return await this.scrapeDynamic(url, mergedOptions, startTime);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error({ url, error, duration }, 'Hybrid scraping failed');
      
      return {
        success: false,
        strategy: 'static',
        statusCode: 0,
        duration,
        metadata: {
          url,
          timestamp: new Date(),
          contentLength: 0,
          hasJavaScript: false,
          fallbackUsed: false,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Determine the best scraping strategy for a URL
   */
  private async determineStrategy(
    url: string, 
    options: Required<HybridScrapingOptions>
  ): Promise<'static' | 'dynamic'> {
    
    // Check domain patterns that typically require JavaScript
    const jsRequiredPatterns = [
      /linkedin\.com/,
      /glassdoor\.com/,
      /indeed\.com.*\/viewjob/,
      /angel\.co/,
      /stackoverflow\.com\/jobs/,
      /remote\.co/,
      /weworkremotely\.com/,
    ];

    if (jsRequiredPatterns.some(pattern => pattern.test(url))) {
      logger.debug({ url }, 'URL matches JavaScript-required pattern');
      return 'dynamic';
    }

    // Try a quick static fetch to detect JavaScript requirements
    if (options.detectJavaScript) {
      try {
        const staticResult = await this.quickStaticCheck(url);
        
        if (staticResult.hasJavaScript || staticResult.contentLength < options.minContentLength) {
          logger.debug(
            { 
              url, 
              hasJavaScript: staticResult.hasJavaScript,
              contentLength: staticResult.contentLength 
            }, 
            'JavaScript detected or content too small, using dynamic scraping'
          );
          return 'dynamic';
        }
      } catch (error) {
        logger.warn({ url, error }, 'Quick static check failed, defaulting to dynamic');
        return 'dynamic';
      }
    }

    logger.debug({ url }, 'Using static scraping strategy');
    return 'static';
  }

  /**
   * Quick static check to detect JavaScript requirements
   */
  private async quickStaticCheck(url: string): Promise<{
    hasJavaScript: boolean;
    contentLength: number;
  }> {
    try {
      const result = await this.cheerioScraper.scrape({
        url,
        timeout: 5000,
      });

      if (!result.success || !result.data || result.data.length === 0) {
        return { hasJavaScript: true, contentLength: 0 };
      }

      const content = result.data[0]?.raw?.html as string || '';
      
      // Check for JavaScript indicators
      const jsIndicators = [
        /<script[^>]*>/i,
        /document\.write/i,
        /window\.location/i,
        /angular|react|vue|ember/i,
        /spa-|single.page/i,
        /loading.*spinner|loader/i,
        /please.*enable.*javascript/i,
      ];

      const hasJavaScript = jsIndicators.some(indicator => indicator.test(content));
      
      return {
        hasJavaScript,
        contentLength: content.length,
      };
    } catch (error) {
      logger.warn({ url, error }, 'Quick static check error');
      return { hasJavaScript: true, contentLength: 0 };
    }
  }

  /**
   * Scrape using static strategy (Cheerio)
   */
  private async scrapeStatic(
    url: string, 
    options: Required<HybridScrapingOptions>,
    startTime: number
  ): Promise<HybridResult> {
    
    try {
      const result = await this.cheerioScraper.scrape({
        url,
        userAgent: options.userAgent,
        headers: options.headers,
        timeout: options.timeout,
      });

      const duration = Date.now() - startTime;

      if (!result.success && options.fallbackToDynamic) {
        logger.info({ url }, 'Static scraping failed, falling back to dynamic');
        return await this.scrapeDynamic(url, options, startTime, true);
      }

      const content = result.data?.[0]?.raw?.html as string || '';

      return {
        success: result.success,
        data: content,
        strategy: 'static',
        statusCode: 200, // Cheerio doesn't provide status code
        duration,
        metadata: {
          url,
          timestamp: new Date(),
          contentLength: content.length,
          hasJavaScript: false,
          fallbackUsed: false,
        },
        error: result.error,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (options.fallbackToDynamic) {
        logger.info({ url, error }, 'Static scraping error, falling back to dynamic');
        return await this.scrapeDynamic(url, options, startTime, true);
      }

      throw error;
    }
  }

  /**
   * Scrape using dynamic strategy (Playwright)
   */
  private async scrapeDynamic(
    url: string, 
    options: Required<HybridScrapingOptions>,
    startTime: number,
    fallbackUsed = false
  ): Promise<HybridResult> {
    
    try {
      const result = await this.playwrightScraper.scrape(url, options.playwright);
      const duration = Date.now() - startTime;

      return {
        success: result.success,
        data: result.content,
        strategy: 'dynamic',
        statusCode: result.statusCode,
        duration,
        metadata: {
          url: result.url,
          timestamp: result.timestamp,
          contentLength: result.content.length,
          hasJavaScript: true,
          fallbackUsed,
        },
        error: result.error,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        data: '',
        strategy: 'dynamic',
        statusCode: 0,
        duration,
        metadata: {
          url,
          timestamp: new Date(),
          contentLength: 0,
          hasJavaScript: true,
          fallbackUsed,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.playwrightScraper.close();
      logger.debug('Hybrid scraper cleanup completed');
    } catch (error) {
      logger.error({ error }, 'Error during hybrid scraper cleanup');
    }
  }

  /**
   * Get scraper statistics
   */
  getStats(): {
    staticScraper: boolean;
    dynamicScraper: boolean;
  } {
    return {
      staticScraper: true, // CheerioScraper is always available
      dynamicScraper: this.playwrightScraper.isInitialized(),
    };
  }
}
