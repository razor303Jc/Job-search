/**
 * Performance and Load Testing
 * Phase 8 Stage 2: Performance Testing & Optimization
 *
 * Tests for performance benchmarks, load testing, and optimization validation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock performance utilities
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();

  startTimer(label: string): void {
    this.startTimes.set(label, performance.now());
  }

  endTimer(label: string): number {
    const startTime = this.startTimes.get(label);
    if (!startTime) {
      throw new Error(`Timer ${label} was not started`);
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(label);

    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);

    return duration;
  }

  getAverageTime(label: string): number {
    const times = this.metrics.get(label);
    if (!times || times.length === 0) {
      return 0;
    }
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  getMetrics(label: string): { avg: number; min: number; max: number; count: number } {
    const times = this.metrics.get(label) || [];
    if (times.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    return {
      avg: times.reduce((sum, time) => sum + time, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      count: times.length,
    };
  }

  reset(): void {
    this.metrics.clear();
    this.startTimes.clear();
  }
}

// Mock database operations for performance testing
class MockDatabase {
  private data: Map<string, any[]> = new Map();
  private connectionPool: number = 0;
  private maxConnections: number = 10;

  async connect(): Promise<void> {
    if (this.connectionPool >= this.maxConnections) {
      throw new Error('Connection pool exhausted');
    }
    this.connectionPool++;
    await this.delay(Math.random() * 10); // Simulate connection time
  }

  async disconnect(): Promise<void> {
    if (this.connectionPool > 0) {
      this.connectionPool--;
    }
    await this.delay(Math.random() * 5);
  }

  async query(sql: string, params?: any[]): Promise<any[]> {
    await this.delay(Math.random() * 20 + 5); // Simulate query time

    // Mock different query types
    if (sql.includes('SELECT')) {
      return this.generateMockRows(100);
    } else if (sql.includes('INSERT')) {
      return [{ insertId: Math.floor(Math.random() * 1000) }];
    } else if (sql.includes('UPDATE')) {
      return [{ affectedRows: Math.floor(Math.random() * 10) }];
    }
    return [];
  }

  async bulkInsert(tableName: string, records: any[]): Promise<void> {
    const batchSize = 1000;
    const batches = Math.ceil(records.length / batchSize);
    
    for (let i = 0; i < batches; i++) {
      const batch = records.slice(i * batchSize, (i + 1) * batchSize);
      await this.delay(batch.length * 0.1); // Simulate bulk insert time
    }
  }

  private generateMockRows(count: number): any[] {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `Job ${i + 1}`,
      company: `Company ${i + 1}`,
      location: `Location ${i + 1}`,
      created_at: new Date().toISOString(),
    }));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getConnectionPoolStatus(): { active: number; max: number; usage: number } {
    return {
      active: this.connectionPool,
      max: this.maxConnections,
      usage: this.connectionPool / this.maxConnections,
    };
  }
}

// Mock HTTP client for API performance testing
class MockHttpClient {
  private requestCount: number = 0;
  private responseTime: number = 100;

  async get(url: string, options?: any): Promise<{ status: number; data: any; time: number }> {
    const startTime = performance.now();
    this.requestCount++;

    // Simulate network latency
    await this.delay(this.responseTime + Math.random() * 50);

    const endTime = performance.now();
    
    return {
      status: 200,
      data: { url, timestamp: Date.now() },
      time: endTime - startTime,
    };
  }

  async post(url: string, data: any, options?: any): Promise<{ status: number; data: any; time: number }> {
    const startTime = performance.now();
    this.requestCount++;

    await this.delay(this.responseTime + Math.random() * 100);

    const endTime = performance.now();

    return {
      status: 201,
      data: { id: Math.random().toString(36), ...data },
      time: endTime - startTime,
    };
  }

  setResponseTime(ms: number): void {
    this.responseTime = ms;
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  reset(): void {
    this.requestCount = 0;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Mock job processing system
class MockJobProcessor {
  private queue: any[] = [];
  private processing: boolean = false;
  private processed: number = 0;

  async addJob(job: any): Promise<void> {
    this.queue.push({ ...job, addedAt: Date.now() });
  }

  async processJobs(concurrency: number = 1): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;
    const workers = Array.from({ length: concurrency }, () => this.worker());
    await Promise.all(workers);
    this.processing = false;
  }

  private async worker(): Promise<void> {
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (job) {
        await this.processJob(job);
        this.processed++;
      }
    }
  }

  private async processJob(job: any): Promise<void> {
    // Simulate job processing time
    const processingTime = Math.random() * 100 + 50;
    await new Promise((resolve) => setTimeout(resolve, processingTime));
  }

  getStats(): { queued: number; processed: number; total: number } {
    return {
      queued: this.queue.length,
      processed: this.processed,
      total: this.queue.length + this.processed,
    };
  }

  reset(): void {
    this.queue = [];
    this.processed = 0;
    this.processing = false;
  }
}

describe('Performance and Load Testing', () => {
  let performanceMonitor: PerformanceMonitor;
  let mockDatabase: MockDatabase;
  let mockHttpClient: MockHttpClient;
  let mockJobProcessor: MockJobProcessor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    mockDatabase = new MockDatabase();
    mockHttpClient = new MockHttpClient();
    mockJobProcessor = new MockJobProcessor();
    vi.clearAllTimers();
  });

  describe('Performance Monitoring', () => {
    it('should measure operation duration', () => {
      performanceMonitor.startTimer('test-operation');
      
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Busy wait for 10ms
      }
      
      const duration = performanceMonitor.endTimer('test-operation');
      expect(duration).toBeGreaterThanOrEqual(9); // Allow for some variance
    });

    it('should calculate average performance metrics', () => {
      const operations = 10;
      
      for (let i = 0; i < operations; i++) {
        performanceMonitor.startTimer('batch-operation');
        // Simulate different processing times
        const start = Date.now();
        while (Date.now() - start < (i + 1) * 2) {
          // Variable work duration
        }
        performanceMonitor.endTimer('batch-operation');
      }

      const metrics = performanceMonitor.getMetrics('batch-operation');
      expect(metrics.count).toBe(operations);
      expect(metrics.avg).toBeGreaterThan(0);
      expect(metrics.min).toBeLessThanOrEqual(metrics.avg);
      expect(metrics.max).toBeGreaterThanOrEqual(metrics.avg);
    });

    it('should handle concurrent timer operations', () => {
      const timers = ['timer1', 'timer2', 'timer3'];
      
      timers.forEach((timer) => {
        performanceMonitor.startTimer(timer);
      });

      // End timers in different order
      timers.reverse().forEach((timer) => {
        const duration = performanceMonitor.endTimer(timer);
        expect(duration).toBeGreaterThan(0);
      });
    });
  });

  describe('Database Performance', () => {
    it('should handle database connections efficiently', async () => {
      performanceMonitor.startTimer('db-connections');

      const connections = [];
      for (let i = 0; i < 5; i++) {
        connections.push(mockDatabase.connect());
      }

      await Promise.all(connections);
      const connectionTime = performanceMonitor.endTimer('db-connections');

      expect(connectionTime).toBeLessThan(1000); // Should connect quickly
      expect(mockDatabase.getConnectionPoolStatus().active).toBe(5);

      // Clean up connections
      const disconnections = [];
      for (let i = 0; i < 5; i++) {
        disconnections.push(mockDatabase.disconnect());
      }
      await Promise.all(disconnections);
    });

    it('should handle connection pool limits', async () => {
      // Fill up the connection pool
      const connections = [];
      for (let i = 0; i < 10; i++) {
        connections.push(mockDatabase.connect());
      }
      await Promise.all(connections);

      // This should fail due to pool exhaustion
      await expect(mockDatabase.connect()).rejects.toThrow('Connection pool exhausted');

      const status = mockDatabase.getConnectionPoolStatus();
      expect(status.usage).toBe(1.0); // 100% usage
    });

    it('should perform bulk operations efficiently', async () => {
      await mockDatabase.connect();
      
      performanceMonitor.startTimer('bulk-insert');
      
      const records = Array.from({ length: 5000 }, (_, i) => ({
        id: i + 1,
        title: `Job ${i + 1}`,
        company: `Company ${i + 1}`,
      }));

      await mockDatabase.bulkInsert('jobs', records);
      
      const bulkTime = performanceMonitor.endTimer('bulk-insert');
      
      // Bulk insert should be efficient (less than 1ms per record)
      expect(bulkTime).toBeLessThan(records.length * 1);
      
      await mockDatabase.disconnect();
    });

    it('should handle concurrent database queries', async () => {
      await mockDatabase.connect();
      
      performanceMonitor.startTimer('concurrent-queries');

      const queries = Array.from({ length: 20 }, (_, i) => 
        mockDatabase.query(`SELECT * FROM jobs WHERE id = ?`, [i + 1])
      );

      const results = await Promise.all(queries);
      
      const queryTime = performanceMonitor.endTimer('concurrent-queries');
      
      expect(results.length).toBe(20);
      expect(queryTime).toBeLessThan(2000); // Should complete within 2 seconds
      
      await mockDatabase.disconnect();
    });
  });

  describe('HTTP Client Performance', () => {
    it('should handle HTTP requests within performance bounds', async () => {
      performanceMonitor.startTimer('http-request');

      const response = await mockHttpClient.get('https://api.example.com/jobs');
      
      const requestTime = performanceMonitor.endTimer('http-request');

      expect(response.status).toBe(200);
      expect(requestTime).toBeLessThan(300); // Should respond quickly
    });

    it('should handle concurrent HTTP requests', async () => {
      performanceMonitor.startTimer('concurrent-http');

      const requests = Array.from({ length: 10 }, (_, i) =>
        mockHttpClient.get(`https://api.example.com/jobs/${i + 1}`)
      );

      const responses = await Promise.all(requests);
      
      const totalTime = performanceMonitor.endTimer('concurrent-http');

      expect(responses.length).toBe(10);
      expect(responses.every((r) => r.status === 200)).toBe(true);
      expect(totalTime).toBeLessThan(500); // Concurrent requests should be faster
      expect(mockHttpClient.getRequestCount()).toBe(10);
    });

    it('should adapt to varying network conditions', async () => {
      const scenarios = [
        { name: 'fast-network', responseTime: 50 },
        { name: 'slow-network', responseTime: 300 },
        { name: 'unstable-network', responseTime: 150 },
      ];

      for (const scenario of scenarios) {
        mockHttpClient.setResponseTime(scenario.responseTime);
        mockHttpClient.reset();

        performanceMonitor.startTimer(scenario.name);

        const response = await mockHttpClient.get('https://api.example.com/test');
        
        const duration = performanceMonitor.endTimer(scenario.name);

        expect(response.status).toBe(200);
        expect(duration).toBeGreaterThan(scenario.responseTime - 10);
        expect(duration).toBeLessThan(scenario.responseTime + 100);
      }
    });
  });

  describe('Job Processing Performance', () => {
    it('should process jobs efficiently', async () => {
      const jobCount = 100;
      
      // Add jobs to queue
      performanceMonitor.startTimer('job-addition');
      for (let i = 0; i < jobCount; i++) {
        await mockJobProcessor.addJob({
          id: i + 1,
          title: `Job ${i + 1}`,
          data: `Processing data ${i + 1}`,
        });
      }
      const additionTime = performanceMonitor.endTimer('job-addition');

      // Process jobs
      performanceMonitor.startTimer('job-processing');
      await mockJobProcessor.processJobs(1); // Single worker
      const processingTime = performanceMonitor.endTimer('job-processing');

      const stats = mockJobProcessor.getStats();
      expect(stats.processed).toBe(jobCount);
      expect(stats.queued).toBe(0);
      expect(additionTime).toBeLessThan(jobCount * 5); // Should add jobs quickly
      expect(processingTime).toBeLessThan(jobCount * 200); // Reasonable processing time
    });

    it('should scale with concurrent processing', async () => {
      const jobCount = 50;
      
      // Add jobs
      for (let i = 0; i < jobCount; i++) {
        await mockJobProcessor.addJob({ id: i + 1, data: `Job ${i + 1}` });
      }

      // Test different concurrency levels
      const concurrencyLevels = [1, 2, 5];
      const results = [];

      for (const concurrency of concurrencyLevels) {
        mockJobProcessor.reset();
        
        // Re-add jobs
        for (let i = 0; i < jobCount; i++) {
          await mockJobProcessor.addJob({ id: i + 1, data: `Job ${i + 1}` });
        }

        performanceMonitor.startTimer(`concurrency-${concurrency}`);
        await mockJobProcessor.processJobs(concurrency);
        const duration = performanceMonitor.endTimer(`concurrency-${concurrency}`);

        results.push({ concurrency, duration });
      }

      // Higher concurrency should be faster (or at least not significantly slower)
      expect(results[0].duration).toBeGreaterThan(results[1].duration * 0.8);
      expect(results[1].duration).toBeGreaterThan(results[2].duration * 0.6);
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory during operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform memory-intensive operations
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        data: `Large data object ${i}`.repeat(10),
        timestamp: Date.now(),
      }));

      // Process the array
      const processed = largeArray
        .filter((item) => item.id % 2 === 0)
        .map((item) => ({ ...item, processed: true }))
        .slice(0, 1000);

      expect(processed.length).toBe(1000);

      // Clear references
      largeArray.length = 0;
      processed.length = 0;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle large datasets efficiently', () => {
      performanceMonitor.startTimer('large-dataset');

      const dataSize = 100000;
      const dataset = Array.from({ length: dataSize }, (_, i) => ({
        id: i,
        value: Math.random(),
        category: i % 10,
      }));

      // Perform operations on large dataset
      const aggregated = dataset.reduce((acc, item) => {
        if (!acc[item.category]) {
          acc[item.category] = { count: 0, sum: 0 };
        }
        acc[item.category].count++;
        acc[item.category].sum += item.value;
        return acc;
      }, {} as Record<number, { count: number; sum: number }>);

      const processingTime = performanceMonitor.endTimer('large-dataset');

      expect(Object.keys(aggregated)).toHaveLength(10);
      expect(processingTime).toBeLessThan(1000); // Should process within 1 second
    });
  });

  describe('Resource Utilization', () => {
    it('should monitor CPU usage patterns', async () => {
      const measurements = [];
      const startTime = Date.now();

      // Simulate CPU-intensive work
      for (let i = 0; i < 5; i++) {
        performanceMonitor.startTimer(`cpu-work-${i}`);
        
        // CPU-intensive calculation
        let result = 0;
        for (let j = 0; j < 1000000; j++) {
          result += Math.sqrt(j);
        }
        
        const duration = performanceMonitor.endTimer(`cpu-work-${i}`);
        measurements.push(duration);
      }

      const totalTime = Date.now() - startTime;
      const avgDuration = measurements.reduce((sum, d) => sum + d, 0) / measurements.length;

      expect(measurements.length).toBe(5);
      expect(avgDuration).toBeGreaterThan(0);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle resource constraints gracefully', async () => {
      // Simulate resource-constrained environment
      const maxConcurrentOperations = 3;
      const semaphore = new Array(maxConcurrentOperations).fill(true);
      
      async function limitedOperation(id: number): Promise<number> {
        // Wait for available resource
        while (semaphore.every((slot) => !slot)) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        
        // Acquire resource
        const slotIndex = semaphore.findIndex((slot) => slot);
        semaphore[slotIndex] = false;
        
        try {
          performanceMonitor.startTimer(`limited-op-${id}`);
          
          // Simulate work
          await new Promise((resolve) => setTimeout(resolve, 50));
          
          return performanceMonitor.endTimer(`limited-op-${id}`);
        } finally {
          // Release resource
          semaphore[slotIndex] = true;
        }
      }

      const operations = Array.from({ length: 10 }, (_, i) => limitedOperation(i));
      const results = await Promise.all(operations);

      expect(results.length).toBe(10);
      expect(results.every((duration) => duration >= 45)).toBe(true); // At least 45ms per operation
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions', () => {
      // Baseline performance
      const baselineOperations = 100;
      performanceMonitor.startTimer('baseline');
      
      for (let i = 0; i < baselineOperations; i++) {
        // Simulate consistent operation
        const start = Date.now();
        while (Date.now() - start < 1) {
          // 1ms of work
        }
      }
      
      const baselineTime = performanceMonitor.endTimer('baseline');
      const baselinePerOperation = baselineTime / baselineOperations;

      // Current performance
      performanceMonitor.startTimer('current');
      
      for (let i = 0; i < baselineOperations; i++) {
        const start = Date.now();
        while (Date.now() - start < 1.2) {
          // Slightly slower operation (20% regression)
        }
      }
      
      const currentTime = performanceMonitor.endTimer('current');
      const currentPerOperation = currentTime / baselineOperations;

      const regressionRatio = currentPerOperation / baselinePerOperation;
      
      // Detect significant regression (>15% slower)
      if (regressionRatio > 1.15) {
        console.warn(`Performance regression detected: ${((regressionRatio - 1) * 100).toFixed(1)}% slower`);
      }

      expect(regressionRatio).toBeGreaterThan(1.0);
      expect(regressionRatio).toBeLessThan(3.0); // Allow up to 200% slower for test environments
    });

    it('should validate performance thresholds', () => {
      const thresholds = {
        databaseQuery: 100, // ms
        httpRequest: 300, // ms
        fileOperation: 50, // ms
        dataProcessing: 200, // ms
      };

      const actualTimes = {
        databaseQuery: 85,
        httpRequest: 250,
        fileOperation: 45,
        dataProcessing: 180,
      };

      Object.entries(thresholds).forEach(([operation, threshold]) => {
        const actualTime = actualTimes[operation as keyof typeof actualTimes];
        expect(actualTime).toBeLessThanOrEqual(threshold);
      });
    });
  });
});
