/**
 * Simple PWA Test for Chrome DevTools
 * Phase 7 Stage 6: PWA Testing
 */

import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

async function testPWAFeatures() {
  const options = new chrome.Options();
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--window-size=1920,1080');

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

  try {
    // Navigate to the enhanced dashboard
    await driver.get('http://localhost:3000/enhanced-dashboard.html');

    // Wait for page to load
    await driver.sleep(5000);

    // Check if service worker is registered
    const _swRegistered = await driver.executeScript(`
      return 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;
    `);

    // Check manifest
    const _manifestExists = await driver.executeScript(`
      return !!document.querySelector('link[rel="manifest"]');
    `);

    // Test manifest loading
    const _manifestLoaded = await driver.executeScript(`
      try {
        const response = await fetch('/manifest.json');
        return response.ok;
      } catch (e) {
        return false;
      }
    `);

    // Check PWA install capability
    const _installable = await driver.executeScript(`
      return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    `);

    // Check for PWA Manager
    const _pwaManagerExists = await driver.executeScript(`
      return typeof window.pwaManager !== 'undefined';
    `);

    // Test dashboard title
    const _dashboardTitle = await driver.getTitle();
    await driver.get('http://localhost:3000');
    await driver.sleep(2000);
    const _indexTitle = await driver.getTitle();

    // Test other pages
    const pages = [
      { url: 'http://localhost:3000/job-alerts.html', name: 'Job Alerts' },
      { url: 'http://localhost:3000/live-scraping.html', name: 'Live Scraping' },
    ];

    for (const page of pages) {
      try {
        await driver.get(page.url);
        await driver.sleep(1000);
        const _title = await driver.getTitle();
      } catch (_error) {}
    }
    await driver.executeScript(`
      // Simulate offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      });
      
      // Dispatch offline event
      window.dispatchEvent(new Event('offline'));
    `);

    await driver.sleep(1000);

    // Try to load a cached page
    await driver.get('http://localhost:3000');
    await driver.sleep(2000);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await driver.quit();
  }
}

// Run the test
testPWAFeatures()
  .then(() => {})
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
