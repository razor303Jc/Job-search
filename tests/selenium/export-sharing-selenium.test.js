/**
 * Selenium Tests for Export & Sharing Features
 * Comprehensive testing of export functionality, sharing capabilities, and UI interactions
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder, By, Key, WebDriver, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import firefox from 'selenium-webdriver/firefox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ExportSharingSeleniumTests {
  constructor() {
    this.config = {
      baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
      timeout: 30000,
      browsers: ['chrome', 'firefox'],
      headless: process.env.CI === 'true',
      screenshotDir: path.join(__dirname, 'screenshots', 'export-sharing'),
    };

    this.drivers = new Map();
    this.testResults = [];

    // Ensure screenshot directory exists
    if (!fs.existsSync(this.config.screenshotDir)) {
      fs.mkdirSync(this.config.screenshotDir, { recursive: true });
    }
  }

  /**
   * Setup browser drivers
   */
  async setupDrivers() {
    for (const browser of this.config.browsers) {
      let driver;

      if (browser === 'chrome') {
        const options = new chrome.Options();
        if (this.config.headless) {
          options.addArguments('--headless');
        }
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--window-size=1920,1080');
        // Allow downloads for export testing
        const downloadPath = path.join(__dirname, 'downloads');
        if (!fs.existsSync(downloadPath)) {
          fs.mkdirSync(downloadPath, { recursive: true });
        }
        options.setUserPreferences({
          'download.default_directory': downloadPath,
          'download.prompt_for_download': false,
          'safebrowsing.enabled': false,
        });

        driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
      } else if (browser === 'firefox') {
        const options = new firefox.Options();
        if (this.config.headless) {
          options.headless();
        }
        options.setPreference('dom.webnotifications.enabled', false);

        driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).build();
      }

      if (driver) {
        await driver.manage().setTimeouts({ implicit: this.config.timeout });
        this.drivers.set(browser, driver);
      }
    }
  }

  /**
   * Cleanup drivers
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

  /**
   * Take screenshot on failure
   */
  async takeScreenshot(driver, testName, browser) {
    try {
      const screenshot = await driver.takeScreenshot();
      const filename = `${testName}_${browser}_${Date.now()}.png`;
      const filepath = path.join(this.config.screenshotDir, filename);
      fs.writeFileSync(filepath, screenshot, 'base64');
      return filepath;
    } catch (error) {
      console.error('❌ Failed to take screenshot:', error.message);
      return null;
    }
  }

  /**
   * Wait for element with visibility
   */
  async waitForElement(driver, locator, timeout = this.config.timeout) {
    const element = await driver.wait(until.elementLocated(locator), timeout);
    await driver.wait(until.elementIsVisible(element), timeout);
    return element;
  }

  /**
   * Test: Export Interface Loading
   */
  async testExportInterfaceLoading(driver, browser) {
    try {
      // Navigate to export page
      await driver.get(`${this.config.baseUrl}/export`);

      // Wait for page title
      await driver.wait(until.titleContains('Export'), 10000);

      // Check main navigation tabs
      const tabs = [
        By.css('button[data-tab="export"]'),
        By.css('button[data-tab="sharing"]'),
        By.css('button[data-tab="templates"]'),
        By.css('button[data-tab="collections"]'),
      ];

      for (const tab of tabs) {
        await this.waitForElement(driver, tab);
      }

      // Check export section is visible by default
      await this.waitForElement(driver, By.id('export-tab'));
      const exportTab = await driver.findElement(By.id('export-tab'));
      const isVisible = await exportTab.isDisplayed();
      assert(isVisible, 'Export tab not visible by default');

      // Check quick export buttons
      const quickExportButtons = [
        By.css('button[onclick*="quickExport(\'csv\')"]'),
        By.css('button[onclick*="quickExport(\'json\')"]'),
        By.css('button[onclick*="quickExport(\'pdf\')"]'),
        By.css('button[onclick*="quickExport(\'xlsx\')"]'),
      ];

      for (const button of quickExportButtons) {
        await this.waitForElement(driver, button);
      }

      // Check custom export form
      await this.waitForElement(driver, By.id('export-form'));
      return { success: true, browser, test: 'export-interface-loading' };
    } catch (error) {
      console.error(`❌ Export interface loading test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'export-interface-loading-failed', browser);
      return { success: false, browser, test: 'export-interface-loading', error: error.message };
    }
  }

  /**
   * Test: Quick Export Functionality
   */
  async testQuickExportFunctionality(driver, browser) {
    try {
      // Navigate to export page
      await driver.get(`${this.config.baseUrl}/export`);
      await this.waitForElement(driver, By.id('export-section'));

      // Test CSV export
      const csvButton = await driver.findElement(By.css('button[onclick*="quickExport(\'csv\')"]'));
      await csvButton.click();

      // Wait for export queue to update
      await driver.sleep(2000);
      await this.waitForElement(driver, By.id('queue-list'));

      // Check if export appears in queue
      const queueItems = await driver.findElements(By.css('.queue-item'));
      assert(queueItems.length > 0, 'No export items in queue after CSV export');

      // Test JSON export
      const jsonButton = await driver.findElement(
        By.css('button[onclick*="quickExport(\'json\')"]'),
      );
      await jsonButton.click();
      await driver.sleep(2000);

      // Test PDF export
      const pdfButton = await driver.findElement(By.css('button[onclick*="quickExport(\'pdf\')"]'));
      await pdfButton.click();
      await driver.sleep(2000);

      // Test Excel export
      const xlsxButton = await driver.findElement(
        By.css('button[onclick*="quickExport(\'xlsx\')"]'),
      );
      await xlsxButton.click();
      await driver.sleep(2000);

      // Check queue has multiple items
      const updatedQueueItems = await driver.findElements(By.css('.queue-item'));
      assert(updatedQueueItems.length >= 4, 'Not all exports appeared in queue');

      // Check export status elements
      for (const item of updatedQueueItems) {
        const statusElement = await item.findElement(By.css('.export-status'));
        const status = await statusElement.getText();
        assert(
          ['PENDING', 'PROCESSING', 'COMPLETED'].includes(status),
          `Invalid status: ${status}`,
        );
      }
      return { success: true, browser, test: 'quick-export-functionality' };
    } catch (error) {
      console.error(`❌ Quick export functionality test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'quick-export-failed', browser);
      return { success: false, browser, test: 'quick-export-functionality', error: error.message };
    }
  }

  /**
   * Test: Custom Export Form
   */
  async testCustomExportForm(driver, browser) {
    try {
      // Navigate to export page
      await driver.get(`${this.config.baseUrl}/export`);
      await this.waitForElement(driver, By.id('export-form'));

      // Test form field interactions
      const formatSelect = await driver.findElement(By.id('export-format'));
      await formatSelect.click();

      const pdfOption = await driver.findElement(By.css('option[value="pdf"]'));
      await pdfOption.click();

      // Test filename input
      const filenameInput = await driver.findElement(By.id('export-filename'));
      await filenameInput.clear();
      await filenameInput.sendKeys('custom-test-export');

      // Test field checkboxes
      const fieldCheckboxes = await driver.findElements(By.css('input[name="fields"]'));
      assert(fieldCheckboxes.length > 0, 'No field checkboxes found');

      // Uncheck some fields and check others
      for (let i = 0; i < Math.min(3, fieldCheckboxes.length); i++) {
        const checkbox = fieldCheckboxes[i];
        const isChecked = await checkbox.isSelected();
        if (isChecked) {
          await checkbox.click(); // Uncheck
        } else {
          await checkbox.click(); // Check
        }
      }

      // Test limit results
      const limitInput = await driver.findElement(By.id('limit-results'));
      await limitInput.sendKeys('50');

      // Test sort by
      const sortSelect = await driver.findElement(By.id('sort-by'));
      await sortSelect.click();

      const salaryOption = await driver.findElement(By.css('option[value="salary"]'));
      await salaryOption.click();

      // Test date range
      const dateFromInput = await driver.findElement(By.id('date-from'));
      await dateFromInput.sendKeys('2025-01-01');

      const dateToInput = await driver.findElement(By.id('date-to'));
      await dateToInput.sendKeys('2025-07-22');

      // Test export notes
      const notesInput = await driver.findElement(By.id('export-notes'));
      await notesInput.sendKeys('Custom export test with specific configuration');

      // Submit form
      const submitButton = await driver.findElement(By.css('button[type="submit"]'));
      await submitButton.click();

      // Wait for form submission and queue update
      await driver.sleep(3000);

      // Verify export appears in queue
      const queueItems = await driver.findElements(By.css('.queue-item'));
      assert(queueItems.length > 0, 'Custom export did not appear in queue');

      // Test reset form
      const resetButton = await driver.findElement(By.css('button[onclick*="resetForm"]'));
      await resetButton.click();

      // Verify form is reset
      const resetFilename = await driver.findElement(By.id('export-filename'));
      const resetValue = await resetFilename.getAttribute('value');
      assert(resetValue === '' || resetValue === 'job-search-results', 'Form not properly reset');
      return { success: true, browser, test: 'custom-export-form' };
    } catch (error) {
      console.error(`❌ Custom export form test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'custom-export-form-failed', browser);
      return { success: false, browser, test: 'custom-export-form', error: error.message };
    }
  }

  /**
   * Test: Sharing Interface
   */
  async testSharingInterface(driver, browser) {
    try {
      // Navigate to export page and switch to sharing tab
      await driver.get(`${this.config.baseUrl}/export`);

      const sharingTab = await driver.findElement(By.css('button[data-tab="sharing"]'));
      await sharingTab.click();

      // Wait for sharing section to be visible
      await this.waitForElement(driver, By.id('sharing-tab'));

      // Test share options
      const shareOptions = await driver.findElements(By.css('.share-option'));
      assert(shareOptions.length >= 4, 'Not enough share options found');

      // Test generate link option
      const generateLinkOption = shareOptions[0];
      await generateLinkOption.click();

      // Wait for share link modal
      await this.waitForElement(driver, By.id('share-link-modal'));

      // Check modal content
      await this.waitForElement(driver, By.id('generated-url'));
      await this.waitForElement(driver, By.id('link-privacy'));

      // Test privacy settings
      const privacySelect = await driver.findElement(By.id('link-privacy'));
      await privacySelect.click();

      const passwordOption = await driver.findElement(By.css('option[value="password"]'));
      await passwordOption.click();

      // Check password field appears
      await this.waitForElement(driver, By.id('password-field'));
      const passwordField = await driver.findElement(By.id('password-field'));
      const isPasswordVisible = await passwordField.isDisplayed();
      assert(isPasswordVisible, 'Password field not visible when password protection selected');

      // Test password input
      const passwordInput = await driver.findElement(By.id('share-password'));
      await passwordInput.sendKeys('testpassword123');

      // Test update settings
      const updateButton = await driver.findElement(
        By.css('button[onclick*="updateShareSettings"]'),
      );
      await updateButton.click();

      // Close modal
      const closeButton = await driver.findElement(By.css('.modal-close'));
      await closeButton.click();

      // Wait for modal to close
      await driver.wait(
        until.stalenessOf(await driver.findElement(By.id('share-link-modal'))),
        5000,
      );

      // Test shared links section
      await this.waitForElement(driver, By.id('links-list'));
      return { success: true, browser, test: 'sharing-interface' };
    } catch (error) {
      console.error(`❌ Sharing interface test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'sharing-interface-failed', browser);
      return { success: false, browser, test: 'sharing-interface', error: error.message };
    }
  }

  /**
   * Test: Report Templates
   */
  async testReportTemplates(driver, browser) {
    try {
      // Navigate to templates tab
      await driver.get(`${this.config.baseUrl}/export`);

      const templatesTab = await driver.findElement(By.css('button[data-tab="templates"]'));
      await templatesTab.click();

      await this.waitForElement(driver, By.id('templates-tab'));

      // Test create template button
      const createTemplateButton = await driver.findElement(
        By.css('button[onclick*="showCreateTemplateDialog"]'),
      );
      await createTemplateButton.click();

      // Wait for template modal
      await this.waitForElement(driver, By.id('create-template-modal'));

      // Fill in template details
      const templateNameInput = await driver.findElement(By.id('template-name'));
      await templateNameInput.sendKeys('Selenium Test Template');

      const templateDescInput = await driver.findElement(By.id('template-description'));
      await templateDescInput.sendKeys('A template created during Selenium testing');

      // Test format selection
      const templateFormatSelect = await driver.findElement(By.id('template-format'));
      await templateFormatSelect.click();

      const xlsxTemplateOption = await driver.findElement(By.css('option[value="xlsx"]'));
      await xlsxTemplateOption.click();

      // Test category selection
      const categorySelect = await driver.findElement(By.id('template-category'));
      await categorySelect.click();

      const analyticsOption = await driver.findElement(By.css('option[value="analytics"]'));
      await analyticsOption.click();

      // Test field selection
      const templateFieldCheckboxes = await driver.findElements(
        By.css('input[name="template-fields"]'),
      );
      assert(templateFieldCheckboxes.length > 0, 'No template field checkboxes found');

      // Select some fields
      for (let i = 0; i < Math.min(4, templateFieldCheckboxes.length); i++) {
        const checkbox = templateFieldCheckboxes[i];
        if (!(await checkbox.isSelected())) {
          await checkbox.click();
        }
      }

      // Save template
      const saveTemplateButton = await driver.findElement(
        By.css('button[onclick*="saveTemplate"]'),
      );
      await saveTemplateButton.click();

      // Wait for modal to close and template to appear
      await driver.wait(
        until.stalenessOf(await driver.findElement(By.id('create-template-modal'))),
        5000,
      );

      // Check templates grid
      await this.waitForElement(driver, By.id('templates-grid'));

      // Test import template button
      const importTemplateButton = await driver.findElement(
        By.css('button[onclick*="importTemplate"]'),
      );
      await importTemplateButton.click();
      return { success: true, browser, test: 'report-templates' };
    } catch (error) {
      console.error(`❌ Report templates test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'report-templates-failed', browser);
      return { success: false, browser, test: 'report-templates', error: error.message };
    }
  }

  /**
   * Test: Job Collections
   */
  async testJobCollections(driver, browser) {
    try {
      // Navigate to collections tab
      await driver.get(`${this.config.baseUrl}/export`);

      const collectionsTab = await driver.findElement(By.css('button[data-tab="collections"]'));
      await collectionsTab.click();

      await this.waitForElement(driver, By.id('collections-tab'));

      // Test create collection
      const createCollectionButton = await driver.findElement(
        By.css('button[onclick*="showCreateCollectionDialog"]'),
      );
      await createCollectionButton.click();

      await this.waitForElement(driver, By.id('create-collection-modal'));

      // Fill collection details
      const collectionNameInput = await driver.findElement(By.id('collection-name'));
      await collectionNameInput.sendKeys('Selenium Test Collection');

      const collectionDescInput = await driver.findElement(By.id('collection-description'));
      await collectionDescInput.sendKeys('A job collection created during Selenium testing');

      // Test visibility setting
      const visibilitySelect = await driver.findElement(By.id('collection-visibility'));
      await visibilitySelect.click();

      const publicOption = await driver.findElement(By.css('option[value="public"]'));
      await publicOption.click();

      // Test tags
      const tagsInput = await driver.findElement(By.id('collection-tags'));
      await tagsInput.sendKeys('selenium, testing, automation');

      // Save collection
      const saveCollectionButton = await driver.findElement(
        By.css('button[onclick*="saveCollection"]'),
      );
      await saveCollectionButton.click();

      // Wait for modal to close
      await driver.wait(
        until.stalenessOf(await driver.findElement(By.id('create-collection-modal'))),
        5000,
      );

      // Check collections grid
      await this.waitForElement(driver, By.id('collections-grid'));

      // Test import jobs button
      const importJobsButton = await driver.findElement(By.css('button[onclick*="importJobs"]'));
      await importJobsButton.click();
      return { success: true, browser, test: 'job-collections' };
    } catch (error) {
      console.error(`❌ Job collections test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'job-collections-failed', browser);
      return { success: false, browser, test: 'job-collections', error: error.message };
    }
  }

  /**
   * Test: Tab Navigation
   */
  async testTabNavigation(driver, browser) {
    try {
      await driver.get(`${this.config.baseUrl}/export`);

      const tabs = [
        { tab: 'export', content: 'export-tab' },
        { tab: 'sharing', content: 'sharing-tab' },
        { tab: 'templates', content: 'templates-tab' },
        { tab: 'collections', content: 'collections-tab' },
      ];

      for (const { tab, content } of tabs) {
        // Click tab
        const tabButton = await driver.findElement(By.css(`button[data-tab="${tab}"]`));
        await tabButton.click();

        // Wait for content to be visible
        await this.waitForElement(driver, By.id(content));

        // Check tab is active
        const isActive = await tabButton.getAttribute('class');
        assert(isActive.includes('active'), `Tab ${tab} not marked as active`);

        // Check content is visible
        const contentElement = await driver.findElement(By.id(content));
        const isVisible = await contentElement.isDisplayed();
        assert(isVisible, `Content for ${tab} tab not visible`);
      }
      return { success: true, browser, test: 'tab-navigation' };
    } catch (error) {
      console.error(`❌ Tab navigation test failed (${browser}):`, error.message);
      await this.takeScreenshot(driver, 'tab-navigation-failed', browser);
      return { success: false, browser, test: 'tab-navigation', error: error.message };
    }
  }

  /**
   * Run all tests for a browser
   */
  async runTestsForBrowser(browser) {
    const driver = this.drivers.get(browser);
    if (!driver) {
      console.error(`❌ No driver found for ${browser}`);
      return;
    }

    const tests = [
      () => this.testExportInterfaceLoading(driver, browser),
      () => this.testQuickExportFunctionality(driver, browser),
      () => this.testCustomExportForm(driver, browser),
      () => this.testSharingInterface(driver, browser),
      () => this.testReportTemplates(driver, browser),
      () => this.testJobCollections(driver, browser),
      () => this.testTabNavigation(driver, browser),
    ];

    for (const test of tests) {
      try {
        const result = await test();
        this.testResults.push(result);
      } catch (error) {
        console.error('❌ Test execution error:', error.message);
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
    try {
      await this.setupDrivers();

      for (const browser of this.config.browsers) {
        await this.runTestsForBrowser(browser);
      }

      this.generateTestReport();
    } catch (error) {
      console.error('❌ Test suite execution error:', error.message);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Generate test report
   */
  generateTestReport() {
    const summary = {
      total: this.testResults.length,
      passed: this.testResults.filter((r) => r.success).length,
      failed: this.testResults.filter((r) => !r.success).length,
    };

    const failedTests = this.testResults.filter((r) => !r.success);
    if (failedTests.length > 0) {
      for (const _failed of failedTests) {
      }
    }

    // Save report
    const reportPath = path.join(__dirname, 'export-sharing-selenium-report.json');
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

    return summary;
  }
}

// Export for use in test runner
module.exports = ExportSharingSeleniumTests;

// Run if called directly
if (require.main === module) {
  (async () => {
    const testSuite = new ExportSharingSeleniumTests();
    await testSuite.runAllTests();

    const failedTests = testSuite.testResults.filter((r) => !r.success);
    process.exit(failedTests.length > 0 ? 1 : 0);
  })();
}
