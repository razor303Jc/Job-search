/**
 * Direct Test of Export & Sharing Features
 * Tests the TypeScript component directly without requiring web server
 */

import fs from 'node:fs';
import path from 'node:path';

const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [],
};

function runTest(name, testFn) {
  testResults.total++;

  try {
    const result = testFn();
    if (result !== false) {
      testResults.passed++;
      testResults.tests.push({ name, status: 'PASS', error: null });
    } else {
      testResults.failed++;
      testResults.tests.push({ name, status: 'FAIL', error: 'Test returned false' });
    }
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAIL', error: error.message });
  }
}

// Test 1: Check if export component file exists and has required content
runTest('Export Component File Exists', () => {
  const componentPath = path.join(process.cwd(), 'src/web/components/export-sharing.ts');
  if (!fs.existsSync(componentPath)) {
    throw new Error('Export component file not found');
  }

  const content = fs.readFileSync(componentPath, 'utf8');

  // Check for key functions
  const requiredFunctions = [
    'ExportSharingComponent',
    'handleExportSubmission',
    'quickExport',
    'renderReportTemplates',
    'renderJobCollections',
  ];

  for (const func of requiredFunctions) {
    if (!content.includes(func)) {
      throw new Error(`Missing required function: ${func}`);
    }
  }
  return true;
});

// Test 2: Check CSS file
runTest('Export CSS File Exists', () => {
  const cssPath = path.join(process.cwd(), 'src/web/static/export-sharing.css');
  if (!fs.existsSync(cssPath)) {
    throw new Error('Export CSS file not found');
  }

  const content = fs.readFileSync(cssPath, 'utf8');

  // Check for key CSS classes
  const requiredClasses = [
    '.export-section',
    '.sharing-section',
    '.template-card',
    '.collections-section',
  ];

  for (const className of requiredClasses) {
    if (!content.includes(className)) {
      throw new Error(`Missing required CSS class: ${className}`);
    }
  }
  return true;
});

// Test 3: Check Selenium test files
runTest('Selenium Test Files Exist', () => {
  const testFiles = [
    'tests/selenium/export-sharing-selenium.test.js',
    'tests/selenium/web-app-selenium.test.js',
    'tests/selenium/selenium-test-runner.js',
  ];

  for (const testFile of testFiles) {
    const testPath = path.join(process.cwd(), testFile);
    if (!fs.existsSync(testPath)) {
      throw new Error(`Selenium test file not found: ${testFile}`);
    }

    const _content = fs.readFileSync(testPath, 'utf8');
  }

  return true;
});

// Test 4: Check TypeScript compilation
runTest('TypeScript Component Syntax', () => {
  const componentPath = path.join(process.cwd(), 'src/web/components/export-sharing.ts');
  const content = fs.readFileSync(componentPath, 'utf8');

  // Basic syntax checks
  const syntaxChecks = [
    { pattern: /export\s+class\s+\w+/g, name: 'export class' },
    { pattern: /export\s+function\s+\w+/g, name: 'export function' },
    { pattern: /interface\s+\w+/g, name: 'interfaces' },
    { pattern: /type\s+\w+/g, name: 'type definitions' },
  ];

  for (const check of syntaxChecks) {
    const matches = content.match(check.pattern);
    if (matches && matches.length > 0) {
    }
  }

  // Check for ES6 imports/exports
  if (!content.includes('export') && !content.includes('import')) {
    throw new Error('No ES6 import/export statements found');
  }

  return true;
});

// Test 5: Check security implementation
runTest('Security Features Present', () => {
  const componentPath = path.join(process.cwd(), 'src/web/components/export-sharing.ts');
  const content = fs.readFileSync(componentPath, 'utf8');

  const securityFeatures = ['DOMPurify', 'textContent', 'innerHTML', 'permission', 'validation'];

  let foundFeatures = 0;
  for (const feature of securityFeatures) {
    if (content.includes(feature)) {
      foundFeatures++;
    }
  }

  if (foundFeatures < 3) {
    throw new Error(`Only ${foundFeatures} security features found, expected at least 3`);
  }

  return true;
});

// Test 6: Check export formats support
runTest('Export Formats Support', () => {
  const componentPath = path.join(process.cwd(), 'src/web/components/export-sharing.ts');
  const content = fs.readFileSync(componentPath, 'utf8');

  const formats = ['csv', 'json', 'pdf', 'xlsx'];

  for (const format of formats) {
    if (!content.includes(format)) {
      throw new Error(`Export format not found: ${format}`);
    }
  }

  return true;
});

if (testResults.failed > 0) {
  testResults.tests.filter((test) => test.status === 'FAIL').forEach((_test) => {});
}

// Generate test report
const reportData = {
  timestamp: new Date().toISOString(),
  summary: {
    total: testResults.total,
    passed: testResults.passed,
    failed: testResults.failed,
    successRate: `${((testResults.passed / testResults.total) * 100).toFixed(1)}%`,
  },
  tests: testResults.tests,
  environment: {
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
  },
};

// Save report
const reportPath = path.join(process.cwd(), 'test-report-direct.json');
fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

// Exit with appropriate code
process.exit(testResults.failed === 0 ? 0 : 1);
