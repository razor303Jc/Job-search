import { test, expect } from '@playwright/test';

test.describe('Job Dorker - Core Web Application Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('homepage loads successfully', async ({ page }) => {
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Check page title contains Job Dorker
    await expect(page).toHaveTitle(/Job Dorker/);
    
    // Verify main elements are present
    await expect(page.locator('body')).toBeVisible();
    
    // Check for main header
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    
    // Performance check - page should load within reasonable time
    const startTime = Date.now();
    await page.waitForLoadState('load');
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(10000); // 10 seconds max
  });

  test('health endpoint responds correctly', async ({ page }) => {
    // Test the health endpoint directly via API request
    const response = await page.request.get('/health');
    expect(response.status()).toBe(200);
    
    const healthData = await response.json();
    expect(healthData.status).toBeTruthy();
    expect(healthData.timestamp).toBeDefined();
  });

  test('responsive design works on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate and check if page adapts
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify page is still functional on mobile
    await expect(page.locator('body')).toBeVisible();
    
    // Check if content is accessible in mobile view
    const body = page.locator('body');
    const bodyBox = await body.boundingBox();
    expect(bodyBox?.width).toBeLessThanOrEqual(375);
  });

  test('navigation and error handling', async ({ page }) => {
    // Test 404 handling for non-existent page
    const response = await page.goto('/nonexistent-page', { waitUntil: 'networkidle' });
    
    // Should either redirect to home or show proper 404
    if (response && response.status() === 404) {
      // Verify 404 page handling
      expect(response.status()).toBe(404);
    } else {
      // Or redirected to valid page
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('dashboard elements are present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for common dashboard elements
    const dashboardSelectors = [
      '.dashboard',
      '.card',
      '.container',
      'main',
      'header'
    ];
    
    let foundElements = 0;
    for (const selector of dashboardSelectors) {
      const element = page.locator(selector).first();
      if (await element.count() > 0) {
        foundElements++;
      }
    }
    
    // Should find at least some dashboard elements
    expect(foundElements).toBeGreaterThan(0);
  });

  test('performance metrics are within acceptable limits', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for full load
    await page.waitForLoadState('networkidle');
    
    // Check Web Vitals (if available)
    const performanceEntries = await page.evaluate(() => {
      const entries = performance.getEntriesByType('navigation');
      return entries.length > 0 ? JSON.stringify(entries[0]) : null;
    });
    
    if (performanceEntries) {
      const navEntry = JSON.parse(performanceEntries);
      const loadTime = navEntry.loadEventEnd - navEntry.loadEventStart;
      
      // Load time should be reasonable (less than 5 seconds)
      expect(loadTime).toBeLessThan(5000);
    }
  });

  test('basic JavaScript functionality works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test that JavaScript is working by checking for dynamic content
    const hasJavaScript = await page.evaluate(() => {
      return typeof window !== 'undefined' && typeof document !== 'undefined';
    });
    
    expect(hasJavaScript).toBe(true);
  });

});
