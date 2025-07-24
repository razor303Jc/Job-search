/**
 * Performance Benchmark Suite for Job Dorker
 * Comprehensive performance testing with detailed metrics and reporting
 */

import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Benchmark Configuration
const BENCHMARK_CONFIG = {
  baseUrl: 'http://localhost:3000',
  iterations: {
    light: 100,
    medium: 500,
    heavy: 1000,
    stress: 2000,
  },
  concurrent: {
    light: 5,
    medium: 10,
    heavy: 25,
    stress: 50,
  },
  timeout: 30000,
  reportDir: path.join(__dirname, 'reports'),
  warmupRequests: 10,
};

// Ensure report directory exists
if (!fs.existsSync(BENCHMARK_CONFIG.reportDir)) {
  fs.mkdirSync(BENCHMARK_CONFIG.reportDir, { recursive: true });
}

class PerformanceBenchmark {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
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
  }

  /**
   * Run a single HTTP request with performance timing
   */
  async performRequest(url, options = {}) {
    const startTime = performance.now();

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body,
        signal: AbortSignal.timeout(BENCHMARK_CONFIG.timeout),
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.metrics.requests++;
      this.metrics.responses++;
      this.metrics.totalResponseTime += responseTime;
      this.metrics.responseTimes.push(responseTime);

      if (responseTime < this.metrics.minResponseTime) {
        this.metrics.minResponseTime = responseTime;
      }
      if (responseTime > this.metrics.maxResponseTime) {
        this.metrics.maxResponseTime = responseTime;
      }

      return {
        success: true,
        status: response.status,
        responseTime,
        size: Number.parseInt(response.headers.get('content-length') || '0'),
        url,
      };
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.metrics.requests++;
      if (error.name === 'TimeoutError') {
        this.metrics.timeouts++;
      } else {
        this.metrics.errors++;
      }

      return {
        success: false,
        error: error.message,
        responseTime,
        url,
      };
    }
  }

  /**
   * Run concurrent requests
   */
  async runConcurrentRequests(url, concurrency, totalRequests) {
    const results = [];
    const batches = Math.ceil(totalRequests / concurrency);

    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, totalRequests - batch * concurrency);
      const promises = [];

      for (let i = 0; i < batchSize; i++) {
        promises.push(this.performRequest(url));
      }

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);

      // Progress indicator
      const progress = Math.round((((batch + 1) * concurrency) / totalRequests) * 100);
      process.stdout.write(`\r  Progress: ${Math.min(progress, 100)}%`);
    }
    return results;
  }

  /**
   * Warmup requests to stabilize server
   */
  async warmup() {
    for (let i = 0; i < BENCHMARK_CONFIG.warmupRequests; i++) {
      await this.performRequest(BENCHMARK_CONFIG.baseUrl);
      process.stdout.write(`\r  Warmup: ${i + 1}/${BENCHMARK_CONFIG.warmupRequests}`);
    }

    // Reset metrics after warmup
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
  }

  /**
   * Calculate performance statistics
   */
  calculateStats() {
    const responseTimes = this.metrics.responseTimes.sort((a, b) => a - b);
    const totalRequests = this.metrics.requests;

    if (responseTimes.length === 0) {
      return {
        avgResponseTime: 0,
        medianResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        errorRate: 100,
        successRate: 0,
      };
    }

    const avgResponseTime = this.metrics.totalResponseTime / responseTimes.length;
    const medianIndex = Math.floor(responseTimes.length / 2);
    const medianResponseTime =
      responseTimes.length % 2 === 0
        ? (responseTimes[medianIndex - 1] + responseTimes[medianIndex]) / 2
        : responseTimes[medianIndex];

    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    const p95ResponseTime = responseTimes[p95Index] || 0;
    const p99ResponseTime = responseTimes[p99Index] || 0;

    const testDuration = (Date.now() - this.startTime) / 1000;
    const throughput = this.metrics.responses / testDuration;

    const errorRate = ((this.metrics.errors + this.metrics.timeouts) / totalRequests) * 100;
    const successRate = (this.metrics.responses / totalRequests) * 100;

    return {
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      medianResponseTime: Math.round(medianResponseTime * 100) / 100,
      p95ResponseTime: Math.round(p95ResponseTime * 100) / 100,
      p99ResponseTime: Math.round(p99ResponseTime * 100) / 100,
      minResponseTime: Math.round(this.metrics.minResponseTime * 100) / 100,
      maxResponseTime: Math.round(this.metrics.maxResponseTime * 100) / 100,
      throughput: Math.round(throughput * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      testDuration: Math.round(testDuration * 100) / 100,
    };
  }

  /**
   * Run benchmark test suite
   */
  async runBenchmarks() {
    const testCases = [
      {
        name: 'Homepage Load Test',
        url: `${BENCHMARK_CONFIG.baseUrl}/`,
        load: 'light',
      },
      {
        name: 'Health Endpoint Test',
        url: `${BENCHMARK_CONFIG.baseUrl}/health`,
        load: 'medium',
      },
      {
        name: 'API Jobs Endpoint Test',
        url: `${BENCHMARK_CONFIG.baseUrl}/api/v1/jobs`,
        load: 'medium',
      },
      {
        name: 'API Jobs Stats Test',
        url: `${BENCHMARK_CONFIG.baseUrl}/api/v1/jobs/stats`,
        load: 'light',
      },
      {
        name: 'Enhanced Dashboard Test',
        url: `${BENCHMARK_CONFIG.baseUrl}/enhanced-dashboard.html`,
        load: 'heavy',
      },
    ];

    const benchmarkResults = [];

    // Run warmup
    await this.warmup();

    for (const testCase of testCases) {
      // Reset metrics for this test
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

      const iterations = BENCHMARK_CONFIG.iterations[testCase.load];
      const concurrency = BENCHMARK_CONFIG.concurrent[testCase.load];

      const _results = await this.runConcurrentRequests(testCase.url, concurrency, iterations);
      const stats = this.calculateStats();

      const testResult = {
        testName: testCase.name,
        url: testCase.url,
        loadLevel: testCase.load,
        iterations,
        concurrency,
        ...stats,
        timestamp: new Date().toISOString(),
      };

      benchmarkResults.push(testResult);

      if (stats.errorRate > 0) {
      }
    }

    return benchmarkResults;
  }

  /**
   * Run stress tests
   */
  async runStressTests() {
    const stressTests = [
      {
        name: 'High Concurrency Stress Test',
        url: `${BENCHMARK_CONFIG.baseUrl}/`,
        concurrency: 100,
        duration: 30000, // 30 seconds
        rampUp: true,
      },
      {
        name: 'API Endpoint Stress Test',
        url: `${BENCHMARK_CONFIG.baseUrl}/api/v1/jobs`,
        concurrency: 50,
        duration: 60000, // 60 seconds
        rampUp: true,
      },
      {
        name: 'Mixed Load Stress Test',
        urls: [
          `${BENCHMARK_CONFIG.baseUrl}/`,
          `${BENCHMARK_CONFIG.baseUrl}/health`,
          `${BENCHMARK_CONFIG.baseUrl}/api/v1/jobs`,
          `${BENCHMARK_CONFIG.baseUrl}/api/v1/jobs/stats`,
        ],
        concurrency: 75,
        duration: 45000, // 45 seconds
        rampUp: true,
      },
    ];

    const stressResults = [];

    for (const stressTest of stressTests) {
      const result = await this.runStressTest(stressTest);
      stressResults.push(result);
    }

    return stressResults;
  }

  /**
   * Run individual stress test
   */
  async runStressTest(config) {
    // Reset metrics
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
    const endTime = this.startTime + config.duration;
    const activeRequests = new Set();
    let currentConcurrency = config.rampUp ? 1 : config.concurrency;

    // Ramp up concurrency if enabled
    const rampUpInterval = config.rampUp
      ? setInterval(() => {
          if (currentConcurrency < config.concurrency) {
            currentConcurrency = Math.min(currentConcurrency + 5, config.concurrency);
          }
        }, 2000)
      : null;

    const makeRequest = async () => {
      const urls = config.urls || [config.url];
      const url = urls[Math.floor(Math.random() * urls.length)];

      const requestPromise = this.performRequest(url);
      activeRequests.add(requestPromise);

      try {
        await requestPromise;
      } finally {
        activeRequests.delete(requestPromise);
      }

      // Continue making requests if test is still running
      if (Date.now() < endTime) {
        setTimeout(makeRequest, 10); // Small delay to prevent overwhelming
      }
    };

    // Start initial requests
    const initialPromises = [];
    for (let i = 0; i < Math.min(currentConcurrency, 10); i++) {
      initialPromises.push(makeRequest());
    }

    // Wait for test duration
    await new Promise((resolve) => setTimeout(resolve, config.duration));

    if (rampUpInterval) {
      clearInterval(rampUpInterval);
    }
    await Promise.all(Array.from(activeRequests));

    const stats = this.calculateStats();

    return {
      testName: config.name,
      duration: config.duration,
      maxConcurrency: config.concurrency,
      ...stats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate comprehensive report
   */
  generateReport(benchmarkResults, stressResults) {
    const report = {
      timestamp: new Date().toISOString(),
      configuration: BENCHMARK_CONFIG,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
      },
      benchmark: {
        summary: this.calculateBenchmarkSummary(benchmarkResults),
        results: benchmarkResults,
      },
      stress: {
        summary: this.calculateStressSummary(stressResults),
        results: stressResults,
      },
    };

    // Save JSON report
    const reportPath = path.join(
      BENCHMARK_CONFIG.reportDir,
      `performance-report-${Date.now()}.json`,
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHtmlReport(report);
    const htmlReportPath = path.join(
      BENCHMARK_CONFIG.reportDir,
      `performance-report-${Date.now()}.html`,
    );
    fs.writeFileSync(htmlReportPath, htmlReport);

    if (benchmarkResults.length > 0) {
      const _avgThroughput =
        benchmarkResults.reduce((sum, r) => sum + r.throughput, 0) / benchmarkResults.length;
      const _avgResponseTime =
        benchmarkResults.reduce((sum, r) => sum + r.avgResponseTime, 0) / benchmarkResults.length;
      const _overallSuccessRate =
        benchmarkResults.reduce((sum, r) => sum + r.successRate, 0) / benchmarkResults.length;
    }

    if (stressResults.length > 0) {
      const _maxThroughput = Math.max(...stressResults.map((r) => r.throughput));
      const _avgErrorRate =
        stressResults.reduce((sum, r) => sum + r.errorRate, 0) / stressResults.length;
    }

    return report;
  }

  calculateBenchmarkSummary(results) {
    if (results.length === 0) return {};

    return {
      totalTests: results.length,
      averageThroughput: results.reduce((sum, r) => sum + r.throughput, 0) / results.length,
      averageResponseTime: results.reduce((sum, r) => sum + r.avgResponseTime, 0) / results.length,
      overallSuccessRate: results.reduce((sum, r) => sum + r.successRate, 0) / results.length,
      totalRequests: results.reduce((sum, r) => sum + r.iterations, 0),
    };
  }

  calculateStressSummary(results) {
    if (results.length === 0) return {};

    return {
      totalTests: results.length,
      peakThroughput: Math.max(...results.map((r) => r.throughput)),
      averageErrorRate: results.reduce((sum, r) => sum + r.errorRate, 0) / results.length,
      totalDuration: results.reduce((sum, r) => sum + r.testDuration, 0),
      totalRequests: results.reduce((sum, r) => sum + (r.requests || 0), 0),
    };
  }

  generateHtmlReport(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Benchmark Report - Job Dorker</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #2196F3; padding-bottom: 20px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 24px; font-weight: bold; }
        .good { color: #4CAF50; }
        .warning { color: #FF9800; }
        .bad { color: #f44336; }
        .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .table th { background: #2196F3; color: white; }
        .test-section { margin-bottom: 40px; }
        .progress-bar { width: 100%; height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; margin: 5px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #4CAF50, #8BC34A); transition: width 0.3s; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Performance Benchmark Report - Job Dorker</h1>
            <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
        </div>
        
        ${
          report.benchmark.results.length > 0
            ? `
        <div class="test-section">
            <h2>📊 Benchmark Test Results</h2>
            <div class="summary">
                <div class="metric">
                    <h3>Average Throughput</h3>
                    <div class="value good">${Math.round(report.benchmark.summary.averageThroughput * 100) / 100} req/s</div>
                </div>
                <div class="metric">
                    <h3>Average Response Time</h3>
                    <div class="value ${report.benchmark.summary.averageResponseTime < 100 ? 'good' : report.benchmark.summary.averageResponseTime < 500 ? 'warning' : 'bad'}">${Math.round(report.benchmark.summary.averageResponseTime * 100) / 100}ms</div>
                </div>
                <div class="metric">
                    <h3>Success Rate</h3>
                    <div class="value ${report.benchmark.summary.overallSuccessRate > 95 ? 'good' : report.benchmark.summary.overallSuccessRate > 90 ? 'warning' : 'bad'}">${Math.round(report.benchmark.summary.overallSuccessRate * 100) / 100}%</div>
                </div>
                <div class="metric">
                    <h3>Total Requests</h3>
                    <div class="value">${report.benchmark.summary.totalRequests.toLocaleString()}</div>
                </div>
            </div>
            
            <table class="table">
                <thead>
                    <tr>
                        <th>Test Name</th>
                        <th>Load Level</th>
                        <th>Requests</th>
                        <th>Concurrency</th>
                        <th>Avg Response (ms)</th>
                        <th>Throughput (req/s)</th>
                        <th>Success Rate</th>
                        <th>Error Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.benchmark.results
                      .map(
                        (result) => `
                        <tr>
                            <td>${result.testName}</td>
                            <td><span style="background: ${result.loadLevel === 'light' ? '#E8F5E8' : result.loadLevel === 'medium' ? '#FFF3E0' : '#FFEBEE'}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${result.loadLevel}</span></td>
                            <td>${result.iterations}</td>
                            <td>${result.concurrency}</td>
                            <td>${result.avgResponseTime}</td>
                            <td>${result.throughput}</td>
                            <td><span class="${result.successRate > 95 ? 'good' : result.successRate > 90 ? 'warning' : 'bad'}">${result.successRate}%</span></td>
                            <td><span class="${result.errorRate < 1 ? 'good' : result.errorRate < 5 ? 'warning' : 'bad'}">${result.errorRate}%</span></td>
                        </tr>
                    `,
                      )
                      .join('')}
                </tbody>
            </table>
        </div>
        `
            : ''
        }
        
        ${
          report.stress.results.length > 0
            ? `
        <div class="test-section">
            <h2>💥 Stress Test Results</h2>
            <div class="summary">
                <div class="metric">
                    <h3>Peak Throughput</h3>
                    <div class="value good">${Math.round(report.stress.summary.peakThroughput * 100) / 100} req/s</div>
                </div>
                <div class="metric">
                    <h3>Average Error Rate</h3>
                    <div class="value ${report.stress.summary.averageErrorRate < 1 ? 'good' : report.stress.summary.averageErrorRate < 5 ? 'warning' : 'bad'}">${Math.round(report.stress.summary.averageErrorRate * 100) / 100}%</div>
                </div>
                <div class="metric">
                    <h3>Total Duration</h3>
                    <div class="value">${Math.round(report.stress.summary.totalDuration)}s</div>
                </div>
                <div class="metric">
                    <h3>Total Requests</h3>
                    <div class="value">${report.stress.summary.totalRequests.toLocaleString()}</div>
                </div>
            </div>
            
            <table class="table">
                <thead>
                    <tr>
                        <th>Test Name</th>
                        <th>Duration (s)</th>
                        <th>Max Concurrency</th>
                        <th>Total Requests</th>
                        <th>Throughput (req/s)</th>
                        <th>Avg Response (ms)</th>
                        <th>Error Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.stress.results
                      .map(
                        (result) => `
                        <tr>
                            <td>${result.testName}</td>
                            <td>${result.duration / 1000}</td>
                            <td>${result.maxConcurrency}</td>
                            <td>${(result.requests || 0).toLocaleString()}</td>
                            <td>${result.throughput}</td>
                            <td>${result.avgResponseTime}</td>
                            <td><span class="${result.errorRate < 1 ? 'good' : result.errorRate < 5 ? 'warning' : 'bad'}">${result.errorRate}%</span></td>
                        </tr>
                    `,
                      )
                      .join('')}
                </tbody>
            </table>
        </div>
        `
            : ''
        }
        
        <div class="test-section">
            <h2>🔧 Test Configuration</h2>
            <table class="table">
                <tr><td><strong>Base URL</strong></td><td>${report.configuration.baseUrl}</td></tr>
                <tr><td><strong>Timeout</strong></td><td>${report.configuration.timeout}ms</td></tr>
                <tr><td><strong>Warmup Requests</strong></td><td>${report.configuration.warmupRequests}</td></tr>
                <tr><td><strong>Node Version</strong></td><td>${report.environment.nodeVersion}</td></tr>
                <tr><td><strong>Platform</strong></td><td>${report.environment.platform} (${report.environment.arch})</td></tr>
            </table>
        </div>
    </div>
</body>
</html>`;
  }
}

// Export for use as module
export { PerformanceBenchmark };

// Run benchmarks if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new PerformanceBenchmark();

  async function runAllTests() {
    try {
      const benchmarkResults = await benchmark.runBenchmarks();
      const stressResults = await benchmark.runStressTests();

      const _report = benchmark.generateReport(benchmarkResults, stressResults);
      process.exit(0);
    } catch (error) {
      console.error('\n💥 Performance testing failed:', error);
      process.exit(1);
    }
  }

  runAllTests();
}
