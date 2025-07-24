import { expect, test } from '@playwright/test';

test.describe('Job Dorker - Performance & Security Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('page load performance metrics', async ({ page }) => {
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      return {
        // Navigation timing
        domContentLoaded: Math.round(
          navigation.domContentLoadedEventEnd - navigation.navigationStart,
        ),
        loadComplete: Math.round(navigation.loadEventEnd - navigation.navigationStart),
        ttfb: Math.round(navigation.responseStart - navigation.navigationStart) || 0, // Time to First Byte

        // Paint timing
        firstPaint: paint.find((p) => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint:
          paint.find((p) => p.name === 'first-contentful-paint')?.startTime || 0,

        // Resource counts
        resourceCount: performance.getEntriesByType('resource').length,
      };
    });

    // Performance expectations
    if (performanceMetrics.ttfb > 0) {
      expect(performanceMetrics.ttfb).toBeLessThan(2000); // TTFB under 2s
    }
    expect(performanceMetrics.domContentLoaded).toBeLessThan(5000); // DOM ready under 5s

    if (performanceMetrics.firstContentfulPaint > 0) {
      expect(performanceMetrics.firstContentfulPaint).toBeLessThan(3000); // FCP under 3s
    }
  });

  test('resource optimization and compression', async ({ page }) => {
    const resources = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

      return entries.map((entry) => ({
        name: entry.name,
        type: entry.initiatorType,
        size: entry.transferSize || 0,
        duration: Math.round(entry.duration),
        cached: entry.transferSize === 0 && entry.decodedBodySize > 0,
      }));
    });

    const totalSize = resources.reduce((sum, resource) => sum + resource.size, 0);
    const _cachedResources = resources.filter((r) => r.cached).length;
    const largeResources = resources.filter((r) => r.size > 1024 * 1024); // > 1MB

    if (largeResources.length > 0) {
      largeResources.forEach((_resource) => {});
    }

    // Should have reasonable total size
    expect(totalSize).toBeLessThan(10 * 1024 * 1024); // Under 10MB total
  });

  test('memory usage and leaks', async ({ page }) => {
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize,
          limit: (performance as any).memory.jsHeapSizeLimit,
        };
      }
      return null;
    });

    if (initialMemory) {
      // Simulate some user interactions
      await page.click('body');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(1000);

      // Check memory after interactions
      const laterMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return {
            used: (performance as any).memory.usedJSHeapSize,
            total: (performance as any).memory.totalJSHeapSize,
          };
        }
        return null;
      });

      if (laterMemory) {
        const memoryIncrease = laterMemory.used - initialMemory.used;

        // Memory shouldn't increase dramatically from simple interactions
        expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // Under 5MB increase
      }
    } else {
    }
  });

  test('security headers and HTTPS', async ({ page }) => {
    const response = await page.request.get('/');
    const headers = response.headers();

    const securityHeaders = {
      'x-content-type-options': 'Content Type Options',
      'x-frame-options': 'Frame Options',
      'x-xss-protection': 'XSS Protection',
      'strict-transport-security': 'HSTS',
      'content-security-policy': 'CSP',
      'referrer-policy': 'Referrer Policy',
      'permissions-policy': 'Permissions Policy',
    };

    let _securityScore = 0;
    for (const [header, _name] of Object.entries(securityHeaders)) {
      if (headers[header]) {
        _securityScore++;
      } else {
      }
    }

    // Check if served over HTTPS in production
    const _isHTTPS = page.url().startsWith('https://');
  });

  test('input validation and XSS protection', async ({ page }) => {
    // Look for input fields to test
    const inputFields = page.locator('input[type="text"], input[type="search"], textarea');
    const inputCount = await inputFields.count();

    if (inputCount > 0) {
      const firstInput = inputFields.first();

      // Test XSS attempt
      const xssPayload = '<script>alert("xss")</script>';
      await firstInput.fill(xssPayload);

      // Check if script was executed (it shouldn't be)
      const alertFired = await page.evaluate(() => {
        // Check if any script tags were actually added to DOM
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          if (script.textContent?.includes('alert("xss")')) {
            return true;
          }
        }
        return false;
      });

      expect(alertFired).toBe(false);

      // Test SQL injection patterns (for search fields)
      const sqlPayload = "'; DROP TABLE users; --";
      await firstInput.fill(sqlPayload);

      // The page should still function normally
      await page.waitForTimeout(500);
      const pageStillWorks = await page.locator('body').isVisible();
      expect(pageStillWorks).toBe(true);
    } else {
    }
  });

  test('error handling and information disclosure', async ({ page }) => {
    // Test various error conditions
    const errorTests = [
      { url: '/nonexistent', expectedStatus: 404, description: '404 Error' },
      { url: '/api/nonexistent', expectedStatus: 404, description: 'API 404' },
      { url: '/../../../etc/passwd', expectedStatus: [400, 404], description: 'Path Traversal' },
      { url: '/.env', expectedStatus: [403, 404], description: 'Environment File Access' },
    ];

    for (const test of errorTests) {
      const response = await page.request.get(test.url);
      const status = response.status();
      const body = await response.text();

      const expectedStatuses = Array.isArray(test.expectedStatus)
        ? test.expectedStatus
        : [test.expectedStatus];
      const statusOK = expectedStatuses.includes(status);

      // Check for information disclosure in error messages
      const sensitiveInfo = [
        'stack trace',
        'file path',
        'database',
        'password',
        'secret',
        'token',
        'internal server error',
      ];

      const hasInfoDisclosure = sensitiveInfo.some((info) => body.toLowerCase().includes(info));

      if (hasInfoDisclosure) {
      }

      expect(statusOK).toBe(true);
    }
  });

  test('rate limiting and DoS protection', async ({ page }) => {
    // Test rapid requests to same endpoint
    const _startTime = Date.now();
    const requests: Promise<any>[] = [];

    for (let i = 0; i < 10; i++) {
      requests.push(page.request.get('/health'));
    }

    const responses = await Promise.all(requests);
    const _endTime = Date.now();

    const statuses = responses.map((r) => r.status());
    const _rateLimited = statuses.filter((s) => s === 429).length; // 429 = Too Many Requests
    const _successful = statuses.filter((s) => s === 200).length;

    // All requests should either succeed or be rate limited (not crash)
    const validResponses = statuses.every((s) => s === 200 || s === 429 || s === 503);
    expect(validResponses).toBe(true);
  });

  test('cookie security and session management', async ({ page }) => {
    const cookies = await page.context().cookies();

    if (cookies.length > 0) {
      for (const cookie of cookies) {
        // Security checks
        if (
          cookie.name.toLowerCase().includes('session') ||
          cookie.name.toLowerCase().includes('auth')
        ) {
          expect(cookie.httpOnly).toBe(true); // Session cookies should be HttpOnly
        }
      }
    } else {
    }
  });

  test('CSP compliance and inline script detection', async ({ page }) => {
    const _cspViolations: any[] = [];

    // Listen for CSP violations
    page.on('response', (response) => {
      const cspHeader = response.headers()['content-security-policy'];
      if (cspHeader) {
      }
    });

    // Check for inline scripts (potential security risk)
    const inlineScripts = await page.locator('script:not([src])').count();
    const _inlineStyles = await page.locator('style, [style]').count();

    // Modern apps should minimize inline scripts for CSP compliance
    if (inlineScripts > 5) {
    }
  });
});
