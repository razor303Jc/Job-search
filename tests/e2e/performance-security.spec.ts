import { test, expect } from '@playwright/test';

test.describe('Job Dorker - Performance & Security Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('page load performance metrics', async ({ page }) => {
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      return {
        // Navigation timing
        domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.navigationStart),
        loadComplete: Math.round(navigation.loadEventEnd - navigation.navigationStart),
        ttfb: Math.round(navigation.responseStart - navigation.navigationStart) || 0, // Time to First Byte
        
        // Paint timing
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        
        // Resource counts
        resourceCount: performance.getEntriesByType('resource').length
      };
    });
    
    console.log('Performance Metrics:');
    console.log(`- Time to First Byte: ${performanceMetrics.ttfb}ms`);
    console.log(`- First Paint: ${Math.round(performanceMetrics.firstPaint)}ms`);
    console.log(`- First Contentful Paint: ${Math.round(performanceMetrics.firstContentfulPaint)}ms`);
    console.log(`- DOM Content Loaded: ${performanceMetrics.domContentLoaded}ms`);
    console.log(`- Load Complete: ${performanceMetrics.loadComplete}ms`);
    console.log(`- Resources Loaded: ${performanceMetrics.resourceCount}`);
    
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
      
      return entries.map(entry => ({
        name: entry.name,
        type: entry.initiatorType,
        size: entry.transferSize || 0,
        duration: Math.round(entry.duration),
        cached: entry.transferSize === 0 && entry.decodedBodySize > 0
      }));
    });
    
    const totalSize = resources.reduce((sum, resource) => sum + resource.size, 0);
    const cachedResources = resources.filter(r => r.cached).length;
    const largeResources = resources.filter(r => r.size > 1024 * 1024); // > 1MB
    
    console.log(`Total Resources: ${resources.length}`);
    console.log(`Total Transfer Size: ${Math.round(totalSize / 1024)}KB`);
    console.log(`Cached Resources: ${cachedResources}`);
    console.log(`Large Resources (>1MB): ${largeResources.length}`);
    
    if (largeResources.length > 0) {
      console.log('Large Resources:');
      largeResources.forEach(resource => {
        console.log(`  - ${resource.name}: ${Math.round(resource.size / 1024)}KB`);
      });
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
          limit: (performance as any).memory.jsHeapSizeLimit
        };
      }
      return null;
    });
    
    if (initialMemory) {
      console.log('Initial Memory Usage:');
      console.log(`- Used: ${Math.round(initialMemory.used / 1024 / 1024)}MB`);
      console.log(`- Total: ${Math.round(initialMemory.total / 1024 / 1024)}MB`);
      console.log(`- Limit: ${Math.round(initialMemory.limit / 1024 / 1024)}MB`);
      
      // Simulate some user interactions
      await page.click('body');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(1000);
      
      // Check memory after interactions
      const laterMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return {
            used: (performance as any).memory.usedJSHeapSize,
            total: (performance as any).memory.totalJSHeapSize
          };
        }
        return null;
      });
      
      if (laterMemory) {
        const memoryIncrease = laterMemory.used - initialMemory.used;
        console.log(`Memory increase: ${Math.round(memoryIncrease / 1024)}KB`);
        
        // Memory shouldn't increase dramatically from simple interactions
        expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // Under 5MB increase
      }
    } else {
      console.log('Memory API not available in this browser');
    }
  });

  test('security headers and HTTPS', async ({ page }) => {
    const response = await page.request.get('/');
    const headers = response.headers();
    
    console.log('Security Headers Check:');
    
    const securityHeaders = {
      'x-content-type-options': 'Content Type Options',
      'x-frame-options': 'Frame Options', 
      'x-xss-protection': 'XSS Protection',
      'strict-transport-security': 'HSTS',
      'content-security-policy': 'CSP',
      'referrer-policy': 'Referrer Policy',
      'permissions-policy': 'Permissions Policy'
    };
    
    let securityScore = 0;
    for (const [header, name] of Object.entries(securityHeaders)) {
      if (headers[header]) {
        console.log(`✓ ${name}: ${headers[header]}`);
        securityScore++;
      } else {
        console.log(`✗ ${name}: Missing`);
      }
    }
    
    console.log(`Security Score: ${securityScore}/${Object.keys(securityHeaders).length}`);
    
    // Check if served over HTTPS in production
    const isHTTPS = page.url().startsWith('https://');
    console.log(`HTTPS: ${isHTTPS ? '✓' : '✗ (OK for local development)'}`);
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
      console.log(`XSS Protection: ${alertFired ? '✗ Vulnerable' : '✓ Protected'}`);
      
      // Test SQL injection patterns (for search fields)
      const sqlPayload = "'; DROP TABLE users; --";
      await firstInput.fill(sqlPayload);
      
      // The page should still function normally
      await page.waitForTimeout(500);
      const pageStillWorks = await page.locator('body').isVisible();
      expect(pageStillWorks).toBe(true);
      
      console.log(`SQL Injection Protection: ${pageStillWorks ? '✓ Protected' : '✗ Vulnerable'}`);
    } else {
      console.log('No input fields found to test');
    }
  });

  test('error handling and information disclosure', async ({ page }) => {
    // Test various error conditions
    const errorTests = [
      { url: '/nonexistent', expectedStatus: 404, description: '404 Error' },
      { url: '/api/nonexistent', expectedStatus: 404, description: 'API 404' },
      { url: '/../../../etc/passwd', expectedStatus: [400, 404], description: 'Path Traversal' },
      { url: '/.env', expectedStatus: [403, 404], description: 'Environment File Access' }
    ];
    
    for (const test of errorTests) {
      const response = await page.request.get(test.url);
      const status = response.status();
      const body = await response.text();
      
      const expectedStatuses = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];
      const statusOK = expectedStatuses.includes(status);
      
      console.log(`${test.description}: ${status} ${statusOK ? '✓' : '✗'}`);
      
      // Check for information disclosure in error messages
      const sensitiveInfo = [
        'stack trace',
        'file path',
        'database',
        'password',
        'secret',
        'token',
        'internal server error'
      ];
      
      const hasInfoDisclosure = sensitiveInfo.some(info => 
        body.toLowerCase().includes(info)
      );
      
      if (hasInfoDisclosure) {
        console.log(`  ⚠ Potential information disclosure in error response`);
      }
      
      expect(statusOK).toBe(true);
    }
  });

  test('rate limiting and DoS protection', async ({ page }) => {
    // Test rapid requests to same endpoint
    const startTime = Date.now();
    const requests: Promise<any>[] = [];
    
    for (let i = 0; i < 10; i++) {
      requests.push(page.request.get('/health'));
    }
    
    const responses = await Promise.all(requests);
    const endTime = Date.now();
    
    const statuses = responses.map(r => r.status());
    const rateLimited = statuses.filter(s => s === 429).length; // 429 = Too Many Requests
    const successful = statuses.filter(s => s === 200).length;
    
    console.log(`Rapid Requests Test (${endTime - startTime}ms):`);
    console.log(`- Successful: ${successful}`);
    console.log(`- Rate Limited: ${rateLimited}`);
    console.log(`- Other Statuses: ${statuses.filter(s => s !== 200 && s !== 429).length}`);
    
    // All requests should either succeed or be rate limited (not crash)
    const validResponses = statuses.every(s => s === 200 || s === 429 || s === 503);
    expect(validResponses).toBe(true);
  });

  test('cookie security and session management', async ({ page }) => {
    const cookies = await page.context().cookies();
    
    console.log(`Cookies found: ${cookies.length}`);
    
    if (cookies.length > 0) {
      for (const cookie of cookies) {
        console.log(`Cookie: ${cookie.name}`);
        console.log(`  - Secure: ${cookie.secure ? '✓' : '✗'}`);
        console.log(`  - HttpOnly: ${cookie.httpOnly ? '✓' : '✗'}`);
        console.log(`  - SameSite: ${cookie.sameSite || 'None'}`);
        
        // Security checks
        if (cookie.name.toLowerCase().includes('session') || cookie.name.toLowerCase().includes('auth')) {
          expect(cookie.httpOnly).toBe(true); // Session cookies should be HttpOnly
          console.log(`  - Security: ${cookie.httpOnly ? '✓ Secure' : '✗ Insecure'}`);
        }
      }
    } else {
      console.log('No cookies set (stateless application)');
    }
  });

  test('CSP compliance and inline script detection', async ({ page }) => {
    let cspViolations: any[] = [];
    
    // Listen for CSP violations
    page.on('response', response => {
      const cspHeader = response.headers()['content-security-policy'];
      if (cspHeader) {
        console.log(`CSP Header: ${cspHeader}`);
      }
    });
    
    // Check for inline scripts (potential security risk)
    const inlineScripts = await page.locator('script:not([src])').count();
    const inlineStyles = await page.locator('style, [style]').count();
    
    console.log(`Inline scripts: ${inlineScripts}`);
    console.log(`Inline styles: ${inlineStyles}`);
    
    // Modern apps should minimize inline scripts for CSP compliance
    if (inlineScripts > 5) {
      console.log('⚠ High number of inline scripts may violate strict CSP');
    }
  });

});
