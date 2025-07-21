/**
 * Playwright-based scraper for dynamic content
 * Handles JavaScript-heavy sites and dynamic loading
 */

import { type Browser, type Page, chromium, firefox, webkit } from 'playwright';
import { logger } from '@/utils/logger.js';
import { setTimeout } from 'node:timers/promises';

export interface PlaywrightResult {
  success: boolean;
  url: string;
  content: string;
  statusCode: number;
  headers: Record<string, string>;
  duration: number;
  timestamp: Date;
  error?: string;
  metadata: {
    title?: string;
    browserType: string;
    finalUrl?: string;
    viewport?: { width: number; height: number };
  };
}

export interface PlaywrightOptions {
  browser?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  waitForSelector?: string;
  waitForTimeout?: number;
  screenshot?: boolean;
  screenshotPath?: string;
  blockImages?: boolean;
  blockCSS?: boolean;
  viewport?: { width: number; height: number };
  userAgent?: string;
}

export class PlaywrightScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly browserType: 'chromium' | 'firefox' | 'webkit';
  private readonly defaultOptions: Required<PlaywrightOptions>;

  constructor(options: PlaywrightOptions = {}) {
    this.browserType = options.browser || 'chromium';
    this.defaultOptions = {
      browser: this.browserType,
      headless: options.headless ?? true,
      waitForTimeout: options.waitForTimeout ?? 5000,
      blockImages: options.blockImages ?? true,
      blockCSS: options.blockCSS ?? true,
      viewport: options.viewport ?? { width: 1920, height: 1080 },
      userAgent: options.userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      screenshot: options.screenshot ?? false,
      screenshotPath: options.screenshotPath ?? '',
      waitForSelector: options.waitForSelector ?? '',
    };
  }

  /**
   * Initialize browser and page
   */
  async initialize(): Promise<void> {
    if (this.browser) return;

    const startTime = Date.now();
    
    try {
      // Select browser based on type
      const browserLauncher = {
        chromium,
        firefox,
        webkit,
      }[this.browserType];

      this.browser = await browserLauncher.launch({
        headless: this.defaultOptions.headless,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
        ],
      });

      this.page = await this.browser.newPage({
        viewport: this.defaultOptions.viewport,
        userAgent: this.defaultOptions.userAgent,
      });

      // Block unnecessary resources to improve performance
      if (this.defaultOptions.blockImages || this.defaultOptions.blockCSS) {
        await this.page.route('**/*', (route) => {
          const resourceType = route.request().resourceType();
          if (
            (this.defaultOptions.blockImages && resourceType === 'image') ||
            (this.defaultOptions.blockCSS && resourceType === 'stylesheet')
          ) {
            route.abort();
          } else {
            route.continue();
          }
        });
      }

      const duration = Date.now() - startTime;
      logger.info(
        {
          browserType: this.browserType,
          headless: this.defaultOptions.headless,
          duration,
        },
        'Playwright browser initialized',
      );
    } catch (error) {
      logger.error({ error, browserType: this.browserType }, 'Failed to initialize Playwright browser');
      throw error;
    }
  }

  /**
   * Scrape content from URL using Playwright
   */
  async scrape(url: string, options: PlaywrightOptions = {}): Promise<PlaywrightResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    try {
      await this.initialize();
      
      if (!this.page) {
        throw new Error('Page not initialized');
      }

      logger.debug({ url, options: mergedOptions }, 'Starting Playwright scraping');

      // Navigate to URL
      const response = await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: mergedOptions.waitForTimeout || 30000,
      });

      if (!response) {
        throw new Error('Failed to navigate to URL');
      }

      // Wait for specific selector if provided
      if (mergedOptions.waitForSelector) {
        try {
          await this.page.waitForSelector(mergedOptions.waitForSelector, {
            timeout: mergedOptions.waitForTimeout || 5000,
          });
        } catch (error) {
          logger.warn(
            { selector: mergedOptions.waitForSelector, url },
            'Selector not found within timeout',
          );
        }
      }

      // Wait for additional timeout if needed
      if (mergedOptions.waitForTimeout && mergedOptions.waitForTimeout > 0) {
        await setTimeout(mergedOptions.waitForTimeout);
      }

      // Take screenshot if requested
      if (mergedOptions.screenshot && mergedOptions.screenshotPath) {
        await this.page.screenshot({ path: mergedOptions.screenshotPath, fullPage: true });
        logger.debug({ path: mergedOptions.screenshotPath }, 'Screenshot saved');
      }

      // Get page content
      const content = await this.page.content();
      const title = await this.page.title();

      const duration = Date.now() - startTime;

      const result: PlaywrightResult = {
        url,
        content,
        statusCode: response.status(),
        headers: { ...response.headers() },
        duration,
        timestamp: new Date(),
        success: true,
        metadata: {
          title,
          browserType: this.browserType,
          finalUrl: this.page.url(),
          viewport: mergedOptions.viewport,
        },
      };

      logger.info(
        {
          url,
          statusCode: result.statusCode,
          contentLength: content.length,
          duration,
          browserType: this.browserType,
        },
        'Playwright scraping completed successfully',
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(
        {
          url,
          error: error instanceof Error ? error.message : String(error),
          duration,
          browserType: this.browserType,
        },
        'Playwright scraping failed',
      );

      return {
        url,
        content: '',
        statusCode: 0,
        headers: {},
        duration,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          browserType: this.browserType,
        },
      };
    }
  }

  /**
   * Execute custom JavaScript on the page
   */
  async executeScript<T = unknown>(script: string): Promise<T> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      const result = await this.page.evaluate(script);
      logger.debug({ script: script.substring(0, 100) }, 'JavaScript executed successfully');
      return result as T;
    } catch (error) {
      logger.error({ error, script: script.substring(0, 100) }, 'JavaScript execution failed');
      throw error;
    }
  }

  /**
   * Wait for network idle (useful for SPAs)
   */
  async waitForNetworkIdle(timeout = 30000): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      await this.page.waitForLoadState('networkidle', { timeout });
      logger.debug('Network idle state reached');
    } catch (error) {
      logger.warn({ error, timeout }, 'Network idle timeout');
    }
  }

  /**
   * Get page performance metrics
   */
  async getMetrics(): Promise<Record<string, number>> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      const metrics = await this.page.evaluate(() => {
        // Simple performance measurement
        return {
          loadTime: performance.now(),
          memoryUsed: (performance as any).memory?.usedJSHeapSize || 0,
          timeOrigin: performance.timeOrigin,
        };
      });

      logger.debug({ metrics }, 'Page performance metrics collected');
      return metrics;
    } catch (error) {
      logger.error({ error }, 'Failed to collect performance metrics');
      return {};
    }
  }

  /**
   * Close browser and cleanup resources
   */
  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
        logger.debug('Playwright page closed');
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        logger.debug('Playwright browser closed');
      }
    } catch (error) {
      logger.error({ error }, 'Error closing Playwright browser');
    }
  }

  /**
   * Check if scraper is initialized
   */
  isInitialized(): boolean {
    return this.browser !== null && this.page !== null;
  }

  /**
   * Get current page URL
   */
  getCurrentUrl(): string | null {
    return this.page?.url() || null;
  }

  /**
   * Set request headers
   */
  async setHeaders(headers: Record<string, string>): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    await this.page.setExtraHTTPHeaders(headers);
    logger.debug({ headers }, 'Request headers set');
  }

  /**
   * Handle authentication if needed
   */
  async authenticate(username: string, password: string): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    await this.page.context().setHTTPCredentials({ username, password });
    logger.debug({ username }, 'Authentication credentials set');
  }

  /**
   * Block specific resource types
   */
  async blockResources(resourceTypes: string[]): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    await this.page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (resourceTypes.includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    logger.debug({ resourceTypes }, 'Resource blocking configured');
  }
}
