/**
 * Comprehensive Selenium Tests for Job Dorker Web Application
 * Phase 7 Stage 4: Advanced UI Features & UX
 */

import { Builder, By, Key, until, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import firefox from 'selenium-webdriver/firefox.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Comprehensive Selenium Tests for Job Search Web Application
 * Tests all major features and user workflows
 */

import assert from 'assert';

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
  browsers: ['chrome', 'firefox'],
  headless: process.env.CI === 'true',
  screenshotDir: path.join(__dirname, 'screenshots'),
};

// Ensure screenshot directory exists
if (!fs.existsSync(TEST_CONFIG.screenshotDir)) {
  fs.mkdirSync(TEST_CONFIG.screenshotDir, { recursive: true });
}

class WebAppSeleniumTests {
  constructor() {
    this.drivers = new Map();
    this.testResults = [];
  }

  /**
   * Setup browser drivers
   */
  async setupDrivers() {
    for (const browser of TEST_CONFIG.browsers) {
      let driver;

      if (browser === 'chrome') {
        const options = new chrome.Options();
        if (TEST_CONFIG.headless) {
          options.addArguments('--headless');
        }
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--window-size=1920,1080');

        driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
      } else if (browser === 'firefox') {
        const options = new firefox.Options();
        if (TEST_CONFIG.headless) {
          options.headless();
        }
        options.setPreference('dom.webnotifications.enabled', false);

        driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).build();
      }

      if (driver) {
        await driver.manage().setTimeouts({ implicit: TEST_CONFIG.timeout });
        this.drivers.set(browser, driver);
        console.log(`✅ ${browser} driver initialized`);
      }
    }
  }

  /**
   * Cleanup all drivers
   */
  async cleanup() {
    for (const [browser, driver] of this.drivers) {
      try {
        await driver.quit();
        console.log(`✅ ${browser} driver closed`);
      } catch (error) {
        console.error(`❌ Error closing ${browser} driver:`, error.message);
      }
    }
    this.drivers.clear();
  }

  /**
   * Take screenshot on failure
   */
  async takeScreenshot(driver, testName, browser) {
    try {
      const screenshot = await driver.takeScreenshot();
      const filename = `${testName}_${browser}_${Date.now()}.png`;
      const filepath = path.join(TEST_CONFIG.screenshotDir, filename);
      fs.writeFileSync(filepath, screenshot, 'base64');
      console.log(`📸 Screenshot saved: ${filename}`);
      return filepath;
    } catch (error) {
      console.error('❌ Failed to take screenshot:', error.message);
      return null;
    }
  }

  /**
   * Wait for element with custom timeout
   */
  async waitForElement(driver, locator, timeout = TEST_CONFIG.timeout) {
    return await driver.wait(until.elementLocated(locator), timeout);
  }

  /**
   * Wait for element to be visible
   */
  async waitForVisible(driver, locator, timeout = TEST_CONFIG.timeout) {
    const element = await this.waitForElement(driver, locator, timeout);
    await driver.wait(until.elementIsVisible(element), timeout);
    return element;
  }

  /**
   * Test: Dashboard Loading and Navigation
   */
  async testDashboardLoading(driver, browser) {
    console.log(`🧪 Testing dashboard loading (${browser})`);

    try {
      // Navigate to dashboard
      await driver.get(`${TEST_CONFIG.baseUrl}/dashboard`);

      // Wait for page title
      await driver.wait(until.titleContains('Job Search Dashboard'), 10000);

      // Check main navigation elements
      const navElements = [
        By.css('.nav-item[data-page="search"]'),
        By.css('.nav-item[data-page="dashboard"]'),
        By.css('.nav-item[data-page="alerts"]'),
        By.css('.nav-item[data-page="export"]'),
      ];

      for (const selector of navElements) {
        await this.waitForVisible(driver, selector);
      }

      // Check dashboard widgets
      const widgets = [
        By.id('total-jobs-widget'),
        By.id('salary-chart-widget'),
        By.id('location-chart-widget'),
        By.id('recent-searches-widget'),
      ];

      for (const widget of widgets) {
        await this.waitForVisible(driver, widget);
      }

      // Test navigation functionality
      const searchNav = await driver.findElement(By.css('.nav-item[data-page="search"]'));
      await searchNav.click();

      await driver.wait(until.urlContains('/search'), 5000);

      console.log(`✅ Dashboard loading test passed (${browser})`);
      return { success: true, browser, test: 'dashboard-loading' };
    } catch (error) {
      console.error(`❌ Dashboard loading test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'dashboard-loading-failed', browser);
      return { success: false, browser, test: 'dashboard-loading', error: error.message };
    }
  }

  /**
   * Test: Advanced Job Search Interface
   */
  async testAdvancedJobSearch(driver, browser) {
    console.log(`🧪 Testing advanced job search (${browser})`);

    try {
      // Navigate to search page
      await driver.get(`${TEST_CONFIG.baseUrl}/search`);

      // Wait for search form
      await this.waitForVisible(driver, By.id('job-search-form'));

      // Test basic search
      const keywordInput = await driver.findElement(By.id('search-keywords'));
      await keywordInput.clear();
      await keywordInput.sendKeys('software engineer');

      const locationInput = await driver.findElement(By.id('search-location'));
      await locationInput.clear();
      await locationInput.sendKeys('San Francisco');

      // Test advanced filters
      const salaryMinInput = await driver.findElement(By.id('salary-min'));
      await salaryMinInput.clear();
      await salaryMinInput.sendKeys('100000');

      const experienceSelect = await driver.findElement(By.id('experience-level'));
      await experienceSelect.click();
      const seniorOption = await driver.findElement(By.css('option[value="senior"]'));
      await seniorOption.click();

      // Test job type filters
      const remoteCheckbox = await driver.findElement(By.id('job-type-remote'));
      if (!(await remoteCheckbox.isSelected())) {
        await remoteCheckbox.click();
      }

      // Submit search
      const searchButton = await driver.findElement(By.css('button[type="submit"]'));
      await searchButton.click();

      // Wait for results
      await this.waitForVisible(driver, By.id('search-results'), 15000);

      // Verify results container
      const resultsContainer = await driver.findElement(By.id('search-results'));
      const resultItems = await resultsContainer.findElements(By.css('.job-result-item'));

      assert(resultItems.length > 0, 'No search results found');

      // Test result item details
      if (resultItems.length > 0) {
        const firstResult = resultItems[0];
        await this.waitForVisible(driver, By.css('.job-title'), 5000);
        await this.waitForVisible(driver, By.css('.company-name'), 5000);
        await this.waitForVisible(driver, By.css('.job-location'), 5000);
      }

      // Test pagination if available
      try {
        const nextButton = await driver.findElement(By.css('.pagination .next'));
        if (await nextButton.isEnabled()) {
          await nextButton.click();
          await driver.sleep(2000);
        }
      } catch (error) {
        // Pagination might not be available
        console.log('Pagination not found or not enabled');
      }

      console.log(`✅ Advanced job search test passed (${browser})`);
      return { success: true, browser, test: 'advanced-job-search' };
    } catch (error) {
      console.error(`❌ Advanced job search test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'advanced-search-failed', browser);
      return { success: false, browser, test: 'advanced-job-search', error: error.message };
    }
  }

  /**
   * Test: Live Scraping Dashboard
   */
  async testLiveScrapingDashboard(driver, browser) {
    console.log(`🧪 Testing live scraping dashboard (${browser})`);

    try {
      // Navigate to live scraping page
      await driver.get(`${TEST_CONFIG.baseUrl}/live-scraping`);

      // Wait for main components
      await this.waitForVisible(driver, By.id('scraping-controls'));
      await this.waitForVisible(driver, By.id('scraping-status'));
      await this.waitForVisible(driver, By.id('performance-charts'));

      // Test scraping controls
      const startButton = await driver.findElement(By.id('start-scraping-btn'));
      await startButton.click();

      // Wait for status updates
      await driver.sleep(3000);

      // Check status indicators
      const statusIndicators = await driver.findElements(By.css('.status-indicator'));
      assert(statusIndicators.length > 0, 'No status indicators found');

      // Test chart visibility
      const charts = [
        By.id('success-rate-chart'),
        By.id('response-time-chart'),
        By.id('job-count-chart'),
      ];

      for (const chartSelector of charts) {
        await this.waitForVisible(driver, chartSelector);
      }

      // Test error log
      await this.waitForVisible(driver, By.id('error-log'));

      // Test stop scraping
      const stopButton = await driver.findElement(By.id('stop-scraping-btn'));
      await stopButton.click();

      console.log(`✅ Live scraping dashboard test passed (${browser})`);
      return { success: true, browser, test: 'live-scraping-dashboard' };
    } catch (error) {
      console.error(`❌ Live scraping dashboard test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'live-scraping-failed', browser);
      return { success: false, browser, test: 'live-scraping-dashboard', error: error.message };
    }
  }

  /**
   * Test: Job Alert System
   */
  async testJobAlertSystem(driver, browser) {
    console.log(`🧪 Testing job alert system (${browser})`);

    try {
      // Navigate to alerts page
      await driver.get(`${TEST_CONFIG.baseUrl}/alerts`);

      // Wait for alert management interface
      await this.waitForVisible(driver, By.id('alert-management'));

      // Test create new alert
      const createAlertButton = await driver.findElement(By.id('create-alert-btn'));
      await createAlertButton.click();

      // Wait for alert form modal
      await this.waitForVisible(driver, By.id('alert-form-modal'));

      // Fill in alert details
      const alertNameInput = await driver.findElement(By.id('alert-name'));
      await alertNameInput.sendKeys('Senior Developer Alert');

      const alertKeywordsInput = await driver.findElement(By.id('alert-keywords'));
      await alertKeywordsInput.sendKeys('senior developer, full stack');

      const alertLocationInput = await driver.findElement(By.id('alert-location'));
      await alertLocationInput.sendKeys('Remote');

      const alertSalaryInput = await driver.findElement(By.id('alert-salary-min'));
      await alertSalaryInput.sendKeys('120000');

      // Test notification preferences
      const emailNotifications = await driver.findElement(By.id('alert-email-notifications'));
      if (!(await emailNotifications.isSelected())) {
        await emailNotifications.click();
      }

      const browserNotifications = await driver.findElement(By.id('alert-browser-notifications'));
      if (!(await browserNotifications.isSelected())) {
        await browserNotifications.click();
      }

      // Save alert
      const saveAlertButton = await driver.findElement(By.id('save-alert-btn'));
      await saveAlertButton.click();

      // Wait for modal to close and alert to appear in list
      await driver.wait(
        until.stalenessOf(await driver.findElement(By.id('alert-form-modal'))),
        5000,
      );
      await this.waitForVisible(driver, By.css('.alert-item'));

      // Test alert list functionality
      const alertItems = await driver.findElements(By.css('.alert-item'));
      assert(alertItems.length > 0, 'No alert items found');

      // Test edit alert
      const editButton = await alertItems[0].findElement(By.css('.edit-alert-btn'));
      await editButton.click();

      await this.waitForVisible(driver, By.id('alert-form-modal'));

      // Cancel edit
      const cancelButton = await driver.findElement(By.id('cancel-alert-btn'));
      await cancelButton.click();

      // Test alert history
      await this.waitForVisible(driver, By.id('alert-history'));

      console.log(`✅ Job alert system test passed (${browser})`);
      return { success: true, browser, test: 'job-alert-system' };
    } catch (error) {
      console.error(`❌ Job alert system test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'job-alerts-failed', browser);
      return { success: false, browser, test: 'job-alert-system', error: error.message };
    }
  }

  /**
   * Test: Job Comparison Tool
   */
  async testJobComparisonTool(driver, browser) {
    console.log(`🧪 Testing job comparison tool (${browser})`);

    try {
      // Navigate to comparison page
      await driver.get(`${TEST_CONFIG.baseUrl}/comparison`);

      // Wait for comparison interface
      await this.waitForVisible(driver, By.id('job-comparison-container'));

      // Test add jobs to comparison
      const addJobButton = await driver.findElement(By.id('add-job-btn'));
      await addJobButton.click();

      // Wait for job selection modal
      await this.waitForVisible(driver, By.id('job-selection-modal'));

      // Select some jobs (mock data)
      const jobCheckboxes = await driver.findElements(By.css('.job-checkbox'));
      if (jobCheckboxes.length >= 2) {
        await jobCheckboxes[0].click();
        await jobCheckboxes[1].click();
      }

      // Confirm selection
      const confirmSelectionButton = await driver.findElement(By.id('confirm-selection-btn'));
      await confirmSelectionButton.click();

      // Wait for comparison view
      await driver.wait(
        until.stalenessOf(await driver.findElement(By.id('job-selection-modal'))),
        5000,
      );
      await this.waitForVisible(driver, By.css('.comparison-card'));

      // Test comparison features
      const comparisonCards = await driver.findElements(By.css('.comparison-card'));
      assert(comparisonCards.length >= 2, 'Not enough jobs in comparison');

      // Test salary comparison chart
      await this.waitForVisible(driver, By.id('salary-comparison-chart'));

      // Test requirements analysis
      await this.waitForVisible(driver, By.id('requirements-analysis'));

      // Test company comparison
      await this.waitForVisible(driver, By.id('company-comparison'));

      // Test export comparison
      const exportButton = await driver.findElement(By.id('export-comparison-btn'));
      await exportButton.click();

      // Wait for export options
      await this.waitForVisible(driver, By.id('export-options'));

      // Test PDF export
      const pdfExportButton = await driver.findElement(By.css('button[data-format="pdf"]'));
      await pdfExportButton.click();

      // Wait for export to process
      await driver.sleep(2000);

      console.log(`✅ Job comparison tool test passed (${browser})`);
      return { success: true, browser, test: 'job-comparison-tool' };
    } catch (error) {
      console.error(`❌ Job comparison tool test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'job-comparison-failed', browser);
      return { success: false, browser, test: 'job-comparison-tool', error: error.message };
    }
  }

  /**
   * Test: Export & Sharing Features
   */
  async testExportSharingFeatures(driver, browser) {
    console.log(`🧪 Testing export & sharing features (${browser})`);

    try {
      // Navigate to export page
      await driver.get(`${TEST_CONFIG.baseUrl}/export`);

      // Wait for export interface
      await this.waitForVisible(driver, By.id('export-section'));

      // Test quick export buttons
      const quickExportButtons = [
        By.css('button[data-format="csv"]'),
        By.css('button[data-format="json"]'),
        By.css('button[data-format="pdf"]'),
        By.css('button[data-format="xlsx"]'),
      ];

      for (const buttonSelector of quickExportButtons) {
        const button = await driver.findElement(buttonSelector);
        await button.click();
        await driver.sleep(1000); // Wait for export to process
      }

      // Test custom export form
      await this.waitForVisible(driver, By.id('custom-export-form'));

      const filenameInput = await driver.findElement(By.id('export-filename'));
      await filenameInput.clear();
      await filenameInput.sendKeys('custom-job-export');

      // Select fields to include
      const fieldCheckboxes = await driver.findElements(By.css('input[name="fields"]'));
      for (let i = 0; i < Math.min(3, fieldCheckboxes.length); i++) {
        if (!(await fieldCheckboxes[i].isSelected())) {
          await fieldCheckboxes[i].click();
        }
      }

      // Set date range
      const dateFromInput = await driver.findElement(By.id('date-from'));
      await dateFromInput.sendKeys('2025-01-01');

      const dateToInput = await driver.findElement(By.id('date-to'));
      await dateToInput.sendKeys('2025-07-22');

      // Submit custom export
      const createExportButton = await driver.findElement(By.css('button[type="submit"]'));
      await createExportButton.click();

      // Wait for export queue
      await this.waitForVisible(driver, By.id('export-queue'));

      // Test sharing features
      const sharingTab = await driver.findElement(By.css('button[data-tab="sharing"]'));
      await sharingTab.click();

      await this.waitForVisible(driver, By.id('sharing-section'));

      // Test generate link
      const generateLinkButton = await driver.findElement(
        By.css('button[onclick*="generateShareLink"]'),
      );
      await generateLinkButton.click();

      // Wait for share modal
      await this.waitForVisible(driver, By.id('share-link-modal'));

      // Check generated URL
      await this.waitForVisible(driver, By.id('generated-url'));

      // Test privacy settings
      const privacySelect = await driver.findElement(By.id('link-privacy'));
      await privacySelect.click();

      const passwordOption = await driver.findElement(By.css('option[value="password"]'));
      await passwordOption.click();

      // Check password field appears
      await this.waitForVisible(driver, By.id('password-field'));

      // Close modal
      const closeButton = await driver.findElement(By.css('.modal-close'));
      await closeButton.click();

      // Test templates tab
      const templatesTab = await driver.findElement(By.css('button[data-tab="templates"]'));
      await templatesTab.click();

      await this.waitForVisible(driver, By.id('templates-section'));

      // Test create template
      const createTemplateButton = await driver.findElement(
        By.css('button[onclick*="showCreateTemplateDialog"]'),
      );
      await createTemplateButton.click();

      await this.waitForVisible(driver, By.id('create-template-modal'));

      // Fill template form
      const templateNameInput = await driver.findElement(By.id('template-name'));
      await templateNameInput.sendKeys('My Custom Template');

      const templateDescInput = await driver.findElement(By.id('template-description'));
      await templateDescInput.sendKeys('A custom template for exporting job data');

      // Save template
      const saveTemplateButton = await driver.findElement(
        By.css('button[onclick*="saveTemplate"]'),
      );
      await saveTemplateButton.click();

      // Test collections tab
      const collectionsTab = await driver.findElement(By.css('button[data-tab="collections"]'));
      await collectionsTab.click();

      await this.waitForVisible(driver, By.id('collections-section'));

      console.log(`✅ Export & sharing features test passed (${browser})`);
      return { success: true, browser, test: 'export-sharing-features' };
    } catch (error) {
      console.error(`❌ Export & sharing features test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'export-sharing-failed', browser);
      return { success: false, browser, test: 'export-sharing-features', error: error.message };
    }
  }

  /**
   * Test: Real-time WebSocket Functionality
   */
  async testWebSocketFunctionality(driver, browser) {
    console.log(`🧪 Testing WebSocket functionality (${browser})`);

    try {
      // Navigate to dashboard
      await driver.get(`${TEST_CONFIG.baseUrl}/dashboard`);

      // Wait for WebSocket connection indicator
      await this.waitForVisible(driver, By.id('connection-status'));

      // Check connection status
      const connectionStatus = await driver.findElement(By.id('connection-status'));
      const statusText = await connectionStatus.getText();
      assert(
        statusText.includes('Connected') || statusText.includes('Online'),
        'WebSocket not connected',
      );

      // Test real-time job updates
      await driver.executeScript(`
                // Simulate WebSocket message
                if (window.jobSearchApp && window.jobSearchApp.handleWebSocketMessage) {
                    window.jobSearchApp.handleWebSocketMessage({
                        type: 'job_found',
                        data: {
                            id: 'test-job-' + Date.now(),
                            title: 'Test Software Engineer',
                            company: 'Test Company',
                            location: 'Test Location',
                            salary: '$100,000'
                        }
                    });
                }
            `);

      // Wait for UI update
      await driver.sleep(2000);

      // Test real-time statistics update
      await driver.executeScript(`
                if (window.jobSearchApp && window.jobSearchApp.handleWebSocketMessage) {
                    window.jobSearchApp.handleWebSocketMessage({
                        type: 'statistics_update',
                        data: {
                            totalJobs: 1500,
                            newJobs: 25,
                            averageSalary: 95000
                        }
                    });
                }
            `);

      await driver.sleep(1000);

      // Test scraping progress updates
      await driver.executeScript(`
                if (window.jobSearchApp && window.jobSearchApp.handleWebSocketMessage) {
                    window.jobSearchApp.handleWebSocketMessage({
                        type: 'scraping_progress',
                        data: {
                            site: 'linkedin',
                            progress: 75,
                            status: 'processing',
                            jobsFound: 45
                        }
                    });
                }
            `);

      await driver.sleep(1000);

      console.log(`✅ WebSocket functionality test passed (${browser})`);
      return { success: true, browser, test: 'websocket-functionality' };
    } catch (error) {
      console.error(`❌ WebSocket functionality test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'websocket-failed', browser);
      return { success: false, browser, test: 'websocket-functionality', error: error.message };
    }
  }

  /**
   * Test: Mobile Responsiveness
   */
  async testMobileResponsiveness(driver, browser) {
    console.log(`🧪 Testing mobile responsiveness (${browser})`);

    try {
      // Set mobile viewport
      await driver.manage().window().setRect({ width: 375, height: 667 });

      // Navigate to dashboard
      await driver.get(`${TEST_CONFIG.baseUrl}/dashboard`);

      // Check mobile navigation
      await this.waitForVisible(driver, By.id('mobile-nav-toggle'));

      const mobileNavToggle = await driver.findElement(By.id('mobile-nav-toggle'));
      await mobileNavToggle.click();

      // Check mobile menu
      await this.waitForVisible(driver, By.id('mobile-nav-menu'));

      // Test mobile search
      await driver.get(`${TEST_CONFIG.baseUrl}/search`);

      // Check search form responsiveness
      await this.waitForVisible(driver, By.id('job-search-form'));

      const searchForm = await driver.findElement(By.id('job-search-form'));
      const formWidth = await searchForm.getRect();
      assert(formWidth.width <= 375, 'Search form not responsive');

      // Test mobile job results
      const keywordInput = await driver.findElement(By.id('search-keywords'));
      await keywordInput.sendKeys('engineer');

      const searchButton = await driver.findElement(By.css('button[type="submit"]'));
      await searchButton.click();

      // Wait for results and check mobile layout
      await this.waitForVisible(driver, By.id('search-results'));

      // Check if results are stacked vertically on mobile
      const resultItems = await driver.findElements(By.css('.job-result-item'));
      if (resultItems.length >= 2) {
        const firstItemRect = await resultItems[0].getRect();
        const secondItemRect = await resultItems[1].getRect();

        // On mobile, items should be stacked (second item below first)
        assert(secondItemRect.y > firstItemRect.y, 'Job results not properly stacked on mobile');
      }

      // Reset to desktop viewport
      await driver.manage().window().setRect({ width: 1920, height: 1080 });

      console.log(`✅ Mobile responsiveness test passed (${browser})`);
      return { success: true, browser, test: 'mobile-responsiveness' };
    } catch (error) {
      console.error(`❌ Mobile responsiveness test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'mobile-responsiveness-failed', browser);
      return { success: false, browser, test: 'mobile-responsiveness', error: error.message };
    }
  }

  /**
   * Test: Performance and Load Times
   */
  async testPerformanceMetrics(driver, browser) {
    console.log(`🧪 Testing performance metrics (${browser})`);

    try {
      // Navigate to dashboard and measure load time
      const startTime = Date.now();
      await driver.get(`${TEST_CONFIG.baseUrl}/dashboard`);
      await this.waitForVisible(driver, By.id('total-jobs-widget'));
      const loadTime = Date.now() - startTime;

      console.log(`📊 Dashboard load time: ${loadTime}ms`);
      assert(loadTime < 5000, `Dashboard load time too slow: ${loadTime}ms`);

      // Test navigation performance
      const navStartTime = Date.now();
      const searchNav = await driver.findElement(By.css('.nav-item[data-page="search"]'));
      await searchNav.click();
      await this.waitForVisible(driver, By.id('job-search-form'));
      const navTime = Date.now() - navStartTime;

      console.log(`📊 Navigation time: ${navTime}ms`);
      assert(navTime < 2000, `Navigation too slow: ${navTime}ms`);

      // Test search performance
      const searchStartTime = Date.now();
      const keywordInput = await driver.findElement(By.id('search-keywords'));
      await keywordInput.sendKeys('software engineer');

      const searchButton = await driver.findElement(By.css('button[type="submit"]'));
      await searchButton.click();

      await this.waitForVisible(driver, By.id('search-results'), 15000);
      const searchTime = Date.now() - searchStartTime;

      console.log(`📊 Search time: ${searchTime}ms`);
      assert(searchTime < 10000, `Search too slow: ${searchTime}ms`);

      // Check memory usage (basic check)
      const memoryInfo = await driver.executeScript('return window.performance.memory');
      if (memoryInfo) {
        console.log(`📊 Memory usage: ${Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024)}MB`);
      }

      console.log(`✅ Performance metrics test passed (${browser})`);
      return {
        success: true,
        browser,
        test: 'performance-metrics',
        metrics: {
          dashboardLoadTime: loadTime,
          navigationTime: navTime,
          searchTime: searchTime,
        },
      };
    } catch (error) {
      console.error(`❌ Performance metrics test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'performance-failed', browser);
      return { success: false, browser, test: 'performance-metrics', error: error.message };
    }
  }

  /**
   * Run all tests for a specific browser
   */
  async runTestsForBrowser(browser) {
    const driver = this.drivers.get(browser);
    if (!driver) {
      console.error(`❌ No driver found for ${browser}`);
      return;
    }

    console.log(`\n🚀 Running tests for ${browser}`);

    const tests = [
      () => this.testDashboardLoading(driver, browser),
      () => this.testAdvancedJobSearch(driver, browser),
      () => this.testLiveScrapingDashboard(driver, browser),
      () => this.testJobAlertSystem(driver, browser),
      () => this.testJobComparisonTool(driver, browser),
      () => this.testExportSharingFeatures(driver, browser),
      () => this.testWebSocketFunctionality(driver, browser),
      () => this.testMobileResponsiveness(driver, browser),
      () => this.testPerformanceMetrics(driver, browser),
    ];

    for (const test of tests) {
      try {
        const result = await test();
        this.testResults.push(result);
      } catch (error) {
        console.error(`❌ Test execution error:`, error.message);
        this.testResults.push({
          success: false,
          browser,
          test: 'unknown',
          error: error.message,
        });
      }
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting comprehensive Selenium tests for Job Search Web Application');
    console.log(
      `📋 Testing ${TEST_CONFIG.browsers.length} browsers with ${TEST_CONFIG.browsers.join(', ')}`,
    );

    try {
      await this.setupDrivers();

      for (const browser of TEST_CONFIG.browsers) {
        await this.runTestsForBrowser(browser);
      }

      await this.generateTestReport();
    } catch (error) {
      console.error('❌ Test suite execution error:', error.message);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Generate test report
   */
  async generateTestReport() {
    console.log('\n📊 Test Results Summary');
    console.log('='.repeat(50));

    const summary = {
      total: this.testResults.length,
      passed: this.testResults.filter((r) => r.success).length,
      failed: this.testResults.filter((r) => !r.success).length,
      byBrowser: {},
      byTest: {},
    };

    // Group by browser
    for (const browser of TEST_CONFIG.browsers) {
      const browserResults = this.testResults.filter((r) => r.browser === browser);
      summary.byBrowser[browser] = {
        total: browserResults.length,
        passed: browserResults.filter((r) => r.success).length,
        failed: browserResults.filter((r) => !r.success).length,
      };
    }

    // Group by test
    const testNames = [...new Set(this.testResults.map((r) => r.test))];
    for (const testName of testNames) {
      const testResults = this.testResults.filter((r) => r.test === testName);
      summary.byTest[testName] = {
        total: testResults.length,
        passed: testResults.filter((r) => r.success).length,
        failed: testResults.filter((r) => !r.success).length,
      };
    }

    // Print summary
    console.log(`Total Tests: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`📈 Success Rate: ${((summary.passed / summary.total) * 100).toFixed(1)}%`);

    console.log('\n📊 Results by Browser:');
    for (const [browser, results] of Object.entries(summary.byBrowser)) {
      console.log(
        `  ${browser}: ${results.passed}/${results.total} passed (${((results.passed / results.total) * 100).toFixed(1)}%)`,
      );
    }

    console.log('\n📊 Results by Test:');
    for (const [testName, results] of Object.entries(summary.byTest)) {
      const status = results.failed === 0 ? '✅' : '❌';
      console.log(`  ${status} ${testName}: ${results.passed}/${results.total} passed`);
    }

    // Print failed tests details
    const failedTests = this.testResults.filter((r) => !r.success);
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests Details:');
      for (const failed of failedTests) {
        console.log(`  - ${failed.test} (${failed.browser}): ${failed.error}`);
      }
    }

    // Save detailed report
    const reportPath = path.join(__dirname, 'selenium-test-report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          summary,
          results: this.testResults,
        },
        null,
        2,
      ),
    );

    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Export for use in other test files
module.exports = WebAppSeleniumTests;

// Run tests if called directly
if (require.main === module) {
  (async () => {
    const testSuite = new WebAppSeleniumTests();
    await testSuite.runAllTests();

    // Exit with proper code
    const failedTests = testSuite.testResults.filter((r) => !r.success);
    process.exit(failedTests.length > 0 ? 1 : 0);
  })();
}
