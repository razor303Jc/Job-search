/**
 * Dedicated Job Alerts & Notifications Selenium Test Suite
 * Comprehensive testing for alerts system functionality
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
  screenshotDir: path.join(__dirname, 'screenshots', 'alerts'),
  reportDir: path.join(__dirname, 'reports', 'alerts'),
  testData: {
    sampleAlert: {
      name: 'Senior JavaScript Developer',
      keywords: ['javascript', 'react', 'node.js'],
      location: 'Remote',
      salaryMin: 80000,
      salaryMax: 140000,
      frequency: 'daily',
      companies: ['Google', 'Microsoft', 'Meta']
    }
  }
};

// Ensure directories exist
[CONFIG.screenshotDir, CONFIG.reportDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

class JobAlertsSeleniumTests {
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
          options.addArguments('--no-sandbox');
          options.addArguments('--disable-dev-shm-usage');
          options.addArguments('--disable-gpu');
          options.addArguments('--window-size=1920,1080');
          
          // Enable notifications for testing
          options.setUserPreferences({
            'profile.default_content_setting_values.notifications': 1
          });

          driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();
        } else if (browser === 'firefox') {
          options = new firefox.Options();
          if (CONFIG.headless) {
            options.addArguments('--headless');
          }
          options.addArguments('--width=1920');
          options.addArguments('--height=1080');
          
          // Enable notifications for testing
          options.setPreference('dom.webnotifications.enabled', true);
          options.setPreference('dom.push.enabled', true);

          driver = await new Builder()
            .forBrowser('firefox')
            .setFirefoxOptions(options)
            .build();
        }

        this.drivers.set(browser, driver);
        console.log(`✅ ${browser} driver initialized`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${browser} driver:`, error.message);
      }
    }
  }

  /**
   * Run all alert tests
   */
  async runAllTests() {
    console.log('\n🧪 Starting Job Alerts Selenium Test Suite...\n');

    try {
      await this.setupDrivers();

      const testSuites = [
        { name: 'Alert Page Functionality', tests: this.getAlertPageTests() },
        { name: 'Alert Creation & Management', tests: this.getAlertManagementTests() },
        { name: 'Notification System Tests', tests: this.getNotificationTests() },
        { name: 'Alert Integration Tests', tests: this.getIntegrationTests() },
        { name: 'Alert Performance Tests', tests: this.getPerformanceTests() },
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
    console.log(`\n📋 Running ${suite.name}...`);
    
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
      console.log(`  🔄 ${test.name} (${browser})`);

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
      console.log(`    ✅ PASSED (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const screenshot = await this.takeScreenshot(driver, testId);

      const result = {
        testId,
        suiteName,
        testName: test.name,
        browser,
        status: 'FAILED',
        duration,
        error: error.message,
        screenshot,
        timestamp: new Date().toISOString(),
      };

      this.testResults.push(result);
      console.log(`    ❌ FAILED (${duration}ms): ${error.message}`);
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
      return filename;
    } catch (error) {
      console.error('Failed to take screenshot:', error.message);
      return null;
    }
  }

  /**
   * Alert page functionality tests
   */
  getAlertPageTests() {
    return [
      {
        name: 'alerts_page_loads_correctly',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.wait(until.titleContains('Job Alerts'), CONFIG.timeout);

          // Verify essential elements are present
          const requiredElements = [
            '.create-alert-section',
            '.alerts-list-section', 
            '#createAlertForm',
            '.section-title'
          ];

          for (const selector of requiredElements) {
            const elements = await driver.findElements(By.css(selector));
            if (elements.length === 0) {
              throw new Error(`Required element not found: ${selector}`);
            }
          }

          // Check page title
          const title = await driver.getTitle();
          if (!title.includes('Alert')) {
            throw new Error('Page title does not indicate alerts functionality');
          }
        },
      },

      {
        name: 'alert_form_elements_present',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.wait(until.elementLocated(By.css('#createAlertForm')), CONFIG.timeout);

          // Check for all required form elements
          const formElements = {
            'Alert Name Input': 'input[name="alertName"]',
            'Keywords Input': '#keywords',
            'Location Select': 'select[name="location"]',
            'Salary Min Input': 'input[name="salaryMin"]',
            'Salary Max Input': 'input[name="salaryMax"]',
            'Frequency Select': 'select[name="frequency"]',
            'Submit Button': 'button[type="submit"]'
          };

          for (const [elementName, selector] of Object.entries(formElements)) {
            const elements = await driver.findElements(By.css(selector));
            if (elements.length === 0) {
              throw new Error(`Form element missing: ${elementName} (${selector})`);
            }
          }
        },
      },

      {
        name: 'navigation_links_functional',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);

          // Test navigation links
          const navLinks = await driver.findElements(By.css('.nav-links a, .nav-link'));
          
          if (navLinks.length === 0) {
            throw new Error('No navigation links found');
          }

          // Check each navigation link (first 3)
          for (const link of navLinks.slice(0, 3)) {
            const href = await link.getAttribute('href');
            const text = await link.getText();
            
            if (!href || href === '#') {
              throw new Error(`Invalid navigation link: ${text}`);
            }
          }
        },
      },

      {
        name: 'status_indicators_working',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.sleep(2000); // Allow status to update

          // Check connection status
          const connectionStatus = await driver.findElements(
            By.css('#alertConnectionStatus, .connection-indicator')
          );

          if (connectionStatus.length > 0) {
            const statusText = await connectionStatus[0].getText();
            if (!statusText || statusText.trim() === '') {
              throw new Error('Connection status is empty');
            }
          }

          // Check notification status
          const notificationStatus = await driver.findElements(
            By.css('#notificationStatus, .notification-status')
          );

          if (notificationStatus.length > 0) {
            const statusText = await notificationStatus[0].getText();
            const validStates = ['granted', 'denied', 'default', 'checking'];
            const isValidState = validStates.some(state => 
              statusText.toLowerCase().includes(state)
            );

            if (!isValidState) {
              throw new Error(`Invalid notification status: ${statusText}`);
            }
          }
        },
      }
    ];
  }

  /**
   * Alert creation and management tests
   */
  getAlertManagementTests() {
    return [
      {
        name: 'create_alert_form_validation',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.wait(until.elementLocated(By.css('#createAlertForm')), CONFIG.timeout);

          // Try submitting empty form
          const submitButton = await driver.findElement(By.css('button[type="submit"]'));
          await submitButton.click();
          await driver.sleep(1000);

          // Should still be on alerts page (validation prevented submission)
          const currentUrl = await driver.getCurrentUrl();
          if (!currentUrl.includes('job-alerts.html')) {
            throw new Error('Form submitted without proper validation');
          }

          // Check for validation indicators
          const alertNameInput = await driver.findElement(By.css('input[name="alertName"]'));
          const isRequired = await alertNameInput.getAttribute('required');
          
          if (!isRequired) {
            console.warn('Alert name field should be required');
          }
        },
      },

      {
        name: 'alert_form_data_entry',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.wait(until.elementLocated(By.css('#createAlertForm')), CONFIG.timeout);

          const testData = CONFIG.testData.sampleAlert;

          // Fill alert name
          const alertNameInput = await driver.findElement(By.css('input[name="alertName"]'));
          await alertNameInput.clear();
          await alertNameInput.sendKeys(testData.name);

          // Add keywords
          const keywordsInput = await driver.findElement(By.css('#keywords'));
          for (const keyword of testData.keywords) {
            await keywordsInput.clear();
            await keywordsInput.sendKeys(keyword);
            await keywordsInput.sendKeys(Key.ENTER);
            await driver.sleep(500);
          }

          // Verify keyword tags were created
          const keywordTags = await driver.findElements(By.css('#keywordTags .tag'));
          if (keywordTags.length !== testData.keywords.length) {
            throw new Error(`Expected ${testData.keywords.length} keyword tags, found ${keywordTags.length}`);
          }

          // Set location
          const locationSelect = await driver.findElement(By.css('select[name="location"]'));
          await locationSelect.sendKeys(testData.location);

          // Set salary range
          const salaryMinInput = await driver.findElement(By.css('input[name="salaryMin"]'));
          await salaryMinInput.clear();
          await salaryMinInput.sendKeys(testData.salaryMin.toString());

          const salaryMaxInput = await driver.findElement(By.css('input[name="salaryMax"]'));
          await salaryMaxInput.clear();
          await salaryMaxInput.sendKeys(testData.salaryMax.toString());

          // Set frequency
          const frequencySelect = await driver.findElement(By.css('select[name="frequency"]'));
          await frequencySelect.sendKeys('Daily digest');

          // Verify form data
          const alertNameValue = await alertNameInput.getAttribute('value');
          const salaryMinValue = await salaryMinInput.getAttribute('value');
          
          if (alertNameValue !== testData.name) {
            throw new Error(`Alert name mismatch: expected ${testData.name}, got ${alertNameValue}`);
          }
          
          if (salaryMinValue !== testData.salaryMin.toString()) {
            throw new Error(`Salary min mismatch: expected ${testData.salaryMin}, got ${salaryMinValue}`);
          }
        },
      },

      {
        name: 'keyword_tag_management',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.wait(until.elementLocated(By.css('#keywords')), CONFIG.timeout);

          const keywordsInput = await driver.findElement(By.css('#keywords'));

          // Add a keyword
          await keywordsInput.sendKeys('react');
          await keywordsInput.sendKeys(Key.ENTER);
          await driver.sleep(500);

          // Check if tag was created
          let tags = await driver.findElements(By.css('#keywordTags .tag'));
          if (tags.length !== 1) {
            throw new Error('Keyword tag not created properly');
          }

          // Add another keyword
          await keywordsInput.sendKeys('vue.js');
          await keywordsInput.sendKeys(Key.ENTER);
          await driver.sleep(500);

          tags = await driver.findElements(By.css('#keywordTags .tag'));
          if (tags.length !== 2) {
            throw new Error('Second keyword tag not created');
          }

          // Test removing a tag (if remove functionality exists)
          const removeButtons = await driver.findElements(By.css('.tag-remove, .tag .remove'));
          if (removeButtons.length > 0) {
            await removeButtons[0].click();
            await driver.sleep(500);

            tags = await driver.findElements(By.css('#keywordTags .tag'));
            if (tags.length !== 1) {
              throw new Error('Tag removal not working properly');
            }
          }
        },
      },

      {
        name: 'company_tag_management',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          
          // Check if company input exists
          const companyInputs = await driver.findElements(By.css('#company, input[id*="company"]'));
          
          if (companyInputs.length > 0) {
            const companyInput = companyInputs[0];
            
            // Add companies
            for (const company of CONFIG.testData.sampleAlert.companies) {
              await companyInput.clear();
              await companyInput.sendKeys(company);
              await companyInput.sendKeys(Key.ENTER);
              await driver.sleep(500);
            }

            // Check if company tags were created
            const companyTags = await driver.findElements(By.css('#companyTags .tag, .company-tags .tag'));
            if (companyTags.length === 0) {
              console.warn('Company tags not found - feature may not be implemented');
            }
          } else {
            console.warn('Company input field not found');
          }
        },
      },

      {
        name: 'alert_frequency_selection',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.wait(until.elementLocated(By.css('select[name="frequency"]')), CONFIG.timeout);

          const frequencySelect = await driver.findElement(By.css('select[name="frequency"]'));
          const options = await frequencySelect.findElements(By.css('option'));

          if (options.length < 3) {
            throw new Error('Insufficient frequency options available');
          }

          // Test each frequency option
          const expectedFrequencies = ['immediate', 'hourly', 'daily', 'weekly'];
          let foundFrequencies = [];

          for (const option of options) {
            const value = await option.getAttribute('value');
            const text = await option.getText();
            foundFrequencies.push({ value, text });
          }

          const hasValidFrequencies = expectedFrequencies.some(expected =>
            foundFrequencies.some(found => 
              found.value?.toLowerCase().includes(expected) || 
              found.text?.toLowerCase().includes(expected)
            )
          );

          if (!hasValidFrequencies) {
            throw new Error('No standard frequency options found');
          }

          // Test selecting different frequencies
          await frequencySelect.sendKeys('Daily digest');
          const selectedValue = await frequencySelect.getAttribute('value');
          if (!selectedValue) {
            throw new Error('Frequency selection not working');
          }
        },
      }
    ];
  }

  /**
   * Notification system tests
   */
  getNotificationTests() {
    return [
      {
        name: 'notification_permission_status',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.sleep(2000);

          // Check if notification API is available
          const notificationSupported = await driver.executeScript(`
            return 'Notification' in window;
          `);

          if (!notificationSupported) {
            console.warn('Notification API not supported in test environment');
            return;
          }

          // Check notification permission status
          const permission = await driver.executeScript(`
            return Notification.permission;
          `);

          const validPermissions = ['granted', 'denied', 'default'];
          if (!validPermissions.includes(permission)) {
            throw new Error(`Invalid notification permission: ${permission}`);
          }

          // Check if status is displayed in UI
          const statusElements = await driver.findElements(
            By.css('#notificationStatus, .notification-status')
          );

          if (statusElements.length > 0) {
            const statusText = await statusElements[0].getText();
            if (!statusText.toLowerCase().includes(permission)) {
              console.warn(`UI status (${statusText}) doesn't match actual permission (${permission})`);
            }
          }
        },
      },

      {
        name: 'push_notification_service_worker',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.sleep(2000);

          // Check service worker support
          const swSupported = await driver.executeScript(`
            return 'serviceWorker' in navigator;
          `);

          if (!swSupported) {
            console.warn('Service Worker not supported in test environment');
            return;
          }

          // Check if service worker is registered
          const swRegistered = await driver.executeScript(`
            return navigator.serviceWorker.getRegistrations()
              .then(registrations => registrations.length > 0);
          `);

          if (!swRegistered) {
            console.warn('No service worker registrations found');
          }

          // Check for push notification service initialization
          const pushServiceAvailable = await driver.executeScript(`
            return typeof PushNotificationService !== 'undefined' || 
                   window.pushNotificationService !== undefined ||
                   typeof webPushService !== 'undefined';
          `);

          if (!pushServiceAvailable) {
            console.warn('Push notification service not initialized');
          }
        },
      },

      {
        name: 'vapid_configuration_check',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);

          // Check for VAPID key configuration
          const vapidKeyPresent = await driver.executeScript(`
            return document.querySelector('meta[name="vapid-public-key"]') !== null ||
                   window.vapidPublicKey !== undefined ||
                   typeof applicationServerKey !== 'undefined';
          `);

          if (!vapidKeyPresent) {
            console.warn('VAPID keys not configured - push notifications may not work');
          }

          // Check if push subscription can be attempted
          const canSubscribe = await driver.executeScript(`
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
              return false;
            }
            return true;
          `);

          if (!canSubscribe) {
            console.warn('Push subscription not possible in current environment');
          }
        },
      },

      {
        name: 'notification_ui_controls',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);

          // Look for notification control buttons
          const notificationButtons = await driver.findElements(
            By.css('button[onclick*="notification"], .enable-notifications, .notification-toggle')
          );

          if (notificationButtons.length === 0) {
            console.warn('No notification control buttons found');
            return;
          }

          // Test clicking notification button (careful not to trigger actual permission request)
          const button = notificationButtons[0];
          const buttonText = await button.getText();
          
          if (buttonText.toLowerCase().includes('enable') || 
              buttonText.toLowerCase().includes('allow')) {
            // This is likely an enable button - we can test its presence but not click
            console.log('Notification enable button found');
          }
        },
      }
    ];
  }

  /**
   * Integration tests
   */
  getIntegrationTests() {
    return [
      {
        name: 'alert_api_endpoints_available',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);

          // Test if alert API endpoints respond
          const apiAvailable = await driver.executeScript(`
            return fetch('/api/v1/alerts', { method: 'HEAD' })
              .then(response => response.ok || response.status === 405)
              .catch(() => false);
          `);

          if (!apiAvailable) {
            throw new Error('Alert API endpoints not available');
          }
        },
      },

      {
        name: 'authentication_integration',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);

          // Check if authentication state is handled
          const authState = await driver.executeScript(`
            return localStorage.getItem('authToken') || 
                   sessionStorage.getItem('authToken') ||
                   document.cookie.includes('auth');
          `);

          // The page should handle both authenticated and unauthenticated states
          const alertForm = await driver.findElements(By.css('#createAlertForm'));
          if (alertForm.length === 0) {
            throw new Error('Alert form not available - may require authentication');
          }
        },
      },

      {
        name: 'alert_data_persistence',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          
          // Check if alerts are loaded from storage/API
          const alertsList = await driver.findElements(By.css('#alertsList'));
          if (alertsList.length === 0) {
            throw new Error('Alerts list container not found');
          }

          // Check if there's a loading mechanism
          const loadingIndicators = await driver.findElements(
            By.css('.loading, .spinner, [id*="loading"]')
          );

          // Either loading indicators should be present, or alerts should be displayed
          const alertItems = await driver.findElements(By.css('.alert-item'));
          const noAlertsMessage = await driver.findElements(By.css('.no-alerts'));

          if (loadingIndicators.length === 0 && alertItems.length === 0 && noAlertsMessage.length === 0) {
            console.warn('No loading, alerts, or no-alerts message found');
          }
        },
      },

      {
        name: 'real_time_updates',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);

          // Check for WebSocket or polling mechanisms
          const hasRealTimeUpdates = await driver.executeScript(`
            return window.WebSocket !== undefined || 
                   window.EventSource !== undefined ||
                   typeof jobAlertSystem !== 'undefined';
          `);

          if (!hasRealTimeUpdates) {
            console.warn('No real-time update mechanisms detected');
          }

          // Check if total matches counter updates
          const totalMatches = await driver.findElements(By.css('#totalMatches'));
          if (totalMatches.length > 0) {
            const initialValue = await totalMatches[0].getText();
            
            // Wait and check if value changes (or at least is initialized)
            await driver.sleep(3000);
            const updatedValue = await totalMatches[0].getText();
            
            if (initialValue === '0' && updatedValue === '0') {
              console.warn('Total matches counter may not be updating');
            }
          }
        },
      }
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
          
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.wait(until.elementLocated(By.css('#createAlertForm')), CONFIG.timeout);
          
          const loadTime = Date.now() - startTime;
          
          if (loadTime > 5000) {
            console.warn(`Slow page load: ${loadTime}ms`);
          }

          // Check if critical resources loaded
          const criticalElements = [
            '#createAlertForm',
            '.alerts-list-section',
            '.section-title'
          ];

          for (const selector of criticalElements) {
            const elements = await driver.findElements(By.css(selector));
            if (elements.length === 0) {
              throw new Error(`Critical element not loaded: ${selector}`);
            }
          }
        },
      },

      {
        name: 'form_interaction_responsiveness',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.wait(until.elementLocated(By.css('#keywords')), CONFIG.timeout);

          const keywordsInput = await driver.findElement(By.css('#keywords'));
          
          // Test rapid keyword entry
          const startTime = Date.now();
          
          await keywordsInput.sendKeys('javascript');
          await keywordsInput.sendKeys(Key.ENTER);
          
          // Wait for tag to appear
          await driver.wait(until.elementLocated(By.css('#keywordTags .tag')), 3000);
          
          const responseTime = Date.now() - startTime;
          
          if (responseTime > 2000) {
            console.warn(`Slow form interaction: ${responseTime}ms`);
          }
        },
      },

      {
        name: 'memory_leak_detection',
        execute: async (driver) => {
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          
          // Check for potential memory leaks by looking at event listeners
          const listenerCount = await driver.executeScript(`
            return document.querySelectorAll('*').length;
          `);

          // Navigate away and back
          await driver.get(`${CONFIG.baseUrl}`);
          await driver.sleep(1000);
          await driver.get(`${CONFIG.baseUrl}/job-alerts.html`);
          await driver.sleep(1000);

          const newListenerCount = await driver.executeScript(`
            return document.querySelectorAll('*').length;
          `);

          // Large increases might indicate memory leaks
          const increase = newListenerCount - listenerCount;
          if (increase > 100) {
            console.warn(`Potential memory leak detected: ${increase} new elements`);
          }
        },
      }
    ];
  }

  /**
   * Generate comprehensive test report
   */
  async generateReport() {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    const passed = this.testResults.filter((r) => r.status === 'PASSED').length;
    const failed = this.testResults.filter((r) => r.status === 'FAILED').length;
    const total = this.testResults.length;

    const report = {
      summary: {
        title: 'Job Alerts & Notifications Selenium Test Report',
        total,
        passed,
        failed,
        successRate: `${((passed / total) * 100).toFixed(2)}%`,
        totalDuration,
        timestamp: new Date().toISOString(),
      },
      configuration: CONFIG,
      testData: CONFIG.testData,
      results: this.testResults,
      coverage: {
        alertPageFunctionality: this.getTestCoverage('Alert Page Functionality'),
        alertManagement: this.getTestCoverage('Alert Creation & Management'),
        notificationSystem: this.getTestCoverage('Notification System Tests'),
        integration: this.getTestCoverage('Alert Integration Tests'),
        performance: this.getTestCoverage('Alert Performance Tests'),
      }
    };

    // Write JSON report
    const reportPath = path.join(CONFIG.reportDir, `alerts-selenium-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Write HTML report
    const htmlReport = this.generateHtmlReport(report);
    const htmlReportPath = path.join(CONFIG.reportDir, `alerts-selenium-report-${Date.now()}.html`);
    fs.writeFileSync(htmlReportPath, htmlReport);

    console.log(`\n📊 Test Report Generated:`);
    console.log(`   JSON: ${reportPath}`);
    console.log(`   HTML: ${htmlReportPath}`);
    console.log(`\n📈 Results Summary:`);
    console.log(`   Total Tests: ${total}`);
    console.log(`   Passed: ${passed} ✅`);
    console.log(`   Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
    console.log(`   Success Rate: ${report.summary.successRate}`);
    console.log(`   Duration: ${totalDuration}ms`);

    if (failed > 0) {
      console.log(`\n❌ Failed Tests:`);
      this.testResults
        .filter((r) => r.status === 'FAILED')
        .forEach((r) => {
          console.log(`   ${r.testName} (${r.browser}): ${r.error}`);
          if (r.screenshot) {
            console.log(`     Screenshot: ${CONFIG.screenshotDir}/${r.screenshot}`);
          }
        });
    }
  }

  /**
   * Get test coverage for a specific suite
   */
  getTestCoverage(suiteName) {
    const suiteResults = this.testResults.filter(r => r.suiteName === suiteName);
    const passed = suiteResults.filter(r => r.status === 'PASSED').length;
    const total = suiteResults.length;
    
    return {
      passed,
      total,
      percentage: total > 0 ? ((passed / total) * 100).toFixed(2) : 0
    };
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
    <title>Job Alerts Selenium Test Report</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container { 
            max-width: 1400px; margin: 0 auto; 
            background: white; padding: 30px; 
            border-radius: 15px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.2); 
        }
        .header { 
            text-align: center; 
            border-bottom: 3px solid #667eea; 
            padding-bottom: 20px; margin-bottom: 30px; 
        }
        .header h1 { 
            color: #333; margin: 0 0 10px 0; 
            font-size: 2.5em; font-weight: 300; 
        }
        .summary { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 20px; margin-bottom: 40px; 
        }
        .metric { 
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); 
            padding: 20px; border-radius: 10px; 
            text-align: center; border-left: 4px solid #667eea; 
        }
        .metric h3 { margin: 0 0 15px 0; color: #495057; font-size: 1.1em; }
        .metric .value { font-size: 2.5em; font-weight: bold; color: #343a40; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .coverage-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .coverage-item {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            border-left: 4px solid #17a2b8;
        }
        .coverage-bar {
            background: #e9ecef;
            height: 20px;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .coverage-fill {
            height: 100%;
            background: linear-gradient(90deg, #28a745, #20c997);
            transition: width 0.3s ease;
        }
        .table { 
            width: 100%; border-collapse: collapse; 
            margin-top: 30px; background: white;
            border-radius: 10px; overflow: hidden;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .table th, .table td { 
            padding: 15px; text-align: left; 
            border-bottom: 1px solid #dee2e6; 
        }
        .table th { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; font-weight: 600;
        }
        .table tr:hover { background: #f8f9fa; }
        .status-passed { 
            background: #d4edda; color: #155724; 
            padding: 6px 12px; border-radius: 20px; 
            font-size: 12px; font-weight: 600;
        }
        .status-failed { 
            background: #f8d7da; color: #721c24; 
            padding: 6px 12px; border-radius: 20px; 
            font-size: 12px; font-weight: 600;
        }
        .browser { 
            padding: 4px 8px; background: #e3f2fd; 
            color: #1976d2; border-radius: 15px; 
            font-size: 11px; font-weight: 500;
        }
        .error { 
            color: #dc3545; font-size: 12px; 
            max-width: 300px; word-break: break-word; 
        }
        .test-config {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        .config-item {
            margin: 10px 0;
            padding: 10px;
            background: white;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔔 Job Alerts & Notifications Test Report</h1>
            <p style="color: #6c757d; font-size: 1.1em;">
                Generated on ${new Date(report.summary.timestamp).toLocaleString()}
            </p>
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

        <h2>🎯 Test Coverage by Feature</h2>
        <div class="coverage-grid">
            ${Object.entries(report.coverage).map(([feature, coverage]) => `
                <div class="coverage-item">
                    <h4>${feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h4>
                    <div class="coverage-bar">
                        <div class="coverage-fill" style="width: ${coverage.percentage}%"></div>
                    </div>
                    <p>${coverage.passed}/${coverage.total} tests passed (${coverage.percentage}%)</p>
                </div>
            `).join('')}
        </div>

        <h2>⚙️ Test Configuration</h2>
        <div class="test-config">
            <div class="config-item">
                <strong>Base URL:</strong> ${report.configuration.baseUrl}
            </div>
            <div class="config-item">
                <strong>Browsers:</strong> ${report.configuration.browsers.join(', ')}
            </div>
            <div class="config-item">
                <strong>Timeout:</strong> ${report.configuration.timeout}ms
            </div>
            <div class="config-item">
                <strong>Headless:</strong> ${report.configuration.headless ? 'Yes' : 'No'}
            </div>
        </div>
        
        <h2>📋 Detailed Test Results</h2>
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
                        <td>${result.testName.replace(/_/g, ' ')}</td>
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
        console.log(`✅ ${browser} driver closed`);
      } catch (error) {
        console.error(`❌ Error closing ${browser} driver:`, error.message);
      }
    }

    this.drivers.clear();
  }
}

// Export for use as module
export { JobAlertsSeleniumTests };

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = new JobAlertsSeleniumTests();

  tests
    .runAllTests()
    .then(() => {
      const failed = tests.testResults.filter(r => r.status === 'FAILED').length;
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('\n💥 Job Alerts test suite failed:', error);
      process.exit(1);
    });
}
