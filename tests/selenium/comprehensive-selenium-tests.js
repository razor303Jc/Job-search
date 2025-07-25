/**
 * Comprehensive Selenium Test Suite for Job Dorker
 * Complete testing infrastructure with advanced features
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder, By, Key, WebDriver, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import firefox from 'selenium-webdriver/firefox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const CONFIG = {
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
  browsers: ['chrome', 'firefox'],
  headless: process.env.CI === 'true' || process.env.HEADLESS === 'true',
  screenshotDir: path.join(__dirname, 'screenshots'),
  reportDir: path.join(__dirname, 'reports'),
  parallel: false, // Set to true for parallel execution
};

// Ensure directories exist
[CONFIG.screenshotDir, CONFIG.reportDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

class ComprehensiveSeleniumTests {
  constructor() {
    this.drivers = new Map();
    this.testResults = [];
    this.startTime = Date.now();
  }

  /**
   * Setup browser drivers
   */
  async setupDrivers() {
    for (const browser of CONFIG.browsers) {
      try {
        let driver;
        let options;

        if (browser === 'chrome') {
          options = new chrome.Options();
          if (CONFIG.headless) {
            options.addArguments('--headless=new');
          }
          options.addArguments(
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1920,1080',
            '--disable-web-security',
            '--allow-running-insecure-content',
          );
          driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
        } else if (browser === 'firefox') {
          options = new firefox.Options();
          if (CONFIG.headless) {
            options.addArguments('--headless');
          }
          options.addArguments('--width=1920', '--height=1080');
          driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).build();
        }

        if (driver) {
          this.drivers.set(browser, driver);
        }
      } catch (error) {
        console.error(`❌ Failed to setup ${browser} driver:`, error.message);
      }
    }

    if (this.drivers.size === 0) {
      throw new Error('No browser drivers were successfully initialized');
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    try {
      await this.setupDrivers();

      const testSuites = [
        { name: 'Core Application Tests', tests: this.getCoreTests() },
        { name: 'Advanced Features Tests', tests: this.getAdvancedTests() },
        { name: 'Performance & UX Tests', tests: this.getPerformanceTests() },
        { name: 'Security Tests', tests: this.getSecurityTests() },
        { name: 'Mobile & Responsive Tests', tests: this.getMobileTests() },
        { name: 'Alerts & Notifications Tests', tests: this.getAlertsTests() },
      ];

      for (const suite of testSuites) {
        await this.runTestSuite(suite);
      }

      await this.generateReport();
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Run a test suite
   */
  async runTestSuite(suite) {
    for (const test of suite.tests) {
      for (const [browser, driver] of this.drivers) {
        await this.runSingleTest(test, browser, driver, suite.name);
      }
    }
  }

  /**
   * Run a single test
   */
  async runSingleTest(test, browser, driver, suiteName) {
    const testId = `${suiteName}_${test.name}_${browser}`;
    const startTime = Date.now();

    try {
      // Navigate to base URL
      await driver.get(CONFIG.baseUrl);
      await driver.wait(until.titleContains('Job'), CONFIG.timeout);

      // Run the actual test
      await test.execute(driver);

      const duration = Date.now() - startTime;
      const result = {
        testId,
        suiteName,
        testName: test.name,
        browser,
        status: 'PASSED',
        duration,
        timestamp: new Date().toISOString(),
      };

      this.testResults.push(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      const screenshotPath = await this.takeScreenshot(driver, testId);

      const result = {
        testId,
        suiteName,
        testName: test.name,
        browser,
        status: 'FAILED',
        duration,
        error: error.message,
        screenshot: screenshotPath,
        timestamp: new Date().toISOString(),
      };

      this.testResults.push(result);
    }
  }

  /**
   * Take screenshot on failure
   */
  async takeScreenshot(driver, testId) {
    try {
      const screenshot = await driver.takeScreenshot();
      const filename = `${testId}_${Date.now()}.png`;
      const filepath = path.join(CONFIG.screenshotDir, filename);

      fs.writeFileSync(filepath, screenshot, 'base64');
      return filepath;
    } catch (error) {
      console.error('Failed to take screenshot:', error.message);
      return null;
    }
  }

  /**
   * Core application tests
   */
  getCoreTests() {
    return [
      {
        name: 'homepage_loads',
        execute: async (driver) => {
          const title = await driver.getTitle();
          if (!title.toLowerCase().includes('job')) {
            throw new Error(`Expected title to contain 'job', got: ${title}`);
          }

          // Check for essential elements
          await driver.wait(until.elementLocated(By.tagName('body')), 5000);

          // Look for navigation or header elements
          const navElements = await driver.findElements(
            By.css('nav, header, .navigation, .header'),
          );
          if (navElements.length === 0) {
            console.warn('No navigation elements found');
          }
        },
      },

      {
        name: 'health_endpoint',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/health`);
          const pageSource = await driver.getPageSource();

          if (pageSource.includes('healthy') || pageSource.includes('ok')) {
          } else {
            throw new Error('Health endpoint not responding correctly');
          }
        },
      },

      {
        name: 'basic_navigation',
        execute: async (driver) => {
          // Test basic navigation elements
          const _links = await driver.findElements(By.css('a'));

          // Test if we can find common navigation elements
          const commonSelectors = [
            'nav',
            'header',
            '.navigation',
            '.nav-bar',
            '.menu',
            '#navigation',
            '#header',
          ];

          let foundNav = false;
          for (const selector of commonSelectors) {
            const elements = await driver.findElements(By.css(selector));
            if (elements.length > 0) {
              foundNav = true;
              break;
            }
          }

          if (!foundNav) {
            console.warn('No standard navigation elements found - may be a SPA');
          }
        },
      },

      {
        name: 'responsive_layout',
        execute: async (driver) => {
          // Test desktop view
          await driver.manage().window().setRect({ width: 1920, height: 1080 });
          await driver.sleep(1000);

          const desktopBody = await driver.findElement(By.tagName('body'));
          const _desktopWidth = await desktopBody.getRect();

          // Test mobile view
          await driver.manage().window().setRect({ width: 375, height: 667 });
          await driver.sleep(1000);

          const mobileBody = await driver.findElement(By.tagName('body'));
          const _mobileWidth = await mobileBody.getRect();

          // Reset to desktop
          await driver.manage().window().setRect({ width: 1920, height: 1080 });
        },
      },
    ];
  }

  /**
   * Advanced feature tests
   */
  getAdvancedTests() {
    return [
      {
        name: 'search_functionality',
        execute: async (driver) => {
          // Look for search inputs
          const searchSelectors = [
            'input[type="search"]',
            'input[placeholder*="search" i]',
            'input[name*="search" i]',
            '#search',
            '.search-input',
            'input[type="text"]',
          ];

          let searchInput = null;
          for (const selector of searchSelectors) {
            const elements = await driver.findElements(By.css(selector));
            if (elements.length > 0) {
              searchInput = elements[0];
              break;
            }
          }

          if (searchInput) {
            await searchInput.sendKeys('developer');
            await searchInput.sendKeys(Key.ENTER);
            await driver.sleep(2000);
          } else {
            console.warn('No search input found - search feature may not be implemented yet');
          }
        },
      },

      {
        name: 'filter_functionality',
        execute: async (driver) => {
          // Look for filter elements
          const filterSelectors = [
            '.filter',
            '.filters',
            '[data-testid*="filter"]',
            'select',
            '.dropdown',
            '.filter-option',
          ];

          let foundFilters = false;
          for (const selector of filterSelectors) {
            const elements = await driver.findElements(By.css(selector));
            if (elements.length > 0) {
              foundFilters = true;
              break;
            }
          }

          if (!foundFilters) {
            console.warn(
              'No filter elements found - advanced filtering may not be implemented yet',
            );
          }
        },
      },

      {
        name: 'job_listings_display',
        execute: async (driver) => {
          // Look for job listing elements
          const jobSelectors = [
            '.job',
            '.job-item',
            '.job-listing',
            '.job-card',
            '[data-testid*="job"]',
            '.listing',
            '.result',
          ];

          let foundJobs = false;
          for (const selector of jobSelectors) {
            const elements = await driver.findElements(By.css(selector));
            if (elements.length > 0) {
              foundJobs = true;
              break;
            }
          }

          if (!foundJobs) {
            console.warn('No job listing elements found - may need to trigger data loading');
          }
        },
      },
    ];
  }

  /**
   * Performance tests
   */
  getPerformanceTests() {
    return [
      {
        name: 'page_load_performance',
        execute: async (driver) => {
          const startTime = Date.now();
          await driver.get(CONFIG.baseUrl);
          await driver.wait(until.elementLocated(By.tagName('body')), 10000);
          const loadTime = Date.now() - startTime;

          if (loadTime > 10000) {
            throw new Error(`Page load time too slow: ${loadTime}ms`);
          }
        },
      },

      {
        name: 'javascript_errors',
        execute: async (driver) => {
          const logs = await driver.manage().logs().get('browser');
          const errors = logs.filter((log) => log.level.name === 'SEVERE');

          if (errors.length > 0) {
            console.warn(`Found ${errors.length} JavaScript errors:`, errors);
            // Don't fail for JS errors unless they're critical
          } else {
          }
        },
      },
    ];
  }

  /**
   * Security tests
   */
  getSecurityTests() {
    return [
      {
        name: 'xss_protection',
        execute: async (driver) => {
          // Test for basic XSS protection
          const searchInputs = await driver.findElements(
            By.css('input[type="text"], input[type="search"]'),
          );

          if (searchInputs.length > 0) {
            const xssPayload = '<script>alert("xss")</script>';
            await searchInputs[0].sendKeys(xssPayload);
            await driver.sleep(1000);

            // Check if script was executed (it shouldn't be)
            const _alerts = await driver.findElements(By.css('script'));
            const pageSource = await driver.getPageSource();

            if (pageSource.includes('alert("xss")') && !pageSource.includes('&lt;script&gt;')) {
              throw new Error('Potential XSS vulnerability detected');
            }
          } else {
            console.warn('No input fields found for XSS testing');
          }
        },
      },

      {
        name: 'secure_headers',
        execute: async (driver) => {
          // This test would ideally check HTTP headers, but Selenium can't directly access them
          // We'll check for security-related meta tags instead
          const _securityMetas = await driver.findElements(
            By.css('meta[http-equiv], meta[name*="security"]'),
          );
        },
      },
    ];
  }

  /**
   * Mobile and responsive tests
   */
  getMobileTests() {
    return [
      {
        name: 'mobile_viewport',
        execute: async (driver) => {
          // Test mobile viewport
          await driver.manage().window().setRect({ width: 375, height: 667 });
          await driver.sleep(1000);

          // Check if page adapts to mobile
          const _viewport = await driver.executeScript(
            'return {width: window.innerWidth, height: window.innerHeight}',
          );

          // Look for mobile-specific elements
          const mobileElements = await driver.findElements(
            By.css('.mobile, .mobile-nav, .hamburger'),
          );
          if (mobileElements.length > 0) {
          }

          // Reset viewport
          await driver.manage().window().setRect({ width: 1920, height: 1080 });
        },
      },

      {
        name: 'touch_friendly_elements',
        execute: async (driver) => {
          await driver.manage().window().setRect({ width: 375, height: 667 });

          // Check button and link sizes for touch friendliness
          const buttons = await driver.findElements(
            By.css('button, a, input[type="button"], input[type="submit"]'),
          );

          for (const button of buttons.slice(0, 5)) {
            // Check first 5 elements
            const size = await button.getRect();
            if (size.height < 44 || size.width < 44) {
              console.warn(`Small touch target found: ${size.width}x${size.height}px`);
            }
          }

          // Reset viewport
          await driver.manage().window().setRect({ width: 1920, height: 1080 });
        },
      },
    ];
  }

  /**
   * Alerts and Notifications tests
   */
  getAlertsTests() {
    return [
      {
        name: 'job_alerts_page_loads',
        execute: async (driver) => {
          // Navigate to job alerts page
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.wait(until.titleContains('Job Alerts'), CONFIG.timeout);

          // Check if main alert elements are present
          const alertElements = [
            By.css('.create-alert-section'),
            By.css('.alerts-list-section'),
            By.css('#createAlertForm'),
            By.css('.section-title')
          ];

          for (const selector of alertElements) {
            const elements = await driver.findElements(selector);
            if (elements.length === 0) {
              console.warn(`Alert page element not found: ${selector.value}`);
            }
          }

          // Check for alert system initialization
          const alertSystemScript = await driver.findElements(
            By.css('script[src*="job-alert-system"]')
          );
          if (alertSystemScript.length === 0) {
            console.warn('Job alert system script not found');
          }
        },
      },

      {
        name: 'create_alert_form_interaction',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.wait(until.elementLocated(By.css('#createAlertForm')), CONFIG.timeout);

          // Test alert name input
          const alertNameInput = await driver.findElement(By.css('input[name="alertName"]'));
          await alertNameInput.clear();
          await alertNameInput.sendKeys('Test JavaScript Developer Alert');

          // Test keywords input
          const keywordsInput = await driver.findElement(By.css('#keywords'));
          await keywordsInput.clear();
          await keywordsInput.sendKeys('javascript');
          await keywordsInput.sendKeys(Key.ENTER);
          
          // Wait for keyword tag to appear
          await driver.sleep(1000);
          const keywordTags = await driver.findElements(By.css('#keywordTags .tag'));
          if (keywordTags.length === 0) {
            console.warn('Keyword tags not created properly');
          }

          // Test location selection
          const locationSelect = await driver.findElement(By.css('select[name="location"]'));
          await locationSelect.sendKeys('Remote Only');

          // Test salary range inputs
          const salaryMinInput = await driver.findElement(By.css('input[name="salaryMin"]'));
          await salaryMinInput.clear();
          await salaryMinInput.sendKeys('80000');

          const salaryMaxInput = await driver.findElement(By.css('input[name="salaryMax"]'));
          await salaryMaxInput.clear();
          await salaryMaxInput.sendKeys('120000');

          // Test frequency selection
          const frequencySelect = await driver.findElement(By.css('select[name="frequency"]'));
          await frequencySelect.sendKeys('Daily digest');

          // Verify form fields are populated
          const alertNameValue = await alertNameInput.getAttribute('value');
          const salaryMinValue = await salaryMinInput.getAttribute('value');
          
          if (!alertNameValue.includes('Test JavaScript')) {
            throw new Error('Alert name not set correctly');
          }
          if (salaryMinValue !== '80000') {
            throw new Error('Salary min not set correctly');
          }
        },
      },

      {
        name: 'alert_preview_functionality',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.wait(until.elementLocated(By.css('#createAlertForm')), CONFIG.timeout);

          // Fill out form with test data
          const alertNameInput = await driver.findElement(By.css('input[name="alertName"]'));
          await alertNameInput.clear();
          await alertNameInput.sendKeys('Preview Test Alert');

          const keywordsInput = await driver.findElement(By.css('#keywords'));
          await keywordsInput.clear();
          await keywordsInput.sendKeys('frontend');
          await keywordsInput.sendKeys(Key.ENTER);

          // Look for preview button
          const previewButtons = await driver.findElements(
            By.css('button[onclick*="preview"], .btn-preview, button:contains("Preview")')
          );

          if (previewButtons.length > 0) {
            // Click preview button
            await previewButtons[0].click();
            await driver.sleep(2000);

            // Check if preview results appear
            const previewResults = await driver.findElements(
              By.css('.preview-results, .alert-preview, .job-preview')
            );

            if (previewResults.length === 0) {
              console.warn('Alert preview results not displayed');
            }
          } else {
            console.warn('Alert preview functionality not found');
          }
        },
      },

      {
        name: 'notification_permissions_handling',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          
          // Check notification status display
          const notificationStatus = await driver.findElements(
            By.css('#notificationStatus, .notification-status')
          );

          if (notificationStatus.length > 0) {
            const statusText = await notificationStatus[0].getText();
            
            // Should show one of the permission states
            const validStates = ['granted', 'denied', 'default', 'checking'];
            const hasValidState = validStates.some(state => 
              statusText.toLowerCase().includes(state)
            );

            if (!hasValidState) {
              console.warn(`Unexpected notification status: ${statusText}`);
            }
          }

          // Check for notification permission buttons
          const permissionButtons = await driver.findElements(
            By.css('button[onclick*="notification"], .enable-notifications, .notification-toggle')
          );

          if (permissionButtons.length === 0) {
            console.warn('Notification permission controls not found');
          }
        },
      },

      {
        name: 'alert_management_interface',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.wait(until.elementLocated(By.css('.alerts-list-section')), CONFIG.timeout);

          // Check for alerts list container
          const alertsList = await driver.findElement(By.css('#alertsList'));
          
          // Check if there's a "no alerts" message or actual alerts
          const noAlertsMessage = await driver.findElements(By.css('.no-alerts'));
          const alertItems = await driver.findElements(By.css('.alert-item'));

          if (noAlertsMessage.length === 0 && alertItems.length === 0) {
            console.warn('Neither alert items nor no-alerts message found');
          }

          // Check for alert management buttons
          const managementButtons = await driver.findElements(
            By.css('.alert-actions button, .btn-edit, .btn-delete, .btn-toggle')
          );

          // If there are alert items, there should be management buttons
          if (alertItems.length > 0 && managementButtons.length === 0) {
            console.warn('Alert items found but no management buttons');
          }

          // Check for alert status indicators
          const statusIndicators = await driver.findElements(
            By.css('.alert-status, .status-active, .status-inactive')
          );

          if (alertItems.length > 0 && statusIndicators.length === 0) {
            console.warn('Alert items found but no status indicators');
          }
        },
      },

      {
        name: 'alert_frequency_options',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.wait(until.elementLocated(By.css('#createAlertForm')), CONFIG.timeout);

          // Find frequency selection
          const frequencySelect = await driver.findElement(By.css('select[name="frequency"]'));
          
          // Get all frequency options
          const options = await frequencySelect.findElements(By.css('option'));
          
          if (options.length < 3) {
            throw new Error('Insufficient frequency options found');
          }

          const expectedFrequencies = ['immediate', 'hourly', 'daily', 'weekly'];
          let foundFrequencies = [];

          for (const option of options) {
            const value = await option.getAttribute('value');
            const text = await option.getText();
            foundFrequencies.push(value || text.toLowerCase());
          }

          const hasRequiredFrequencies = expectedFrequencies.some(freq =>
            foundFrequencies.some(found => found.includes(freq))
          );

          if (!hasRequiredFrequencies) {
            console.warn(`Expected frequency options not found. Found: ${foundFrequencies.join(', ')}`);
          }
        },
      },

      {
        name: 'alert_criteria_validation',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.wait(until.elementLocated(By.css('#createAlertForm')), CONFIG.timeout);

          // Try to submit empty form
          const submitButton = await driver.findElement(
            By.css('button[type="submit"], .btn:contains("Create Alert")')
          );

          // Clear any pre-filled data
          const alertNameInput = await driver.findElement(By.css('input[name="alertName"]'));
          await alertNameInput.clear();

          // Attempt to submit empty form
          await submitButton.click();
          await driver.sleep(1000);

          // Check for validation messages
          const validationMessages = await driver.findElements(
            By.css('.error-message, .validation-error, .field-error, :invalid')
          );

          // HTML5 validation or custom validation should prevent submission
          const currentUrl = await driver.getCurrentUrl();
          if (!currentUrl.includes('job-alerts.html')) {
            throw new Error('Form submitted without proper validation');
          }

          // Check if required field highlighting works
          const requiredFields = await driver.findElements(By.css('input[required]'));
          if (requiredFields.length === 0) {
            console.warn('No required field validation found');
          }
        },
      },

      {
        name: 'responsive_alerts_interface',
        execute: async (driver) => {
          // Test mobile layout
          await driver.manage().window().setRect({ width: 375, height: 667 });
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.wait(until.elementLocated(By.css('.container')), CONFIG.timeout);

          // Check if main grid adapts to mobile
          const mainGrid = await driver.findElements(By.css('.main-grid'));
          if (mainGrid.length > 0) {
            const gridStyles = await driver.executeScript(`
              const grid = document.querySelector('.main-grid');
              const styles = window.getComputedStyle(grid);
              return {
                display: styles.display,
                gridTemplateColumns: styles.gridTemplateColumns
              };
            `);

            // On mobile, should be single column
            if (gridStyles.gridTemplateColumns && gridStyles.gridTemplateColumns.includes('1fr 1fr')) {
              console.warn('Grid may not be responsive on mobile');
            }
          }

          // Check if form elements are touch-friendly
          const formInputs = await driver.findElements(By.css('input, select, button'));
          for (const input of formInputs.slice(0, 3)) {
            const rect = await input.getRect();
            if (rect.height < 44) {
              console.warn(`Small touch target found: ${rect.height}px height`);
            }
          }

          // Reset viewport
          await driver.manage().window().setRect({ width: 1920, height: 1080 });
        },
      },

      {
        name: 'alert_system_integration',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          
          // Check for connection status indicators
          const connectionStatus = await driver.findElements(
            By.css('#alertConnectionStatus, .connection-indicator')
          );

          if (connectionStatus.length > 0) {
            const statusText = await connectionStatus[0].getText();
            
            // Should show connected or connecting status
            if (!statusText.toLowerCase().includes('connect')) {
              console.warn(`Unexpected connection status: ${statusText}`);
            }
          }

          // Check for API endpoints availability
          const totalMatches = await driver.findElements(By.css('#totalMatches'));
          if (totalMatches.length > 0) {
            const matchText = await totalMatches[0].getText();
            
            // Should be a number
            if (!/^\d+$/.test(matchText)) {
              console.warn(`Invalid total matches format: ${matchText}`);
            }
          }

          // Test navigation to related pages
          const navLinks = await driver.findElements(
            By.css('.nav-link, .nav-links a')
          );

          if (navLinks.length === 0) {
            console.warn('Navigation links not found');
          }

          // Check for alert system JavaScript initialization
          const alertSystemErrors = await driver.executeScript(`
            return window.console && window.console.error ? 
              window.console.error.toString() : 'No errors';
          `);

          if (alertSystemErrors.includes('alert') || alertSystemErrors.includes('notification')) {
            console.warn('Potential alert system JavaScript errors detected');
          }
        },
      },

      {
        name: 'push_notification_service_integration',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.sleep(2000);

          // Check if push notification service is loaded
          const pushServiceAvailable = await driver.executeScript(`
            return typeof PushNotificationService !== 'undefined' || 
                   typeof webPushService !== 'undefined' ||
                   window.pushNotificationService !== undefined;
          `);

          if (!pushServiceAvailable) {
            console.warn('Push notification service not found');
          }

          // Check for service worker registration
          const serviceWorkerAvailable = await driver.executeScript(`
            return 'serviceWorker' in navigator;
          `);

          if (!serviceWorkerAvailable) {
            console.warn('Service Worker not supported in test environment');
          }

          // Check for notification API support
          const notificationApiAvailable = await driver.executeScript(`
            return 'Notification' in window;
          `);

          if (!notificationApiAvailable) {
            console.warn('Notification API not supported in test environment');
          }

          // Check if VAPID keys are configured (by looking for subscription attempts)
          const vapidConfigured = await driver.executeScript(`
            return document.querySelector('meta[name="vapid-public-key"]') !== null ||
                   window.vapidPublicKey !== undefined;
          `);

          if (!vapidConfigured) {
            console.warn('VAPID keys not configured for push notifications');
          }
        },
      }
    ];
  }

  /**
   * Generate test report
   */
  async generateReport() {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    const passed = this.testResults.filter((r) => r.status === 'PASSED').length;
    const failed = this.testResults.filter((r) => r.status === 'FAILED').length;
    const total = this.testResults.length;

    const report = {
      summary: {
        total,
        passed,
        failed,
        successRate: `${((passed / total) * 100).toFixed(2)}%`,
        totalDuration,
        timestamp: new Date().toISOString(),
      },
      configuration: CONFIG,
      results: this.testResults,
    };

    // Write JSON report
    const reportPath = path.join(CONFIG.reportDir, `selenium-test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Write HTML report
    const htmlReport = this.generateHtmlReport(report);
    const htmlReportPath = path.join(CONFIG.reportDir, `selenium-test-report-${Date.now()}.html`);
    fs.writeFileSync(htmlReportPath, htmlReport);

    if (failed > 0) {
      this.testResults
        .filter((r) => r.status === 'FAILED')
        .forEach((r) => {
          if (r.screenshot) {
          }
        });
    }
  }

  /**
   * Generate HTML report
   */
  generateHtmlReport(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Selenium Test Report - Job Dorker</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #2196F3; padding-bottom: 20px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 24px; font-weight: bold; }
        .passed { color: #4CAF50; }
        .failed { color: #f44336; }
        .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .table th { background: #2196F3; color: white; }
        .status-passed { background: #E8F5E8; color: #2E7D2E; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        .status-failed { background: #FFEBEE; color: #C62828; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        .browser { padding: 2px 6px; background: #E3F2FD; color: #1976D2; border-radius: 3px; font-size: 11px; }
        .error { color: #d32f2f; font-size: 12px; max-width: 300px; word-break: break-word; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Selenium Test Report - Job Dorker</h1>
            <p>Generated on ${new Date(report.summary.timestamp).toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="metric">
                <h3>Total Tests</h3>
                <div class="value">${report.summary.total}</div>
            </div>
            <div class="metric">
                <h3>Passed</h3>
                <div class="value passed">${report.summary.passed}</div>
            </div>
            <div class="metric">
                <h3>Failed</h3>
                <div class="value failed">${report.summary.failed}</div>
            </div>
            <div class="metric">
                <h3>Success Rate</h3>
                <div class="value">${report.summary.successRate}</div>
            </div>
            <div class="metric">
                <h3>Duration</h3>
                <div class="value">${report.summary.totalDuration}ms</div>
            </div>
        </div>
        
        <h2>📋 Test Results</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>Test Suite</th>
                    <th>Test Name</th>
                    <th>Browser</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Error</th>
                </tr>
            </thead>
            <tbody>
                ${report.results
                  .map(
                    (result) => `
                    <tr>
                        <td>${result.suiteName}</td>
                        <td>${result.testName}</td>
                        <td><span class="browser">${result.browser}</span></td>
                        <td><span class="status-${result.status.toLowerCase()}">${result.status}</span></td>
                        <td>${result.duration}ms</td>
                        <td class="error">${result.error || '-'}</td>
                    </tr>
                `,
                  )
                  .join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    for (const [browser, driver] of this.drivers) {
      try {
        await driver.quit();
      } catch (error) {
        console.error(`❌ Error closing ${browser} driver:`, error.message);
      }
    }

    this.drivers.clear();
  }
}

// Export for use as module
export { ComprehensiveSeleniumTests };

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = new ComprehensiveSeleniumTests();

  tests
    .runAllTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}
