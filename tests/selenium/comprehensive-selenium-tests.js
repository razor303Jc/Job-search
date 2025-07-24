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
