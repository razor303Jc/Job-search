/**
 * Memory & Resource Usage Monitoring for Job Dorker
 * Monitors system resources during performance testing
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ResourceMonitor {
  constructor(options = {}) {
    this.interval = options.interval || 1000; // 1 second default
    this.duration = options.duration || 60000; // 1 minute default
    this.metrics = [];
    this.monitoring = false;
    this.startTime = null;
  }

  /**
   * Get current system memory usage
   */
  getMemoryUsage() {
    const memUsage = process.memoryUsage();
    
    return {
      timestamp: Date.now(),
      rss: memUsage.rss, // Resident Set Size
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      // Convert to MB for readability
      rssMB: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      externalMB: Math.round(memUsage.external / 1024 / 1024 * 100) / 100
    };
  }

  /**
   * Get CPU usage (requires external monitoring)
   */
  async getCpuUsage() {
    return new Promise((resolve, reject) => {
      // Use Node.js process.cpuUsage() for basic CPU tracking
      const usage = process.cpuUsage();
      
      resolve({
        user: usage.user,
        system: usage.system,
        total: usage.user + usage.system
      });
    });
  }

  /**
   * Get system load average (Unix-like systems)
   */
  async getSystemLoad() {
    try {
      const { loadavg, cpus } = await import('node:os');
      const loadAvg = loadavg();
      
      return {
        load1min: Math.round(loadAvg[0] * 100) / 100,
        load5min: Math.round(loadAvg[1] * 100) / 100,
        load15min: Math.round(loadAvg[2] * 100) / 100,
        cpuCount: cpus().length
      };
    } catch (error) {
      return {
        load1min: 0,
        load5min: 0,
        load15min: 0,
        cpuCount: 1,
        error: 'Load average not available'
      };
    }
  }

  /**
   * Start monitoring resources
   */
  async startMonitoring() {
    if (this.monitoring) {
      console.log('⚠️  Resource monitoring already running');
      return;
    }

    console.log('📊 Starting resource monitoring...');
    this.monitoring = true;
    this.startTime = Date.now();
    this.metrics = [];

    const monitoringLoop = async () => {
      if (!this.monitoring) return;

      try {
        const memUsage = this.getMemoryUsage();
        const cpuUsage = await this.getCpuUsage();
        const systemLoad = await this.getSystemLoad();

        const metric = {
          timestamp: Date.now(),
          elapsedSeconds: Math.round((Date.now() - this.startTime) / 1000),
          memory: memUsage,
          cpu: cpuUsage,
          system: systemLoad
        };

        this.metrics.push(metric);

        // Auto-stop if duration exceeded
        if (this.duration && (Date.now() - this.startTime) >= this.duration) {
          this.stopMonitoring();
          return;
        }

        setTimeout(monitoringLoop, this.interval);
      } catch (error) {
        console.error('Error during resource monitoring:', error);
        this.stopMonitoring();
      }
    };

    // Start the monitoring loop
    setTimeout(monitoringLoop, this.interval);
  }

  /**
   * Stop monitoring resources
   */
  stopMonitoring() {
    if (!this.monitoring) return;

    this.monitoring = false;
    console.log('🛑 Resource monitoring stopped');
    console.log(`📈 Collected ${this.metrics.length} data points over ${Math.round((Date.now() - this.startTime) / 1000)}s`);
  }

  /**
   * Get monitoring summary
   */
  getSummary() {
    if (this.metrics.length === 0) {
      return { error: 'No metrics collected' };
    }

    const memMetrics = this.metrics.map(m => m.memory);
    const cpuMetrics = this.metrics.map(m => m.cpu);

    // Memory statistics
    const rssMB = memMetrics.map(m => m.rssMB);
    const heapUsedMB = memMetrics.map(m => m.heapUsedMB);

    const memSummary = {
      rss: {
        min: Math.min(...rssMB),
        max: Math.max(...rssMB),
        avg: Math.round(rssMB.reduce((a, b) => a + b, 0) / rssMB.length * 100) / 100,
        current: rssMB[rssMB.length - 1]
      },
      heapUsed: {
        min: Math.min(...heapUsedMB),
        max: Math.max(...heapUsedMB),
        avg: Math.round(heapUsedMB.reduce((a, b) => a + b, 0) / heapUsedMB.length * 100) / 100,
        current: heapUsedMB[heapUsedMB.length - 1]
      }
    };

    // CPU statistics (if available)
    const cpuTotal = cpuMetrics.map(m => m.total);
    const cpuSummary = cpuTotal.length > 0 ? {
      min: Math.min(...cpuTotal),
      max: Math.max(...cpuTotal),
      avg: Math.round(cpuTotal.reduce((a, b) => a + b, 0) / cpuTotal.length),
      current: cpuTotal[cpuTotal.length - 1]
    } : null;

    // System load (if available)
    const systemMetrics = this.metrics.map(m => m.system);
    const load1min = systemMetrics.map(m => m.load1min).filter(l => l > 0);
    const systemSummary = load1min.length > 0 ? {
      load1min: {
        min: Math.min(...load1min),
        max: Math.max(...load1min),
        avg: Math.round(load1min.reduce((a, b) => a + b, 0) / load1min.length * 100) / 100,
        current: load1min[load1min.length - 1]
      },
      cpuCount: systemMetrics[0]?.cpuCount || 1
    } : null;

    return {
      duration: Math.round((this.metrics[this.metrics.length - 1].timestamp - this.metrics[0].timestamp) / 1000),
      dataPoints: this.metrics.length,
      memory: memSummary,
      cpu: cpuSummary,
      system: systemSummary,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date(this.metrics[this.metrics.length - 1].timestamp).toISOString()
    };
  }

  /**
   * Export metrics to file
   */
  exportMetrics(outputPath) {
    const summary = this.getSummary();
    const exportData = {
      summary,
      rawMetrics: this.metrics,
      configuration: {
        interval: this.interval,
        duration: this.duration
      }
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`📄 Resource metrics exported to: ${outputPath}`);
    
    return exportData;
  }

  /**
   * Generate HTML report for resource usage
   */
  generateHtmlReport() {
    const summary = this.getSummary();
    
    if (summary.error) {
      return `<div>Error: ${summary.error}</div>`;
    }

    const memoryChart = this.generateMemoryChart();
    
    return `
    <div class="resource-monitor-section">
        <h3>📊 Resource Usage Monitoring</h3>
        
        <div class="resource-summary">
            <div class="resource-metric">
                <h4>Memory Usage (RSS)</h4>
                <div class="metric-values">
                    <span class="metric-current">Current: ${summary.memory.rss.current}MB</span>
                    <span class="metric-avg">Avg: ${summary.memory.rss.avg}MB</span>
                    <span class="metric-range">Range: ${summary.memory.rss.min}MB - ${summary.memory.rss.max}MB</span>
                </div>
            </div>
            
            <div class="resource-metric">
                <h4>Heap Usage</h4>
                <div class="metric-values">
                    <span class="metric-current">Current: ${summary.memory.heapUsed.current}MB</span>
                    <span class="metric-avg">Avg: ${summary.memory.heapUsed.avg}MB</span>
                    <span class="metric-range">Range: ${summary.memory.heapUsed.min}MB - ${summary.memory.heapUsed.max}MB</span>
                </div>
            </div>
            
            ${summary.system ? `
            <div class="resource-metric">
                <h4>System Load</h4>
                <div class="metric-values">
                    <span class="metric-current">Current: ${summary.system.load1min.current}</span>
                    <span class="metric-avg">Avg: ${summary.system.load1min.avg}</span>
                    <span class="metric-info">CPU Cores: ${summary.system.cpuCount}</span>
                </div>
            </div>
            ` : ''}
        </div>
        
        <div class="monitoring-info">
            <p><strong>Monitoring Duration:</strong> ${summary.duration} seconds</p>
            <p><strong>Data Points:</strong> ${summary.dataPoints}</p>
            <p><strong>Collection Interval:</strong> ${this.interval / 1000} seconds</p>
        </div>
        
        ${memoryChart}
    </div>
    
    <style>
        .resource-monitor-section { margin: 20px 0; padding: 20px; background: #f9f9f9; border-radius: 8px; }
        .resource-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .resource-metric { background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #2196F3; }
        .resource-metric h4 { margin: 0 0 10px 0; color: #333; }
        .metric-values { display: flex; flex-direction: column; gap: 5px; }
        .metric-current { font-weight: bold; color: #2196F3; }
        .metric-avg { color: #4CAF50; }
        .metric-range { font-size: 12px; color: #666; }
        .metric-info { font-size: 12px; color: #666; }
        .monitoring-info { background: white; padding: 10px; border-radius: 5px; font-size: 14px; }
        .memory-chart { margin-top: 20px; }
    </style>`;
  }

  /**
   * Generate simple ASCII memory chart
   */
  generateMemoryChart() {
    if (this.metrics.length === 0) return '';

    const memData = this.metrics.map(m => m.memory.rssMB);
    const maxMem = Math.max(...memData);
    const minMem = Math.min(...memData);
    const range = maxMem - minMem;
    
    if (range === 0) {
      return '<div class="memory-chart"><p>Memory usage remained constant at ' + maxMem + 'MB</p></div>';
    }

    // Create simple chart data for visualization
    const chartData = memData.map((mem, index) => {
      const normalized = (mem - minMem) / range;
      const timePoint = this.metrics[index].elapsedSeconds;
      return `${timePoint}s: ${mem}MB`;
    });

    return `
    <div class="memory-chart">
        <h4>Memory Usage Over Time</h4>
        <div class="chart-info">
            <p>Peak: ${maxMem}MB | Low: ${minMem}MB | Range: ${Math.round(range * 100) / 100}MB</p>
        </div>
        <div class="chart-data" style="font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto;">
            ${chartData.slice(-20).map(point => `<div>${point}</div>`).join('')}
            ${chartData.length > 20 ? '<div>... (showing last 20 data points)</div>' : ''}
        </div>
    </div>`;
  }
}

export { ResourceMonitor };
