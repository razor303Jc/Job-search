/**
 * Load Testing & Endurance Tests for Job Dorker
 * Extended testing scenarios for sustained load and endurance
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PerformanceBenchmark } from './benchmark-stress-tests.js';
import { ResourceMonitor } from './resource-monitor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOAD_TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  scenarios: {
    sustained: {
      duration: 300000, // 5 minutes
      rampUpTime: 60000, // 1 minute
      steadyStateTime: 180000, // 3 minutes
      rampDownTime: 60000, // 1 minute
      maxConcurrency: 50,
      targetRPS: 100,
    },
    spike: {
      normalLoad: 10,
      spikeLoad: 100,
      spikeDuration: 30000, // 30 seconds
      normalDuration: 60000, // 1 minute
      cycles: 3,
    },
    endurance: {
      duration: 1800000, // 30 minutes
      concurrency: 20,
      targetRPS: 50,
    },
    gradual: {
      startConcurrency: 1,
      maxConcurrency: 100,
      stepSize: 5,
      stepDuration: 30000, // 30 seconds per step
      sustainDuration: 60000, // 1 minute at max load
    },
  },
  endpoints: [
    { path: '/', weight: 40, name: 'Homepage' },
    { path: '/health', weight: 20, name: 'Health Check' },
    { path: '/api/v1/jobs', weight: 25, name: 'Jobs API' },
    { path: '/api/v1/jobs/stats', weight: 10, name: 'Stats API' },
    { path: '/enhanced-dashboard.html', weight: 5, name: 'Dashboard' },
  ],
};

class LoadTester extends PerformanceBenchmark {
  constructor() {
    super();
    this.resourceMonitor = new ResourceMonitor();
    this.loadTestResults = [];
    this.currentTest = null;
  }

  /**
   * Get weighted random endpoint
   */
  getRandomEndpoint() {
    const totalWeight = LOAD_TEST_CONFIG.endpoints.reduce((sum, ep) => sum + ep.weight, 0);
    let random = Math.random() * totalWeight;

    for (const endpoint of LOAD_TEST_CONFIG.endpoints) {
      random -= endpoint.weight;
      if (random <= 0) {
        return `${LOAD_TEST_CONFIG.baseUrl}${endpoint.path}`;
      }
    }

    return `${LOAD_TEST_CONFIG.baseUrl}/`;
  }

  /**
   * Run sustained load test
   */
  async runSustainedLoadTest() {
    const config = LOAD_TEST_CONFIG.scenarios.sustained;
    this.currentTest = 'sustained';

    // Start resource monitoring
    this.resourceMonitor = new ResourceMonitor({
      interval: 2000, // 2 seconds
      duration: config.duration + 10000, // Extra time for cleanup
    });

    await this.resourceMonitor.startMonitoring();

    // Reset metrics
    this.resetMetrics();
    const startTime = Date.now();
    const phaseResults = [];
    const rampUpResult = await this.runRampUpPhase(config.rampUpTime, config.maxConcurrency);
    phaseResults.push({ phase: 'rampUp', ...rampUpResult });
    const steadyResult = await this.runSteadyStatePhase(
      config.steadyStateTime,
      config.maxConcurrency,
    );
    phaseResults.push({ phase: 'steadyState', ...steadyResult });
    const rampDownResult = await this.runRampDownPhase(config.rampDownTime, config.maxConcurrency);
    phaseResults.push({ phase: 'rampDown', ...rampDownResult });

    const totalDuration = Date.now() - startTime;

    // Stop monitoring
    this.resourceMonitor.stopMonitoring();

    const overallStats = this.calculateStats();

    const result = {
      testType: 'sustained',
      totalDuration: totalDuration / 1000,
      phases: phaseResults,
      overallStats,
      resourceUsage: this.resourceMonitor.getSummary(),
      timestamp: new Date().toISOString(),
    };

    this.loadTestResults.push(result);

    return result;
  }

  /**
   * Run spike load test
   */
  async runSpikeLoadTest() {
    const config = LOAD_TEST_CONFIG.scenarios.spike;
    this.currentTest = 'spike';

    // Start resource monitoring
    this.resourceMonitor = new ResourceMonitor({
      interval: 1000, // 1 second for spike test
      duration: (config.normalDuration + config.spikeDuration) * config.cycles + 10000,
    });

    await this.resourceMonitor.startMonitoring();

    const spikeCycles = [];

    for (let cycle = 0; cycle < config.cycles; cycle++) {
      this.resetMetrics();

      const _normalPhaseStart = Date.now();
      await this.runConcurrentLoad(config.normalLoad, config.normalDuration);
      const normalStats = this.calculateStats();
      this.resetMetrics();

      const _spikePhaseStart = Date.now();
      await this.runConcurrentLoad(config.spikeLoad, config.spikeDuration);
      const spikeStats = this.calculateStats();

      spikeCycles.push({
        cycle: cycle + 1,
        normalPhase: {
          duration: config.normalDuration / 1000,
          concurrency: config.normalLoad,
          ...normalStats,
        },
        spikePhase: {
          duration: config.spikeDuration / 1000,
          concurrency: config.spikeLoad,
          ...spikeStats,
        },
      });
    }

    this.resourceMonitor.stopMonitoring();

    const result = {
      testType: 'spike',
      cycles: spikeCycles,
      resourceUsage: this.resourceMonitor.getSummary(),
      timestamp: new Date().toISOString(),
    };

    this.loadTestResults.push(result);
    return result;
  }

  /**
   * Run endurance test
   */
  async runEnduranceTest() {
    const config = LOAD_TEST_CONFIG.scenarios.endurance;
    this.currentTest = 'endurance';

    // Start resource monitoring with longer intervals
    this.resourceMonitor = new ResourceMonitor({
      interval: 5000, // 5 seconds
      duration: config.duration + 30000, // Extra time
    });

    await this.resourceMonitor.startMonitoring();

    this.resetMetrics();
    const startTime = Date.now();
    const intervalStats = [];

    // Run endurance test with periodic stats collection
    const statsInterval = 60000; // Collect stats every minute
    let lastStatsTime = startTime;

    const endurancePromise = this.runConcurrentLoad(config.concurrency, config.duration);

    // Collect interval stats
    const statsCollector = setInterval(() => {
      const currentTime = Date.now();
      const intervalDuration = (currentTime - lastStatsTime) / 1000;
      const stats = this.calculateStats();

      intervalStats.push({
        timestamp: new Date().toISOString(),
        elapsedMinutes: Math.round((currentTime - startTime) / 60000),
        intervalDuration,
        ...stats,
      });
      lastStatsTime = currentTime;
    }, statsInterval);

    await endurancePromise;
    clearInterval(statsCollector);

    const finalStats = this.calculateStats();
    this.resourceMonitor.stopMonitoring();

    const result = {
      testType: 'endurance',
      duration: config.duration / 1000,
      concurrency: config.concurrency,
      intervalStats,
      finalStats,
      resourceUsage: this.resourceMonitor.getSummary(),
      timestamp: new Date().toISOString(),
    };

    this.loadTestResults.push(result);

    return result;
  }

  /**
   * Run gradual load increase test
   */
  async runGradualLoadTest() {
    const config = LOAD_TEST_CONFIG.scenarios.gradual;
    this.currentTest = 'gradual';

    const steps = Math.ceil((config.maxConcurrency - config.startConcurrency) / config.stepSize);
    const totalDuration = steps * config.stepDuration + config.sustainDuration;

    // Start resource monitoring
    this.resourceMonitor = new ResourceMonitor({
      interval: 2000,
      duration: totalDuration + 30000,
    });

    await this.resourceMonitor.startMonitoring();

    const stepResults = [];
    let currentConcurrency = config.startConcurrency;

    // Gradual increase steps
    for (let step = 0; step < steps; step++) {
      this.resetMetrics();
      await this.runConcurrentLoad(currentConcurrency, config.stepDuration);
      const stepStats = this.calculateStats();

      stepResults.push({
        step: step + 1,
        concurrency: currentConcurrency,
        duration: config.stepDuration / 1000,
        ...stepStats,
      });

      currentConcurrency = Math.min(currentConcurrency + config.stepSize, config.maxConcurrency);
    }
    this.resetMetrics();
    await this.runConcurrentLoad(config.maxConcurrency, config.sustainDuration);
    const sustainStats = this.calculateStats();

    this.resourceMonitor.stopMonitoring();

    const result = {
      testType: 'gradual',
      steps: stepResults,
      sustainPhase: {
        concurrency: config.maxConcurrency,
        duration: config.sustainDuration / 1000,
        ...sustainStats,
      },
      resourceUsage: this.resourceMonitor.getSummary(),
      timestamp: new Date().toISOString(),
    };

    this.loadTestResults.push(result);

    return result;
  }

  /**
   * Helper: Reset metrics for new test phase
   */
  resetMetrics() {
    this.metrics = {
      requests: 0,
      responses: 0,
      errors: 0,
      timeouts: 0,
      totalResponseTime: 0,
      minResponseTime: Number.POSITIVE_INFINITY,
      maxResponseTime: 0,
      responseTimes: [],
    };
    this.startTime = Date.now();
  }

  /**
   * Helper: Run concurrent load for specified duration
   */
  async runConcurrentLoad(concurrency, duration) {
    const endTime = Date.now() + duration;
    const activeRequests = new Set();

    const makeRequest = async () => {
      const url = this.getRandomEndpoint();
      const requestPromise = this.performRequest(url);
      activeRequests.add(requestPromise);

      try {
        await requestPromise;
      } finally {
        activeRequests.delete(requestPromise);
      }

      // Continue if test is still running
      if (Date.now() < endTime) {
        setTimeout(makeRequest, Math.random() * 100); // Random delay 0-100ms
      }
    };

    // Start initial concurrent requests
    for (let i = 0; i < concurrency; i++) {
      setTimeout(makeRequest, Math.random() * 1000); // Stagger initial requests
    }

    // Wait for duration
    await new Promise((resolve) => setTimeout(resolve, duration));

    // Wait for remaining requests
    await Promise.all(Array.from(activeRequests));
  }

  /**
   * Helper: Run ramp up phase
   */
  async runRampUpPhase(duration, maxConcurrency) {
    const steps = 10;
    const stepDuration = duration / steps;
    const concurrencyStep = maxConcurrency / steps;

    for (let step = 0; step < steps; step++) {
      const currentConcurrency = Math.round((step + 1) * concurrencyStep);
      await this.runConcurrentLoad(currentConcurrency, stepDuration);

      process.stdout.write(`\r   Ramping up: ${currentConcurrency}/${maxConcurrency} users`);
    }
    return this.calculateStats();
  }

  /**
   * Helper: Run steady state phase
   */
  async runSteadyStatePhase(duration, concurrency) {
    await this.runConcurrentLoad(concurrency, duration);
    return this.calculateStats();
  }

  /**
   * Helper: Run ramp down phase
   */
  async runRampDownPhase(duration, maxConcurrency) {
    const steps = 5;
    const stepDuration = duration / steps;
    const concurrencyStep = maxConcurrency / steps;

    for (let step = 0; step < steps; step++) {
      const currentConcurrency = Math.round(maxConcurrency - (step + 1) * concurrencyStep);
      await this.runConcurrentLoad(Math.max(currentConcurrency, 1), stepDuration);

      process.stdout.write(`\r   Ramping down: ${currentConcurrency}/${maxConcurrency} users`);
    }
    return this.calculateStats();
  }

  /**
   * Generate comprehensive load test report
   */
  generateLoadTestReport() {
    const report = {
      timestamp: new Date().toISOString(),
      configuration: LOAD_TEST_CONFIG,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      testResults: this.loadTestResults,
      summary: this.calculateLoadTestSummary(),
    };

    // Save JSON report
    const reportPath = path.join(__dirname, 'reports', `load-test-report-${Date.now()}.json`);

    // Ensure reports directory exists
    const reportsDir = path.dirname(reportPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateLoadTestHtmlReport(report);
    const htmlReportPath = path.join(__dirname, 'reports', `load-test-report-${Date.now()}.html`);
    fs.writeFileSync(htmlReportPath, htmlReport);

    return report;
  }

  calculateLoadTestSummary() {
    if (this.loadTestResults.length === 0) return {};

    const summary = {
      totalTests: this.loadTestResults.length,
      testTypes: [...new Set(this.loadTestResults.map((r) => r.testType))],
      overallStats: {},
    };

    // Calculate aggregated stats
    this.loadTestResults.forEach((result) => {
      if (!summary.overallStats[result.testType]) {
        summary.overallStats[result.testType] = {
          count: 0,
          totalRequests: 0,
          avgThroughput: 0,
          avgErrorRate: 0,
        };
      }

      const testStats = summary.overallStats[result.testType];
      testStats.count++;

      if (result.overallStats) {
        testStats.totalRequests += result.overallStats.requests || 0;
        testStats.avgThroughput += result.overallStats.throughput || 0;
        testStats.avgErrorRate += result.overallStats.errorRate || 0;
      } else if (result.finalStats) {
        testStats.totalRequests += result.finalStats.requests || 0;
        testStats.avgThroughput += result.finalStats.throughput || 0;
        testStats.avgErrorRate += result.finalStats.errorRate || 0;
      }
    });

    // Average the stats
    Object.keys(summary.overallStats).forEach((testType) => {
      const stats = summary.overallStats[testType];
      stats.avgThroughput = Math.round((stats.avgThroughput / stats.count) * 100) / 100;
      stats.avgErrorRate = Math.round((stats.avgErrorRate / stats.count) * 100) / 100;
    });

    return summary;
  }

  generateLoadTestHtmlReport(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Load Test Report - Job Dorker</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #4CAF50; padding-bottom: 20px; margin-bottom: 20px; }
        .test-result { margin-bottom: 40px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
        .test-header { background: #4CAF50; color: white; padding: 15px; font-weight: bold; }
        .test-content { padding: 20px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; }
        .metric h4 { margin: 0 0 10px 0; color: #333; font-size: 14px; }
        .metric .value { font-size: 20px; font-weight: bold; }
        .good { color: #4CAF50; }
        .warning { color: #FF9800; }
        .bad { color: #f44336; }
        .phase-results { margin-top: 20px; }
        .phase { background: #f9f9f9; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .resource-section { background: #e8f5e9; padding: 15px; border-radius: 5px; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Load Test Report - Job Dorker</h1>
            <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
            <p>Tests Completed: ${report.testResults.length}</p>
        </div>
        
        ${report.testResults
          .map(
            (result) => `
        <div class="test-result">
            <div class="test-header">
                ${this.getTestTypeIcon(result.testType)} ${this.getTestTypeName(result.testType)} Test
            </div>
            <div class="test-content">
                ${this.generateTestResultHtml(result)}
            </div>
        </div>
        `,
          )
          .join('')}
        
        <div class="test-result">
            <div class="test-header">📊 Overall Summary</div>
            <div class="test-content">
                ${this.generateSummaryHtml(report.summary)}
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  getTestTypeIcon(type) {
    const icons = {
      sustained: '🔄',
      spike: '⚡',
      endurance: '💪',
      gradual: '📊',
    };
    return icons[type] || '🧪';
  }

  getTestTypeName(type) {
    const names = {
      sustained: 'Sustained Load',
      spike: 'Spike Load',
      endurance: 'Endurance',
      gradual: 'Gradual Load Increase',
    };
    return names[type] || type;
  }

  generateTestResultHtml(result) {
    let html = '';

    if (result.overallStats) {
      html += `
      <div class="metrics-grid">
          <div class="metric">
              <h4>Throughput</h4>
              <div class="value good">${result.overallStats.throughput} req/s</div>
          </div>
          <div class="metric">
              <h4>Avg Response</h4>
              <div class="value ${result.overallStats.avgResponseTime < 100 ? 'good' : result.overallStats.avgResponseTime < 500 ? 'warning' : 'bad'}">${result.overallStats.avgResponseTime}ms</div>
          </div>
          <div class="metric">
              <h4>Error Rate</h4>
              <div class="value ${result.overallStats.errorRate < 1 ? 'good' : result.overallStats.errorRate < 5 ? 'warning' : 'bad'}">${result.overallStats.errorRate}%</div>
          </div>
          <div class="metric">
              <h4>Duration</h4>
              <div class="value">${result.totalDuration || result.duration}s</div>
          </div>
      </div>`;
    }

    if (result.phases) {
      html += `
      <div class="phase-results">
          <h4>Test Phases</h4>
          ${result.phases
            .map(
              (phase) => `
          <div class="phase">
              <strong>${phase.phase}</strong>: ${phase.throughput} req/s, ${phase.errorRate}% errors
          </div>
          `,
            )
            .join('')}
      </div>`;
    }

    if (result.resourceUsage && !result.resourceUsage.error) {
      html += `
      <div class="resource-section">
          <h4>📊 Resource Usage</h4>
          <p><strong>Memory (RSS):</strong> ${result.resourceUsage.memory.rss.avg}MB avg (${result.resourceUsage.memory.rss.min}-${result.resourceUsage.memory.rss.max}MB)</p>
          <p><strong>Heap Used:</strong> ${result.resourceUsage.memory.heapUsed.avg}MB avg</p>
          <p><strong>Duration:</strong> ${result.resourceUsage.duration}s with ${result.resourceUsage.dataPoints} data points</p>
      </div>`;
    }

    return html;
  }

  generateSummaryHtml(summary) {
    if (!summary || Object.keys(summary).length === 0) {
      return '<p>No summary data available</p>';
    }

    let html = `<p><strong>Total Tests:</strong> ${summary.totalTests}</p>`;
    html += `<p><strong>Test Types:</strong> ${summary.testTypes.join(', ')}</p>`;

    if (summary.overallStats) {
      html +=
        '<table><thead><tr><th>Test Type</th><th>Tests</th><th>Total Requests</th><th>Avg Throughput</th><th>Avg Error Rate</th></tr></thead><tbody>';

      Object.entries(summary.overallStats).forEach(([testType, stats]) => {
        html += `
        <tr>
            <td>${this.getTestTypeName(testType)}</td>
            <td>${stats.count}</td>
            <td>${stats.totalRequests.toLocaleString()}</td>
            <td>${stats.avgThroughput} req/s</td>
            <td class="${stats.avgErrorRate < 1 ? 'good' : stats.avgErrorRate < 5 ? 'warning' : 'bad'}">${stats.avgErrorRate}%</td>
        </tr>`;
      });

      html += '</tbody></table>';
    }

    return html;
  }

  /**
   * Run complete load testing suite
   */
  async runAllLoadTests() {
    try {
      // Run all load test types
      await this.runSustainedLoadTest();
      await this.runSpikeLoadTest();
      await this.runGradualLoadTest();

      // Skip endurance test by default (too long for quick testing)
      // await this.runEnduranceTest();

      const report = this.generateLoadTestReport();
      return report;
    } catch (error) {
      console.error('\n💥 Load testing failed:', error);
      throw error;
    }
  }
}

// Export for use as module
export { LoadTester };

// Run load tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const loadTester = new LoadTester();

  loadTester
    .runAllLoadTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
