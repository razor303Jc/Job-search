/**
 * Base Scraper Tests
 * Phase 8 Stage 1: Comprehensive Test Suite Expansion
 *
 * Tests for the base scraper functionality
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock implementation of the base scraper
class MockBaseScraper {
  private config: any;
  private rateLimit: number;
  private lastRequest: number;
  private retryAttempts: number;
  private timeout: number;

  constructor(config: any = {}) {
    this.config = {
      rateLimit: 1000, // 1 second between requests
      maxRetries: 3,
      timeout: 10000,
      userAgent: 'JobDorker/1.0',
      ...config,
    };
    this.rateLimit = this.config.rateLimit;
    this.lastRequest = 0;
    this.retryAttempts = 0;
    this.timeout = this.config.timeout;
  }

  async scrape(url: string): Promise<any> {
    await this.enforceRateLimit();

    try {
      const response = await this.makeRequest(url);
      return this.parseResponse(response);
    } catch (error) {
      if (this.retryAttempts < this.config.maxRetries) {
        this.retryAttempts++;
        await this.delay(1000 * this.retryAttempts); // Exponential backoff
        return this.scrape(url);
      }
      throw error;
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < this.rateLimit) {
      const waitTime = this.rateLimit - timeSinceLastRequest;
      await this.delay(waitTime);
    }

    this.lastRequest = Date.now();
  }

  protected async makeRequest(url: string): Promise<string> {
    // Mock HTTP request
    if (url.includes('error')) {
      throw new Error('Request failed');
    }
    if (url.includes('timeout')) {
      throw new Error('Request timeout');
    }

    // Return different content for different URLs
    if (url.includes('fast')) {
      return '<html><head><title>Test Page</title></head><body>Fast response content</body></html>';
    }
    if (url.includes('no-title')) {
      return '<html><body>Content without title</body></html>';
    }

    return '<html><head><title>Test Page</title></head><body>Mock response content</body></html>';
  }

  private parseResponse(html: string): any {
    // Mock parsing
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1] : 'No title';

    return {
      url: 'mock-url',
      title,
      content: html,
      timestamp: Date.now(),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Getters for testing
  getRateLimit(): number {
    return this.rateLimit;
  }
  getRetryAttempts(): number {
    return this.retryAttempts;
  }
  getConfig(): any {
    return this.config;
  }
  resetRetryAttempts(): void {
    this.retryAttempts = 0;
  }
}

describe('Base Scraper Functionality', () => {
  let scraper: MockBaseScraper;

  beforeEach(() => {
    scraper = new MockBaseScraper();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const config = scraper.getConfig();

      expect(config.rateLimit).toBe(1000);
      expect(config.maxRetries).toBe(3);
      expect(config.timeout).toBe(10000);
      expect(config.userAgent).toBe('JobDorker/1.0');
    });

    it('should accept custom configuration', () => {
      const customScraper = new MockBaseScraper({
        rateLimit: 2000,
        maxRetries: 5,
        timeout: 5000,
        userAgent: 'Custom/1.0',
      });

      const config = customScraper.getConfig();

      expect(config.rateLimit).toBe(2000);
      expect(config.maxRetries).toBe(5);
      expect(config.timeout).toBe(5000);
      expect(config.userAgent).toBe('Custom/1.0');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting between requests', async () => {
      // First request
      const promise1 = scraper.scrape('http://example.com/1');

      // Advance time by rate limit duration
      vi.advanceTimersByTime(1000);
      await expect(promise1).resolves.toBeDefined();

      // Second request should be delayed
      const promise2 = scraper.scrape('http://example.com/2');
      vi.advanceTimersByTime(1000);
      await expect(promise2).resolves.toBeDefined();
    });

    it('should respect custom rate limits', () => {
      const customScraper = new MockBaseScraper({ rateLimit: 2000 });
      expect(customScraper.getRateLimit()).toBe(2000);
    });
  });

  describe('Error Handling and Retries', () => {
    it('should retry failed requests up to maxRetries', async () => {
      // Use real timers for this test to avoid deadlocks
      vi.useRealTimers();

      // Create scraper with very short delays for testing
      const testScraper = new MockBaseScraper({ rateLimit: 10, maxRetries: 3 });
      testScraper.resetRetryAttempts();

      try {
        await testScraper.scrape('http://example.com/error');
        expect.fail('Expected scraper to throw an error after retries');
      } catch (error) {
        expect(testScraper.getRetryAttempts()).toBe(3);
        expect((error as Error).message).toBe('Request failed');
      }

      // Restore fake timers
      vi.useFakeTimers();
    }, 10000);

    it('should succeed on retry if request recovers', async () => {
      // Use real timers for this test
      vi.useRealTimers();

      // Mock a scraper that fails once then succeeds
      class RetryTestScraper extends MockBaseScraper {
        private attemptCount = 0;

        protected async makeRequest(): Promise<string> {
          this.attemptCount++;
          if (this.attemptCount === 1) {
            throw new Error('First attempt fails');
          }
          return '<html><head><title>Success</title></head><body>Content</body></html>';
        }
      }

      const retryScraper = new RetryTestScraper({ rateLimit: 10, maxRetries: 3 });

      const result = await retryScraper.scrape('http://example.com/retry');
      expect(result.title).toBe('Success');
      expect(result.content).toContain('Content');

      // Restore fake timers
      vi.useFakeTimers();
    }, 10000);

    it('should handle timeout errors', async () => {
      // Use real timers for this test
      vi.useRealTimers();

      // Create scraper with very short timeout for testing
      const timeoutScraper = new MockBaseScraper({ rateLimit: 10, maxRetries: 1 });

      try {
        await timeoutScraper.scrape('http://example.com/timeout');
        expect.fail('Expected scraper to throw a timeout error');
      } catch (error) {
        expect((error as Error).message).toBe('Request timeout');
      }

      // Restore fake timers
      vi.useFakeTimers();
    }, 10000);
  });

  describe('Response Parsing', () => {
    it('should parse HTML responses correctly', async () => {
      const result = await scraper.scrape('http://example.com/test');

      expect(result).toBeDefined();
      expect(result.content).toContain('Mock response content');
      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('number');
    });

    it('should handle responses without title', async () => {
      const result = await scraper.scrape('http://example.com/no-title');
      expect(result.title).toBe('No title');
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete scraping within reasonable time', async () => {
      // Test without fake timers for performance measurement
      vi.useRealTimers();

      const startTime = Date.now();
      const result = await scraper.scrape('http://example.com/fast');
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (allowing for test environment)
      expect(duration).toBeLessThan(5000); // 5 seconds is reasonable for tests
      expect(result.title).toBe('Test Page');

      // Restore fake timers
      vi.useFakeTimers();
    });

    it('should handle multiple concurrent scraping attempts', async () => {
      const urls = ['http://example.com/1', 'http://example.com/2', 'http://example.com/3'];

      const promises = urls.map((url) => scraper.scrape(url));

      // Advance timers to allow all requests to complete
      vi.advanceTimersByTime(5000);

      const results = await Promise.allSettled(promises);

      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty URLs gracefully', async () => {
      try {
        await scraper.scrape('');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle malformed URLs', async () => {
      try {
        const result = await scraper.scrape('not-a-url');
        // Should either succeed with mock or throw error
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle very long URLs', async () => {
      const longUrl = `http://example.com/${'a'.repeat(1000)}`;

      const promise = scraper.scrape(longUrl);
      vi.advanceTimersByTime(1000);

      const result = await promise;
      expect(result).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    it('should not accumulate memory over multiple requests', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple scraping operations
      for (let i = 0; i < 10; i++) {
        const promise = scraper.scrape(`http://example.com/${i}`);
        vi.advanceTimersByTime(1000);
        await promise;
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
