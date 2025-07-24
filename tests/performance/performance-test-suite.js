/**
 * Complete Performance Testing Suite Runner
 * Orchestrates all performance and stress testing scenarios
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PerformanceBenchmark } from './benchmark-stress-tests.js';
import { LoadTester } from './load-endurance-tests.js';
import { ResourceMonitor } from './resource-monitor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUITE_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testSuites: {
    quick: {
      description: 'Quick performance validation',
      includes: ['benchmark', 'basic-stress'],
      duration: '5-10 minutes'
    },
    standard: {
      description: 'Standard performance testing',
      includes: ['benchmark', 'stress', 'load'],
      duration: '15-25 minutes'
    },
    comprehensive: {
      description: 'Full performance analysis',
      includes: ['benchmark', 'stress', 'load', 'endurance'],
      duration: '45-75 minutes'
    }
  },
  healthCheck: {
    timeout: 5000,
    retries: 3
  },
  reporting: {
    generateCombined: true,
    includeResourceMetrics: true,
    exportFormats: ['json', 'html', 'csv']
  }
};

class PerformanceTestSuite {
  constructor(options = {}) {
    this.suiteLevel = options.suiteLevel || 'standard';
    this.config = SUITE_CONFIG;
    this.results = {
      benchmark: null,
      stress: null,
      load: null,
      endurance: null,
      healthChecks: [],
      resourceMetrics: []
    };
    this.startTime = null;
    this.endTime = null;
    this.errors = [];
    
    // Create reports directory
    this.reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Pre-flight health check
   */
  async performHealthCheck() {
    console.log('🏥 Performing pre-flight health check...');
    
    const healthEndpoints = [
      { url: `${this.config.baseUrl}/`, name: 'Homepage' },
      { url: `${this.config.baseUrl}/health`, name: 'Health Endpoint' },
      { url: `${this.config.baseUrl}/api/v1/jobs`, name: 'Jobs API' }
    ];

    const healthResults = [];

    for (const endpoint of healthEndpoints) {
      let attempts = 0;
      let success = false;
      let lastError = null;

      while (attempts < this.config.healthCheck.retries && !success) {
        attempts++;
        
        try {
          const startTime = Date.now();
          const response = await fetch(endpoint.url, {
            signal: AbortSignal.timeout(this.config.healthCheck.timeout)
          });
          const responseTime = Date.now() - startTime;

          if (response.ok) {
            success = true;
            healthResults.push({
              endpoint: endpoint.name,
              url: endpoint.url,
              status: 'healthy',
              responseTime,
              statusCode: response.status,
              attempt: attempts
            });
            console.log(`   ✅ ${endpoint.name}: ${response.status} (${responseTime}ms)`);
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          lastError = error.message;
          if (attempts < this.config.healthCheck.retries) {
            console.log(`   ⚠️  ${endpoint.name}: ${error.message} (attempt ${attempts}/${this.config.healthCheck.retries})`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
          }
        }
      }

      if (!success) {
        healthResults.push({
          endpoint: endpoint.name,
          url: endpoint.url,
          status: 'unhealthy',
          error: lastError,
          attempts
        });
        console.log(`   ❌ ${endpoint.name}: Failed after ${attempts} attempts - ${lastError}`);
      }
    }

    this.results.healthChecks = healthResults;
    
    const healthyEndpoints = healthResults.filter(r => r.status === 'healthy').length;
    const totalEndpoints = healthResults.length;
    
    if (healthyEndpoints === 0) {
      throw new Error('❌ Health check failed: No endpoints are accessible');
    } else if (healthyEndpoints < totalEndpoints) {
      console.log(`⚠️  Warning: ${totalEndpoints - healthyEndpoints}/${totalEndpoints} endpoints are unhealthy`);
    } else {
      console.log(`✅ Health check passed: All ${totalEndpoints} endpoints are healthy`);
    }

    return healthResults;
  }

  /**
   * Run benchmark tests
   */
  async runBenchmarkTests() {
    console.log('\n📊 Running Performance Benchmark Tests');
    console.log('======================================');

    try {
      const benchmark = new PerformanceBenchmark();
      const benchmarkResults = await benchmark.runBenchmarks();
      
      this.results.benchmark = {
        results: benchmarkResults,
        summary: benchmark.calculateBenchmarkSummary(benchmarkResults),
        timestamp: new Date().toISOString()
      };

      console.log('✅ Benchmark tests completed successfully');
      return this.results.benchmark;
    } catch (error) {
      console.error('❌ Benchmark tests failed:', error.message);
      this.errors.push({ test: 'benchmark', error: error.message });
      throw error;
    }
  }

  /**
   * Run stress tests
   */
  async runStressTests() {
    console.log('\n💥 Running Stress Tests');
    console.log('=======================');

    try {
      const benchmark = new PerformanceBenchmark();
      const stressResults = await benchmark.runStressTests();
      
      this.results.stress = {
        results: stressResults,
        summary: benchmark.calculateStressSummary(stressResults),
        timestamp: new Date().toISOString()
      };

      console.log('✅ Stress tests completed successfully');
      return this.results.stress;
    } catch (error) {
      console.error('❌ Stress tests failed:', error.message);
      this.errors.push({ test: 'stress', error: error.message });
      throw error;
    }
  }

  /**
   * Run load tests
   */
  async runLoadTests() {
    console.log('\n🚀 Running Load Tests');
    console.log('=====================');

    try {
      const loadTester = new LoadTester();
      const loadResults = await loadTester.runAllLoadTests();
      
      this.results.load = {
        results: loadResults.testResults,
        summary: loadResults.summary,
        timestamp: new Date().toISOString()
      };

      console.log('✅ Load tests completed successfully');
      return this.results.load;
    } catch (error) {
      console.error('❌ Load tests failed:', error.message);
      this.errors.push({ test: 'load', error: error.message });
      throw error;
    }
  }

  /**
   * Run endurance tests (only in comprehensive mode)
   */
  async runEnduranceTests() {
    console.log('\n💪 Running Endurance Tests');
    console.log('==========================');

    try {
      const loadTester = new LoadTester();
      const enduranceResult = await loadTester.runEnduranceTest();
      
      this.results.endurance = {
        result: enduranceResult,
        timestamp: new Date().toISOString()
      };

      console.log('✅ Endurance tests completed successfully');
      return this.results.endurance;
    } catch (error) {
      console.error('❌ Endurance tests failed:', error.message);
      this.errors.push({ test: 'endurance', error: error.message });
      throw error;
    }
  }

  /**
   * Generate comprehensive report
   */
  generateComprehensiveReport() {
    const report = {
      metadata: {
        suiteLevel: this.suiteLevel,
        timestamp: new Date().toISOString(),
        startTime: this.startTime,
        endTime: this.endTime,
        duration: this.endTime ? Math.round((this.endTime - this.startTime) / 1000) : null,
        configuration: this.config
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
        baseUrl: this.config.baseUrl
      },
      healthChecks: this.results.healthChecks,
      testResults: this.results,
      errors: this.errors,
      summary: this.calculateOverallSummary()
    };

    // Save JSON report
    const timestamp = Date.now();
    const jsonReportPath = path.join(this.reportsDir, `performance-suite-${timestamp}.json`);
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHtmlReport(report);
    const htmlReportPath = path.join(this.reportsDir, `performance-suite-${timestamp}.html`);
    fs.writeFileSync(htmlReportPath, htmlReport);

    // Generate CSV summary
    const csvReport = this.generateCsvReport(report);
    const csvReportPath = path.join(this.reportsDir, `performance-suite-${timestamp}.csv`);
    fs.writeFileSync(csvReportPath, csvReport);

    console.log('\n📊 PERFORMANCE SUITE SUMMARY');
    console.log('============================');
    console.log(`Suite Level: ${this.suiteLevel}`);
    console.log(`Total Duration: ${report.metadata.duration}s`);
    console.log(`Tests Completed: ${Object.keys(this.results).filter(k => this.results[k] !== null).length}`);
    console.log(`Errors: ${this.errors.length}`);
    
    if (report.summary.overallPerformance) {
      console.log(`Overall Performance Rating: ${report.summary.overallPerformance.rating}`);
      console.log(`Peak Throughput: ${report.summary.overallPerformance.peakThroughput} req/s`);
      console.log(`Average Error Rate: ${report.summary.overallPerformance.avgErrorRate}%`);
    }

    console.log(`\n📄 Reports Generated:`);
    console.log(`   JSON: ${jsonReportPath}`);
    console.log(`   HTML: ${htmlReportPath}`);
    console.log(`   CSV:  ${csvReportPath}`);

    return report;
  }

  calculateOverallSummary() {
    const summary = {
      testsRun: Object.keys(this.results).filter(k => this.results[k] !== null),
      totalErrors: this.errors.length,
      healthStatus: this.results.healthChecks.every(h => h.status === 'healthy') ? 'healthy' : 'degraded'
    };

    // Calculate overall performance metrics
    const performanceMetrics = [];

    if (this.results.benchmark?.results) {
      performanceMetrics.push(...this.results.benchmark.results.map(r => ({
        type: 'benchmark',
        throughput: r.throughput,
        errorRate: r.errorRate,
        avgResponseTime: r.avgResponseTime
      })));
    }

    if (this.results.stress?.results) {
      performanceMetrics.push(...this.results.stress.results.map(r => ({
        type: 'stress',
        throughput: r.throughput,
        errorRate: r.errorRate,
        avgResponseTime: r.avgResponseTime
      })));
    }

    if (this.results.load?.results) {
      this.results.load.results.forEach(result => {
        if (result.overallStats) {
          performanceMetrics.push({
            type: 'load',
            throughput: result.overallStats.throughput,
            errorRate: result.overallStats.errorRate,
            avgResponseTime: result.overallStats.avgResponseTime
          });
        }
      });
    }

    if (performanceMetrics.length > 0) {
      const peakThroughput = Math.max(...performanceMetrics.map(m => m.throughput));
      const avgErrorRate = performanceMetrics.reduce((sum, m) => sum + m.errorRate, 0) / performanceMetrics.length;
      const avgResponseTime = performanceMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / performanceMetrics.length;

      // Performance rating
      let rating = 'excellent';
      if (avgErrorRate > 5 || avgResponseTime > 1000) rating = 'poor';
      else if (avgErrorRate > 1 || avgResponseTime > 500) rating = 'fair';
      else if (avgErrorRate > 0.1 || avgResponseTime > 200) rating = 'good';

      summary.overallPerformance = {
        rating,
        peakThroughput: Math.round(peakThroughput * 100) / 100,
        avgErrorRate: Math.round(avgErrorRate * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        totalTests: performanceMetrics.length
      };
    }

    return summary;
  }

  generateHtmlReport(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Suite Report - Job Dorker</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; background: #f5f7fa; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 32px; font-weight: 300; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .overview-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .overview-card h3 { margin: 0 0 10px 0; color: #333; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
        .overview-card .value { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
        .excellent { color: #27ae60; }
        .good { color: #2ecc71; }
        .fair { color: #f39c12; }
        .poor { color: #e74c3c; }
        .section { background: white; margin-bottom: 20px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section-header { background: #f8f9fa; padding: 20px; border-bottom: 1px solid #dee2e6; }
        .section-header h2 { margin: 0; color: #495057; }
        .section-content { padding: 20px; }
        .health-check { display: flex; align-items: center; padding: 10px; margin: 5px 0; border-radius: 5px; }
        .health-check.healthy { background: #d4edda; color: #155724; }
        .health-check.unhealthy { background: #f8d7da; color: #721c24; }
        .test-results { display: grid; gap: 20px; }
        .test-result { border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; }
        .test-result-header { background: #f8f9fa; padding: 15px; font-weight: bold; }
        .test-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; padding: 20px; }
        .metric { text-align: center; }
        .metric .label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
        .metric .value { font-size: 18px; font-weight: bold; }
        .error-list { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 15px; margin-top: 20px; }
        .error-item { margin-bottom: 10px; padding: 10px; background: white; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background: #f8f9fa; font-weight: 600; }
        .status-badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .status-healthy { background: #d4edda; color: #155724; }
        .status-unhealthy { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Performance Test Suite Report</h1>
            <p>Job Dorker Application | Suite Level: ${report.metadata.suiteLevel}</p>
            <p>Generated: ${new Date(report.metadata.timestamp).toLocaleString()}</p>
            ${report.metadata.duration ? `<p>Duration: ${report.metadata.duration} seconds</p>` : ''}
        </div>

        <div class="overview">
            <div class="overview-card">
                <h3>Health Status</h3>
                <div class="value ${report.summary.healthStatus === 'healthy' ? 'excellent' : 'poor'}">${report.summary.healthStatus.toUpperCase()}</div>
                <div>${report.healthChecks.filter(h => h.status === 'healthy').length}/${report.healthChecks.length} endpoints</div>
            </div>
            <div class="overview-card">
                <h3>Tests Completed</h3>
                <div class="value">${report.summary.testsRun.length}</div>
                <div>${report.summary.testsRun.join(', ')}</div>
            </div>
            ${report.summary.overallPerformance ? `
            <div class="overview-card">
                <h3>Performance Rating</h3>
                <div class="value ${report.summary.overallPerformance.rating}">${report.summary.overallPerformance.rating.toUpperCase()}</div>
                <div>${report.summary.overallPerformance.peakThroughput} req/s peak</div>
            </div>
            <div class="overview-card">
                <h3>Error Rate</h3>
                <div class="value ${report.summary.overallPerformance.avgErrorRate < 1 ? 'excellent' : report.summary.overallPerformance.avgErrorRate < 5 ? 'good' : 'poor'}">${report.summary.overallPerformance.avgErrorRate}%</div>
                <div>Average across all tests</div>
            </div>
            ` : ''}
        </div>

        <div class="section">
            <div class="section-header">
                <h2>🏥 Health Check Results</h2>
            </div>
            <div class="section-content">
                ${report.healthChecks.map(check => `
                <div class="health-check ${check.status}">
                    <strong>${check.endpoint}</strong>: ${check.status}
                    ${check.responseTime ? ` (${check.responseTime}ms)` : ''}
                    ${check.error ? ` - ${check.error}` : ''}
                </div>
                `).join('')}
            </div>
        </div>

        ${Object.entries(report.testResults).filter(([key, value]) => value !== null).map(([testType, result]) => `
        <div class="section">
            <div class="section-header">
                <h2>${this.getTestTypeIcon(testType)} ${this.getTestTypeTitle(testType)} Results</h2>
            </div>
            <div class="section-content">
                ${this.generateTestSectionHtml(testType, result)}
            </div>
        </div>
        `).join('')}

        ${report.errors.length > 0 ? `
        <div class="section">
            <div class="section-header">
                <h2>❌ Errors Encountered</h2>
            </div>
            <div class="section-content">
                <div class="error-list">
                    ${report.errors.map(error => `
                    <div class="error-item">
                        <strong>${error.test}:</strong> ${error.error}
                    </div>
                    `).join('')}
                </div>
            </div>
        </div>
        ` : ''}

        <div class="section">
            <div class="section-header">
                <h2>🔧 Test Configuration</h2>
            </div>
            <div class="section-content">
                <table>
                    <tr><td><strong>Base URL</strong></td><td>${report.environment.baseUrl}</td></tr>
                    <tr><td><strong>Node.js Version</strong></td><td>${report.environment.nodeVersion}</td></tr>
                    <tr><td><strong>Platform</strong></td><td>${report.environment.platform} (${report.environment.arch})</td></tr>
                    <tr><td><strong>Suite Level</strong></td><td>${report.metadata.suiteLevel}</td></tr>
                    <tr><td><strong>Test Duration</strong></td><td>${report.metadata.duration ? report.metadata.duration + 's' : 'N/A'}</td></tr>
                </table>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  getTestTypeIcon(type) {
    const icons = {
      benchmark: '📊',
      stress: '💥',
      load: '🚀',
      endurance: '💪'
    };
    return icons[type] || '🧪';
  }

  getTestTypeTitle(type) {
    const titles = {
      benchmark: 'Performance Benchmark',
      stress: 'Stress Testing',
      load: 'Load Testing',
      endurance: 'Endurance Testing'
    };
    return titles[type] || type;
  }

  generateTestSectionHtml(testType, result) {
    // This is a simplified version - you can expand based on the specific result structure
    if (result.summary) {
      return `
      <div class="test-metrics">
          ${Object.entries(result.summary).map(([key, value]) => `
          <div class="metric">
              <div class="label">${key.replace(/([A-Z])/g, ' $1').trim()}</div>
              <div class="value">${typeof value === 'number' ? Math.round(value * 100) / 100 : value}</div>
          </div>
          `).join('')}
      </div>`;
    }
    
    return '<p>Test completed successfully. See JSON report for detailed results.</p>';
  }

  generateCsvReport(report) {
    const rows = [
      ['Test Type', 'Status', 'Throughput (req/s)', 'Avg Response Time (ms)', 'Error Rate (%)', 'Timestamp']
    ];

    // Add benchmark results
    if (report.testResults.benchmark?.results) {
      report.testResults.benchmark.results.forEach(result => {
        rows.push([
          'Benchmark',
          result.successRate > 95 ? 'PASS' : 'FAIL',
          result.throughput,
          result.avgResponseTime,
          result.errorRate,
          result.timestamp
        ]);
      });
    }

    // Add stress results
    if (report.testResults.stress?.results) {
      report.testResults.stress.results.forEach(result => {
        rows.push([
          'Stress',
          result.successRate > 90 ? 'PASS' : 'FAIL',
          result.throughput,
          result.avgResponseTime,
          result.errorRate,
          result.timestamp
        ]);
      });
    }

    // Convert to CSV
    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  /**
   * Run complete test suite based on level
   */
  async runTestSuite() {
    console.log(`🚀 Starting ${this.suiteLevel.toUpperCase()} Performance Test Suite`);
    console.log('='.repeat(50 + this.suiteLevel.length));
    
    this.startTime = Date.now();
    
    try {
      // Pre-flight health check
      await this.performHealthCheck();
      
      const suiteConfig = this.config.testSuites[this.suiteLevel];
      console.log(`\n📋 Test Plan: ${suiteConfig.description}`);
      console.log(`   Estimated Duration: ${suiteConfig.duration}`);
      console.log(`   Included Tests: ${suiteConfig.includes.join(', ')}`);

      // Run tests based on suite level
      if (suiteConfig.includes.includes('benchmark')) {
        await this.runBenchmarkTests();
      }

      if (suiteConfig.includes.includes('stress') || suiteConfig.includes.includes('basic-stress')) {
        await this.runStressTests();
      }

      if (suiteConfig.includes.includes('load')) {
        await this.runLoadTests();
      }

      if (suiteConfig.includes.includes('endurance')) {
        await this.runEnduranceTests();
      }

      this.endTime = Date.now();
      
      // Generate comprehensive report
      const report = this.generateComprehensiveReport();
      
      console.log('\n🎉 Performance test suite completed successfully!');
      console.log(`⏱️  Total execution time: ${Math.round((this.endTime - this.startTime) / 1000)}s`);
      
      return report;
      
    } catch (error) {
      this.endTime = Date.now();
      console.error('\n💥 Performance test suite failed:', error.message);
      
      // Generate report even on failure
      const report = this.generateComprehensiveReport();
      
      throw error;
    }
  }
}

// Export for use as module
export { PerformanceTestSuite };

// Run test suite if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const suiteLevel = process.argv[2] || 'standard';
  const suite = new PerformanceTestSuite({ suiteLevel });
  
  suite.runTestSuite()
    .then(() => {
      console.log('✅ Test suite execution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test suite execution failed:', error.message);
      process.exit(1);
    });
}
