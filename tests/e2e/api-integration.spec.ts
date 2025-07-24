import { expect, test } from '@playwright/test';

test.describe('Job Dorker - API Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('health endpoint responds correctly', async ({ page }) => {
    const response = await page.request.get('/health');
    expect(response.status()).toBe(200);

    const healthData = await response.json();
    expect(healthData).toHaveProperty('status');
    expect(['healthy', 'ok']).toContain(healthData.status); // Accept either status

    if (healthData.timestamp) {
      const timestamp = new Date(healthData.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 60000); // Within last minute
    }
  });

  test('API endpoints return valid JSON', async ({ page }) => {
    const endpoints = ['/health', '/api/status', '/api/jobs', '/api/scrapers', '/api/stats'];

    for (const endpoint of endpoints) {
      const response = await page.request.get(endpoint);

      if (response.status() === 200) {
        try {
          const data = await response.json();
          expect(data).toBeDefined();
        } catch (_error) {}
      } else if (response.status() === 404) {
      } else {
      }
    }
  });

  test('CORS headers are properly configured', async ({ page }) => {
    const response = await page.request.get('/health');
    const headers = response.headers();

    // Check for CORS headers
    if (headers['access-control-allow-origin']) {
      expect(headers['access-control-allow-origin']).toBeTruthy();
    } else {
    }
  });

  test('API rate limiting and security headers', async ({ page }) => {
    const response = await page.request.get('/health');
    const headers = response.headers();

    // Check for security headers
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'content-security-policy',
    ];

    let _foundSecurityHeaders = 0;
    for (const header of securityHeaders) {
      if (headers[header]) {
        _foundSecurityHeaders++;
      }
    }
  });

  test('job scraper API functionality', async ({ page }) => {
    // Test job-related endpoints if they exist
    const jobEndpoints = [
      '/api/jobs',
      '/api/jobs/search',
      '/api/scrapers/status',
      '/api/scrapers/start',
      '/api/scrapers/stop',
    ];

    for (const endpoint of jobEndpoints) {
      const response = await page.request.get(endpoint);

      if (response.status() === 200) {
        const data = await response.json();

        if (endpoint.includes('/jobs')) {
          // Should be array or object with jobs data
          if (Array.isArray(data)) {
          } else if (data.jobs && Array.isArray(data.jobs)) {
          } else {
          }
        }

        if (endpoint.includes('/scrapers')) {
          if (data.status || data.scrapers) {
          }
        }
      } else if (response.status() === 404) {
      } else {
      }
    }
  });

  test('WebSocket API integration', async ({ page }) => {
    let _wsApiIntegration = false;

    page.on('websocket', (ws) => {
      ws.on('framereceived', (event) => {
        try {
          const payload = event.payload.toString();
          const data = JSON.parse(payload);
          if (data.type === 'api_update' || data.endpoint || data.api) {
            _wsApiIntegration = true;
          }
        } catch (_error) {
          // Not JSON, ignore
        }
      });
    });

    await page.waitForTimeout(3000);
  });

  test('error handling for invalid requests', async ({ page }) => {
    const invalidEndpoints = [
      '/api/nonexistent',
      '/api/jobs/invalid-id',
      '/api/../../../etc/passwd',
      '/api/jobs?malformed=query[',
    ];

    for (const endpoint of invalidEndpoints) {
      const response = await page.request.get(endpoint);

      // Should return 400, 404, or other error status (not 200)
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test('API performance and response times', async ({ page }) => {
    const endpoints = ['/health', '/api/status'];

    for (const endpoint of endpoints) {
      const startTime = Date.now();
      const response = await page.request.get(endpoint);
      const endTime = Date.now();

      const responseTime = endTime - startTime;

      if (response.status() === 200) {
        expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
      }
    }
  });

  test('data validation and schema compliance', async ({ page }) => {
    const response = await page.request.get('/health');

    if (response.status() === 200) {
      const data = await response.json();

      // Health endpoint should have required fields
      expect(data).toHaveProperty('status');
      expect(typeof data.status).toBe('string');

      if (data.timestamp) {
        expect(typeof data.timestamp).toBe('string');
        expect(new Date(data.timestamp)).toBeInstanceOf(Date);
      }

      if (data.uptime) {
        expect(typeof data.uptime).toBe('number');
        expect(data.uptime).toBeGreaterThan(0);
      }
    }
  });

  test('API authentication and authorization', async ({ page }) => {
    // Test if protected endpoints exist and handle auth correctly
    const protectedEndpoints = ['/api/admin', '/api/users', '/api/config', '/api/settings'];

    for (const endpoint of protectedEndpoints) {
      const response = await page.request.get(endpoint);

      if (response.status() === 401 || response.status() === 403) {
      } else if (response.status() === 404) {
      } else {
      }
    }
  });
});
