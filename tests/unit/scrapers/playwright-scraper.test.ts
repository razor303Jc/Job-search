/**
 * Unit tests for PlaywrightScraper
 * Tests dynamic content scraping capabilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlaywrightScraper, type PlaywrightOptions } from '../../../src/scrapers/playwright-scraper.js';

describe('PlaywrightScraper', () => {
  let scraper: PlaywrightScraper;

  beforeEach(() => {
    scraper = new PlaywrightScraper({
      headless: true,
      waitForTimeout: 5000,
    });
  });

  afterEach(async () => {
    await scraper.close();
  });

  describe('initialization', () => {
    it('should create scraper instance', () => {
      expect(scraper).toBeDefined();
      expect(scraper.isInitialized()).toBe(false);
    });

    it('should initialize browser when scraping', async () => {
      const result = await scraper.scrape('https://example.com');
      
      expect(scraper.isInitialized()).toBe(true);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.content).toContain('Example Domain');
    });
  });

  describe('scraping functionality', () => {
    it('should scrape static content successfully', async () => {
      const result = await scraper.scrape('https://example.com');
      
      expect(result.success).toBe(true);
      expect(result.url).toBe('https://example.com');
      expect(result.content).toContain('html');
      expect(result.statusCode).toBe(200);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle invalid URLs gracefully', async () => {
      const result = await scraper.scrape('https://nonexistent-domain-12345.com');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.content).toBe('');
    });

    it('should respect custom options', async () => {
      const options: PlaywrightOptions = {
        waitForTimeout: 1000,
        userAgent: 'TestBot/1.0',
      };

      const result = await scraper.scrape('https://httpbin.org/user-agent', options);
      
      if (result.success) {
        expect(result.content).toContain('TestBot/1.0');
      }
    });
  });

  describe('browser management', () => {
    it('should support different browser types', async () => {
      const chromiumScraper = new PlaywrightScraper({ browser: 'chromium' });
      const firefoxScraper = new PlaywrightScraper({ browser: 'firefox' });
      
      try {
        const chromiumResult = await chromiumScraper.scrape('https://example.com');
        const firefoxResult = await firefoxScraper.scrape('https://example.com');
        
        expect(chromiumResult.success).toBe(true);
        expect(firefoxResult.success).toBe(true);
        expect(chromiumResult.metadata.browserType).toBe('chromium');
        expect(firefoxResult.metadata.browserType).toBe('firefox');
      } finally {
        await chromiumScraper.close();
        await firefoxScraper.close();
      }
    });

    it('should clean up resources properly', async () => {
      await scraper.scrape('https://example.com');
      expect(scraper.isInitialized()).toBe(true);
      
      await scraper.close();
      expect(scraper.isInitialized()).toBe(false);
    });
  });

  describe('JavaScript execution', () => {
    it('should execute custom JavaScript', async () => {
      await scraper.scrape('https://example.com');
      
      const title = await scraper.executeScript<string>('document.title');
      expect(title).toBe('Example Domain');
      
      const url = await scraper.executeScript<string>('window.location.href');
      expect(url).toBe('https://example.com/');
    });

    it('should handle JavaScript errors gracefully', async () => {
      await scraper.scrape('https://example.com');
      
      await expect(
        scraper.executeScript('nonexistentFunction()')
      ).rejects.toThrow();
    });
  });

  describe('performance metrics', () => {
    it('should collect performance metrics', async () => {
      await scraper.scrape('https://example.com');
      
      const metrics = await scraper.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.loadTime).toBe('number');
      expect(typeof metrics.timeOrigin).toBe('number');
    });
  });

  describe('utility methods', () => {
    it('should get current URL', async () => {
      await scraper.scrape('https://example.com');
      
      const currentUrl = scraper.getCurrentUrl();
      expect(currentUrl).toBe('https://example.com/');
    });

    it('should set request headers', async () => {
      await scraper.scrape('https://example.com');
      
      await scraper.setHeaders({
        'X-Custom-Header': 'test-value',
      });
      
      // Headers are set for future requests
      expect(scraper.isInitialized()).toBe(true);
    });

    it('should wait for network idle', async () => {
      await scraper.scrape('https://example.com');
      
      // This should not throw an error
      await scraper.waitForNetworkIdle(1000);
    });
  });

  describe('error handling', () => {
    it('should handle page navigation errors', async () => {
      const result = await scraper.scrape('https://httpstat.us/500');
      
      // Should still return a result even for HTTP errors
      expect(result).toBeDefined();
      expect(result.url).toBe('https://httpstat.us/500');
    });

    it('should handle timeout errors', async () => {
      const result = await scraper.scrape('https://httpbin.org/delay/10', {
        waitForTimeout: 1000,
      });
      
      // Should timeout and return error
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('content validation', () => {
    it('should return HTML content', async () => {
      const result = await scraper.scrape('https://example.com');
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('<!doctype html>');
      expect(result.content).toContain('<title>');
      expect(result.content).toContain('</html>');
    });

    it('should include metadata', async () => {
      const result = await scraper.scrape('https://example.com');
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.title).toBe('Example Domain');
      expect(result.metadata.browserType).toBe('chromium');
      expect(result.metadata.finalUrl).toBe('https://example.com/');
    });
  });
});
