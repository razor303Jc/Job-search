# Performance & Stress Testing Suite - Job Dorker

## 🚀 Overview

This comprehensive performance testing suite provides multiple testing scenarios to evaluate the Job Dorker application under various load conditions and stress scenarios.

## 📁 Test Suite Structure

```
tests/performance/
├── benchmark-stress-tests.js     # Core performance benchmarks and stress tests
├── load-endurance-tests.js       # Load testing and endurance scenarios
├── resource-monitor.js           # System resource monitoring utility
├── performance-test-suite.js     # Main test orchestrator
├── reports/                      # Generated test reports
└── README.md                     # This documentation
```

## 🧪 Test Types

### 1. Performance Benchmarks
- **Light Load**: 100 requests, 5 concurrent
- **Medium Load**: 500 requests, 10 concurrent  
- **Heavy Load**: 1000 requests, 25 concurrent
- **Stress Load**: 2000 requests, 50 concurrent

**Endpoints Tested**:
- Homepage (`/`)
- Health endpoint (`/health`)
- Jobs API (`/api/v1/jobs`)
- Jobs Stats (`/api/v1/jobs/stats`)
- Enhanced Dashboard (`/enhanced-dashboard.html`)

### 2. Stress Tests
- **High Concurrency**: 100 concurrent users for 30 seconds
- **API Stress**: 50 concurrent users for 60 seconds on API endpoints
- **Mixed Load**: 75 concurrent users across multiple endpoints for 45 seconds

### 3. Load Tests
- **Sustained Load**: 5-minute test with ramp-up, steady state, and ramp-down
- **Spike Load**: Alternating normal and spike loads over multiple cycles
- **Gradual Increase**: Step-by-step concurrency increase from 1 to 100 users
- **Endurance**: 30-minute sustained load test (optional)

### 4. Resource Monitoring
- Real-time memory usage tracking
- CPU utilization monitoring
- System load metrics
- Performance correlation analysis

## 🎯 Test Suite Levels

### Quick Suite (5-10 minutes)
```bash
npm run test:performance:quick
```
- Basic benchmarks
- Light stress testing
- Ideal for development validation

### Standard Suite (15-25 minutes)
```bash
npm run test:performance:standard
```
- Full benchmarks
- Comprehensive stress tests
- Load testing scenarios
- Recommended for CI/CD

### Comprehensive Suite (45-75 minutes)
```bash
npm run test:performance:comprehensive
```
- All benchmark tests
- Extended stress scenarios
- Full load testing
- Endurance testing
- Complete performance analysis

## 🚀 Quick Start

### Prerequisites
1. Ensure Job Dorker web server is running:
```bash
npm run start:web
```

2. Verify server accessibility:
```bash
curl http://localhost:3000/health
```

### Running Tests

#### Individual Test Components
```bash
# Run benchmark tests only
node tests/performance/benchmark-stress-tests.js

# Run load tests only
node tests/performance/load-endurance-tests.js

# Run complete suite (standard level)
node tests/performance/performance-test-suite.js

# Run specific suite level
node tests/performance/performance-test-suite.js quick
node tests/performance/performance-test-suite.js standard
node tests/performance/performance-test-suite.js comprehensive
```

#### Using NPM Scripts
```bash
# Add to package.json scripts section:
"test:performance": "node tests/performance/performance-test-suite.js standard",
"test:performance:quick": "node tests/performance/performance-test-suite.js quick",
"test:performance:comprehensive": "node tests/performance/performance-test-suite.js comprehensive",
"test:benchmark": "node tests/performance/benchmark-stress-tests.js",
"test:load": "node tests/performance/load-endurance-tests.js"
```

## 📊 Report Generation

### Report Formats
1. **JSON Reports**: Detailed machine-readable results
2. **HTML Reports**: Visual dashboards with charts and metrics
3. **CSV Reports**: Spreadsheet-compatible summaries

### Report Contents
- Performance metrics (throughput, response times, error rates)
- Resource usage analysis
- Test configuration details
- Historical comparison data
- Pass/fail status for each test

### Sample Report Structure
```json
{
  "metadata": {
    "suiteLevel": "standard",
    "timestamp": "2025-01-24T...",
    "duration": 1247
  },
  "environment": {
    "nodeVersion": "v20.x.x",
    "platform": "linux",
    "baseUrl": "http://localhost:3000"
  },
  "healthChecks": [...],
  "testResults": {
    "benchmark": {...},
    "stress": {...},
    "load": {...}
  },
  "summary": {
    "overallPerformance": {
      "rating": "excellent",
      "peakThroughput": 245.67,
      "avgErrorRate": 0.12
    }
  }
}
```

## 📈 Performance Metrics

### Key Metrics Tracked
- **Throughput**: Requests per second (RPS)
- **Response Time**: Average, median, P95, P99 percentiles
- **Error Rate**: Percentage of failed requests
- **Concurrency**: Simultaneous request handling
- **Resource Usage**: Memory, CPU, system load

### Performance Thresholds
- **Excellent**: <100ms avg response, <0.1% errors, >200 RPS
- **Good**: <200ms avg response, <1% errors, >100 RPS
- **Fair**: <500ms avg response, <5% errors, >50 RPS
- **Poor**: >500ms avg response, >5% errors, <50 RPS

## 🔧 Configuration

### Benchmark Configuration
```javascript
const BENCHMARK_CONFIG = {
  baseUrl: 'http://localhost:3000',
  iterations: {
    light: 100,
    medium: 500,
    heavy: 1000,
    stress: 2000
  },
  concurrent: {
    light: 5,
    medium: 10,
    heavy: 25,
    stress: 50
  },
  timeout: 30000,
  warmupRequests: 10
};
```

### Load Test Configuration
```javascript
const LOAD_TEST_CONFIG = {
  scenarios: {
    sustained: {
      duration: 300000, // 5 minutes
      maxConcurrency: 50,
      targetRPS: 100
    },
    spike: {
      normalLoad: 10,
      spikeLoad: 100,
      spikeDuration: 30000,
      cycles: 3
    }
  }
};
```

## 🛠️ Troubleshooting

### Common Issues

#### Server Not Responding
```bash
# Check if server is running
curl -I http://localhost:3000/health

# Start the server
npm run start:web

# Check server logs
npm run start:web -- --verbose
```

#### High Error Rates
- Verify server stability under load
- Check database connections
- Monitor system resources
- Review server logs for errors

#### Memory Issues
- Monitor memory usage during tests
- Check for memory leaks
- Adjust test concurrency levels
- Review resource limits

### Performance Optimization Tips

1. **Database Optimization**
   - Add proper indexes
   - Optimize queries
   - Use connection pooling

2. **Server Configuration**
   - Adjust worker processes
   - Configure request timeouts
   - Optimize middleware stack

3. **Infrastructure**
   - Increase available memory
   - Use SSD storage
   - Configure load balancing

## 📊 Continuous Integration

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Run Performance Tests
  run: |
    npm run start:web &
    sleep 10
    npm run test:performance:quick
    kill %1
```

### Performance Regression Detection
- Establish baseline metrics
- Set performance thresholds
- Alert on regression detection
- Track performance trends

## 🔍 Advanced Usage

### Custom Test Scenarios
```javascript
// Example custom test
const customTest = {
  name: 'Custom API Load Test',
  url: 'http://localhost:3000/api/custom',
  concurrency: 30,
  duration: 60000,
  expectedThroughput: 150
};
```

### Resource Monitoring
```javascript
const monitor = new ResourceMonitor({
  interval: 1000,  // 1 second
  duration: 300000 // 5 minutes
});

await monitor.startMonitoring();
// ... run tests ...
const metrics = monitor.getSummary();
```

## 📝 Best Practices

1. **Test Environment**
   - Use dedicated test environment
   - Ensure consistent baseline conditions
   - Isolate from other processes

2. **Test Design**
   - Start with smoke tests
   - Gradually increase load
   - Include realistic user scenarios

3. **Monitoring**
   - Track both client and server metrics
   - Monitor system resources
   - Log detailed error information

4. **Reporting**
   - Establish performance baselines
   - Track trends over time
   - Share results with team

## 🎯 Success Criteria

### Acceptance Thresholds
- **Response Time**: <200ms average for normal load
- **Throughput**: >100 RPS sustained
- **Error Rate**: <1% under normal conditions
- **Availability**: >99.9% uptime during tests

### Performance Goals
- Handle 50+ concurrent users
- Maintain <500ms P95 response time
- Support 1000+ requests per minute
- Graceful degradation under stress

---

## 🚀 Getting Started Now

1. **Quick Validation**:
```bash
npm run start:web &
sleep 5
node tests/performance/performance-test-suite.js quick
```

2. **Standard Testing**:
```bash
npm run start:web &
sleep 5
node tests/performance/performance-test-suite.js standard
```

3. **View Results**:
Check `tests/performance/reports/` for generated HTML reports with visual dashboards and detailed metrics.

**Happy Performance Testing! 🎉**
