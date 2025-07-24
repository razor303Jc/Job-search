#!/usr/bin/env node
/**
 * Comprehensive Security Testing Suite
 * 
 * Integrates multiple security testing tools:
 * - Snyk: Dependency vulnerability scanning
 * - OWASP ZAP: Dynamic application security testing
 * - Custom security tests: XSS, CSRF, input validation
 * 
 * Usage: node tests/security/security-test-suite.js [mode]
 * Modes: quick, standard, comprehensive
 */

import { spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SecurityTestSuite {
  constructor(mode = 'standard') {
    this.mode = mode;
    this.results = {
      snyk: null,
      zap: null,
      customTests: null,
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    };
    this.reportsDir = path.join(__dirname, 'reports');
    this.timestamp = Date.now();
  }

  async ensureReportsDir() {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      console.log('Reports directory already exists');
    }
  }

  async runSnykScan() {
    console.log('🔍 Running Snyk vulnerability scan...');
    
    try {
      const snykResult = await this.executeCommand('npx snyk test --json');
      const snykData = JSON.parse(snykResult.stdout || '{}');
      
      this.results.snyk = {
        vulnerabilities: snykData.vulnerabilities || [],
        summary: snykData.summary || {},
        status: snykResult.code === 0 ? 'passed' : 'failed'
      };

      if (this.results.snyk.vulnerabilities.length === 0) {
        console.log('   ✅ No vulnerabilities found in dependencies');
        this.results.summary.passed++;
      } else {
        console.log(`   ⚠️  Found ${this.results.snyk.vulnerabilities.length} vulnerabilities`);
        this.results.summary.failed++;
        
        // Count severity levels
        this.results.snyk.vulnerabilities.forEach(vuln => {
          switch (vuln.severity) {
            case 'critical': this.results.summary.critical++; break;
            case 'high': this.results.summary.high++; break;
            case 'medium': this.results.summary.medium++; break;
            case 'low': this.results.summary.low++; break;
          }
        });
      }

      this.results.summary.totalTests++;

    } catch (error) {
      console.log(`   ❌ Snyk scan failed: ${error.message}`);
      this.results.snyk = { status: 'error', error: error.message };
      this.results.summary.failed++;
      this.results.summary.totalTests++;
    }
  }

  async runZapScan() {
    console.log('🕷️  Running OWASP ZAP security scan...');
    
    try {
      // Check if application is running
      const isRunning = await this.checkApplicationHealth();
      if (!isRunning) {
        throw new Error('Application not running. Start with: npm run start:web');
      }

      // Run ZAP baseline scan
      const zapResult = await this.executeCommand(
        `/snap/bin/zaproxy -cmd -quickurl http://localhost:3000 -quickout ${path.join(this.reportsDir, `zap-report-${this.timestamp}.html`)}`,
        { timeout: 60000 }
      );

      this.results.zap = {
        status: zapResult.code === 0 ? 'passed' : 'warning',
        reportPath: path.join(this.reportsDir, `zap-report-${this.timestamp}.html`),
        stdout: zapResult.stdout,
        stderr: zapResult.stderr
      };

      if (zapResult.code === 0) {
        console.log('   ✅ ZAP scan completed successfully');
        this.results.summary.passed++;
      } else {
        console.log('   ⚠️  ZAP scan completed with warnings');
        this.results.summary.warnings++;
      }

      this.results.summary.totalTests++;

    } catch (error) {
      console.log(`   ❌ ZAP scan failed: ${error.message}`);
      this.results.zap = { status: 'error', error: error.message };
      this.results.summary.failed++;
      this.results.summary.totalTests++;
    }
  }

  async runCustomSecurityTests() {
    console.log('🛡️  Running custom security tests...');
    
    try {
      // Run our existing security tests via npm
      const testResult = await this.executeCommand('npm run test:security');
      
      this.results.customTests = {
        status: testResult.code === 0 ? 'passed' : 'failed',
        output: testResult.stdout,
        errors: testResult.stderr
      };

      if (testResult.code === 0) {
        console.log('   ✅ Custom security tests passed');
        this.results.summary.passed++;
      } else {
        console.log('   ❌ Custom security tests failed');
        this.results.summary.failed++;
      }

      this.results.summary.totalTests++;

    } catch (error) {
      console.log(`   ❌ Custom security tests failed: ${error.message}`);
      this.results.customTests = { status: 'error', error: error.message };
      this.results.summary.failed++;
      this.results.summary.totalTests++;
    }
  }

  async checkApplicationHealth() {
    try {
      const healthCheck = await this.executeCommand('curl -f http://localhost:3000/health', { timeout: 5000 });
      return healthCheck.code === 0;
    } catch (error) {
      try {
        // Try alternative port
        const healthCheck2 = await this.executeCommand('curl -f http://localhost:3001/health', { timeout: 5000 });
        return healthCheck2.code === 0;
      } catch (error2) {
        return false;
      }
    }
  }

  async executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const timeout = options.timeout || 30000;
      
      exec(command, { timeout }, (error, stdout, stderr) => {
        resolve({
          code: error ? error.code || 1 : 0,
          stdout: stdout || '',
          stderr: stderr || '',
          error
        });
      });
    });
  }

  async generateReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      mode: this.mode,
      results: this.results,
      summary: this.results.summary
    };

    // Generate JSON report
    const jsonReport = path.join(this.reportsDir, `security-report-${this.timestamp}.json`);
    await fs.writeFile(jsonReport, JSON.stringify(reportData, null, 2));

    // Generate HTML report
    const htmlReport = await this.generateHtmlReport(reportData);
    const htmlReportPath = path.join(this.reportsDir, `security-report-${this.timestamp}.html`);
    await fs.writeFile(htmlReportPath, htmlReport);

    return { jsonReport, htmlReportPath };
  }

  async generateHtmlReport(data) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Test Report - ${data.timestamp}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; border-left: 4px solid #007bff; }
        .metric.success { border-left-color: #28a745; }
        .metric.warning { border-left-color: #ffc107; }
        .metric.danger { border-left-color: #dc3545; }
        .metric h3 { margin: 0 0 10px 0; font-size: 24px; }
        .metric p { margin: 0; color: #666; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .test-result { background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 15px; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 4px; color: white; font-weight: bold; }
        .status.passed { background: #28a745; }
        .status.failed { background: #dc3545; }
        .status.warning { background: #ffc107; color: #333; }
        .status.error { background: #6c757d; }
        pre { background: #f1f1f1; padding: 10px; border-radius: 4px; overflow-x: auto; }
        .vulnerability { background: #fff3cd; padding: 10px; margin: 10px 0; border-left: 4px solid #ffc107; border-radius: 4px; }
        .vulnerability.critical { background: #f8d7da; border-left-color: #dc3545; }
        .vulnerability.high { background: #f8d7da; border-left-color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ Security Test Report</h1>
            <p>Generated: ${data.timestamp} | Mode: ${data.mode}</p>
        </div>

        <div class="summary">
            <div class="metric ${data.summary.totalTests > 0 ? 'success' : 'warning'}">
                <h3>${data.summary.totalTests}</h3>
                <p>Total Tests</p>
            </div>
            <div class="metric ${data.summary.passed > 0 ? 'success' : 'warning'}">
                <h3>${data.summary.passed}</h3>
                <p>Passed</p>
            </div>
            <div class="metric ${data.summary.failed > 0 ? 'danger' : 'success'}">
                <h3>${data.summary.failed}</h3>
                <p>Failed</p>
            </div>
            <div class="metric ${data.summary.warnings > 0 ? 'warning' : 'success'}">
                <h3>${data.summary.warnings}</h3>
                <p>Warnings</p>
            </div>
            <div class="metric ${data.summary.critical > 0 ? 'danger' : 'success'}">
                <h3>${data.summary.critical}</h3>
                <p>Critical</p>
            </div>
            <div class="metric ${data.summary.high > 0 ? 'danger' : 'success'}">
                <h3>${data.summary.high}</h3>
                <p>High Risk</p>
            </div>
        </div>

        <div class="section">
            <h2>🔍 Snyk Dependency Scan</h2>
            <div class="test-result">
                <span class="status ${data.results.snyk?.status || 'error'}">${data.results.snyk?.status || 'error'}</span>
                <h3>Dependency Vulnerability Scan</h3>
                ${data.results.snyk?.vulnerabilities ? 
                  `<p>Found ${data.results.snyk.vulnerabilities.length} vulnerabilities</p>` :
                  '<p>No vulnerabilities detected in dependencies</p>'
                }
                ${data.results.snyk?.error ? `<pre>Error: ${data.results.snyk.error}</pre>` : ''}
            </div>
        </div>

        <div class="section">
            <h2>🕷️ OWASP ZAP Scan</h2>
            <div class="test-result">
                <span class="status ${data.results.zap?.status || 'error'}">${data.results.zap?.status || 'error'}</span>
                <h3>Dynamic Application Security Testing</h3>
                ${data.results.zap?.reportPath ? 
                  `<p>Report generated: ${data.results.zap.reportPath}</p>` :
                  '<p>ZAP scan report not available</p>'
                }
                ${data.results.zap?.error ? `<pre>Error: ${data.results.zap.error}</pre>` : ''}
            </div>
        </div>

        <div class="section">
            <h2>🛡️ Custom Security Tests</h2>
            <div class="test-result">
                <span class="status ${data.results.customTests?.status || 'error'}">${data.results.customTests?.status || 'error'}</span>
                <h3>XSS, Input Validation, Rate Limiting Tests</h3>
                <p>Custom security test suite covering application-specific vulnerabilities</p>
                ${data.results.customTests?.error ? `<pre>Error: ${data.results.customTests.error}</pre>` : ''}
            </div>
        </div>

        <div class="section">
            <h2>📊 Overall Security Score</h2>
            <div class="test-result">
                ${this.calculateSecurityScore(data.summary)}
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  calculateSecurityScore(summary) {
    const totalIssues = summary.critical + summary.high + summary.medium + summary.low + summary.failed;
    const totalTests = summary.totalTests;
    
    if (totalTests === 0) return '<p>No tests executed</p>';
    
    const passRate = (summary.passed / totalTests) * 100;
    let scoreClass = 'success';
    let scoreText = 'Excellent';
    
    if (totalIssues > 0 || passRate < 80) {
      scoreClass = 'danger';
      scoreText = 'Needs Attention';
    } else if (summary.warnings > 0 || passRate < 95) {
      scoreClass = 'warning';
      scoreText = 'Good';
    }
    
    return `
      <span class="status ${scoreClass}">${scoreText}</span>
      <h3>Security Score: ${passRate.toFixed(1)}%</h3>
      <p>Pass Rate: ${summary.passed}/${totalTests} tests passed</p>
      ${totalIssues > 0 ? `<p>Total Issues: ${totalIssues}</p>` : ''}
    `;
  }

  async run() {
    console.log(`🚀 Starting Security Test Suite (${this.mode} mode)`);
    console.log('='.repeat(60));

    await this.ensureReportsDir();

    // Run all security tests
    await this.runSnykScan();
    await this.runZapScan();
    await this.runCustomSecurityTests();

    // Generate reports
    const reports = await this.generateReport();

    console.log('\n📊 SECURITY TEST SUMMARY');
    console.log('='.repeat(30));
    console.log(`Total Tests: ${this.results.summary.totalTests}`);
    console.log(`Passed: ${this.results.summary.passed}`);
    console.log(`Failed: ${this.results.summary.failed}`);
    console.log(`Warnings: ${this.results.summary.warnings}`);
    console.log(`Critical Issues: ${this.results.summary.critical}`);
    console.log(`High Issues: ${this.results.summary.high}`);
    console.log(`Medium Issues: ${this.results.summary.medium}`);
    console.log(`Low Issues: ${this.results.summary.low}`);

    console.log('\n📄 Reports Generated:');
    console.log(`   JSON: ${reports.jsonReport}`);
    console.log(`   HTML: ${reports.htmlReportPath}`);

    const hasIssues = this.results.summary.failed > 0 || this.results.summary.critical > 0;
    if (hasIssues) {
      console.log('\n❌ Security issues detected - review reports for details');
      process.exit(1);
    } else {
      console.log('\n✅ All security tests passed!');
      process.exit(0);
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2] || 'standard';
  const suite = new SecurityTestSuite(mode);
  suite.run().catch(error => {
    console.error('❌ Security test suite failed:', error);
    process.exit(1);
  });
}

export default SecurityTestSuite;
