/**
 * Enhanced Fastify Web Server v2
 * Phase 7: Real-time features with WebSocket support
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import websocket from '@fastify/websocket';
import { type FastifyInstance, fastify } from 'fastify';
import type { WebSocket } from 'ws';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  remote: boolean;
  employmentType: string;
  postedDate: string;
}

/**
 * WebSocket connection manager for real-time updates
 */
class ConnectionManager {
  private connections = new Set<WebSocket>();
  private scrapingStatus = {
    active: false,
    totalJobs: 0,
    newJobs: 0,
    progress: 0,
    errors: 0,
  };

  addConnection(ws: WebSocket): void {
    this.connections.add(ws);

    // Send current status to new connection
    this.sendToConnection(ws, {
      type: 'status',
      data: this.scrapingStatus,
    });

    ws.on('close', () => {
      this.connections.delete(ws);
    });
  }

  broadcast(message: object): void {
    const payload = JSON.stringify(message);
    this.connections.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    });
  }

  sendToConnection(ws: WebSocket, message: object): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  updateScrapingStatus(status: Partial<typeof this.scrapingStatus>): void {
    this.scrapingStatus = { ...this.scrapingStatus, ...status };
    this.broadcast({
      type: 'scraping-status',
      data: this.scrapingStatus,
    });
  }

  notifyNewJob(job: JobPosting): void {
    this.broadcast({
      type: 'new-job',
      data: job,
    });
  }

  getConnectionCount(): number {
    return this.connections.size;
  }
}

/**
 * Enhanced Fastify server with real-time capabilities
 */
export class EnhancedWebServer {
  private server: FastifyInstance;
  private connectionManager = new ConnectionManager();

  constructor() {
    this.server = fastify({
      logger: {
        level: process.env.LOG_LEVEL || 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
      },
    });

    this.setupMiddleware();
    this.setupRoutes();
  }

  private async setupMiddleware(): Promise<void> {
    // Register WebSocket plugin
    await this.server.register(websocket);

    // CORS support
    await this.server.register(import('@fastify/cors'), {
      origin: true,
      credentials: true,
    });

    // Rate limiting
    await this.server.register(import('@fastify/rate-limit'), {
      max: 100,
      timeWindow: '1 minute',
    });

    // Static files serving - with /static/ prefix
    await this.server.register(import('@fastify/static'), {
      root: join(__dirname, 'static'),
      prefix: '/static/',
    });

    // Static files serving - without prefix for direct access
    await this.server.register(import('@fastify/static'), {
      root: join(__dirname, 'static'),
      decorateReply: false,
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.close());
    process.on('SIGINT', () => this.close());
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.server.get('/health', async () => {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        websocket: {
          connections: this.connectionManager.getConnectionCount(),
        },
      };
    });

    // Serve dashboard at root
    this.server.get('/', async (_request, reply) => {
      return reply.sendFile('index.html');
    });

    // WebSocket endpoint for real-time updates
    this.server.register(async (fastify) => {
      fastify.get('/ws', { websocket: true }, (connection) => {
        this.connectionManager.addConnection(connection);
        logger.info('New WebSocket connection established');

        // Handle incoming messages
        connection.on('message', (message: Buffer) => {
          try {
            const data = JSON.parse(message.toString());
            this.handleWebSocketMessage(connection, data);
          } catch (error) {
            logger.error({ err: error }, 'Failed to parse WebSocket message');
          }
        });

        connection.on('close', () => {
          logger.info('WebSocket connection closed');
        });
      });
    });

    // API v2 Routes
    this.setupApiV2Routes();
  }

  private setupApiV2Routes(): void {
    // API v2 prefix
    this.server.register(async (fastify) => {
      // Enhanced job search with real-time updates
      fastify.get('/api/v2/jobs', async (_request, reply) => {
        try {
          // Mock data for now - will integrate with database later
          const mockJobs: JobPosting[] = [
            {
              id: '1',
              title: 'Senior Software Engineer',
              company: 'TechCorp',
              location: 'San Francisco, CA',
              salary: { min: 120000, max: 180000, currency: 'USD' },
              remote: true,
              employmentType: 'full-time',
              postedDate: new Date().toISOString(),
            },
          ];

          return {
            jobs: mockJobs,
            pagination: {
              page: 1,
              limit: 20,
              total: mockJobs.length,
              totalPages: 1,
              hasNext: false,
              hasPrev: false,
            },
          };
        } catch (error) {
          logger.error({ err: error }, 'Failed to fetch jobs');
          reply.code(500);
          return { error: 'Internal server error' };
        }
      });

      // Real-time statistics endpoint
      fastify.get('/api/v2/stats', async (_request, reply) => {
        try {
          // Mock statistics for now
          const stats = {
            totalJobs: 150,
            totalCompanies: 42,
            remoteJobs: 89,
            averageSalary: 125000,
            lastUpdated: new Date().toISOString(),
          };

          return {
            ...stats,
            websocket: {
              connections: this.connectionManager.getConnectionCount(),
            },
          };
        } catch (error) {
          logger.error({ err: error }, 'Failed to fetch statistics');
          reply.code(500);
          return { error: 'Internal server error' };
        }
      });

      // Start scraping endpoint with real-time updates
      fastify.post('/api/v2/scraping/start', async (_request, reply) => {
        try {
          // Simulate scraping start
          this.connectionManager.updateScrapingStatus({
            active: true,
            totalJobs: 0,
            newJobs: 0,
            progress: 0,
            errors: 0,
          });

          return { message: 'Scraping started', timestamp: new Date().toISOString() };
        } catch (error) {
          logger.error({ err: error }, 'Failed to start scraping');
          reply.code(500);
          return { error: 'Internal server error' };
        }
      });

      // Stop scraping endpoint
      fastify.post('/api/v2/scraping/stop', async (_request, reply) => {
        try {
          this.connectionManager.updateScrapingStatus({
            active: false,
            progress: 100,
          });

          return { message: 'Scraping stopped', timestamp: new Date().toISOString() };
        } catch (error) {
          logger.error({ err: error }, 'Failed to stop scraping');
          reply.code(500);
          return { error: 'Internal server error' };
        }
      });
    });
  }

  private handleWebSocketMessage(ws: WebSocket, data: any): void {
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'get-stats':
        this.sendServerStats(ws);
        break;

      case 'get-analytics':
        this.sendAnalyticsData(ws);
        break;

      case 'search':
        this.handleJobSearch(ws, data);
        break;

      case 'get-scraper-status':
        this.sendScraperStatus(ws);
        break;

      case 'get-scraper-stats':
        this.sendScraperStats(ws);
        break;

      case 'start-all-scrapers':
        this.handleStartAllScrapers(ws);
        break;

      case 'stop-all-scrapers':
        this.handleStopAllScrapers(ws);
        break;

      case 'create-alert':
        this.handleCreateAlert(ws, data);
        break;

      case 'delete-alert':
        this.handleDeleteAlert(ws, data);
        break;

      case 'toggle-alert':
        this.handleToggleAlert(ws, data);
        break;

      default:
        logger.warn({ messageType: data.type }, 'Unknown WebSocket message type');
    }
  }

  private sendServerStats(ws: WebSocket): void {
    const uptime = process.uptime();
    const formatUptime = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    };

    const stats = {
      type: 'stats',
      data: {
        activeConnections: this.connectionManager.getConnectionCount(),
        uptime: formatUptime(uptime),
        totalJobs: 1247, // Mock data - will integrate with database
        serverStartTime: new Date(Date.now() - uptime * 1000).toISOString(),
        memoryUsage: process.memoryUsage(),
      },
    };

    ws.send(JSON.stringify(stats));
  }

  private sendAnalyticsData(ws: WebSocket): void {
    // Mock analytics data - will integrate with database
    const analyticsData = {
      type: 'analytics',
      data: {
        salaryDistribution: [125, 287, 365, 198, 89], // $30-50k, $50-75k, $75-100k, $100-150k, $150k+
        topCompanies: [
          { company: 'Google', count: 67 },
          { company: 'Microsoft', count: 54 },
          { company: 'Amazon', count: 48 },
          { company: 'Meta', count: 42 },
          { company: 'Apple', count: 39 },
          { company: 'Netflix', count: 31 },
          { company: 'Salesforce', count: 28 },
          { company: 'Uber', count: 25 },
        ],
        topLocations: [
          { location: 'Remote', count: 234 },
          { location: 'San Francisco, CA', count: 189 },
          { location: 'New York, NY', count: 156 },
          { location: 'Seattle, WA', count: 134 },
          { location: 'Austin, TX', count: 89 },
          { location: 'Boston, MA', count: 78 },
          { location: 'Los Angeles, CA', count: 65 },
        ],
        employmentTypes: {
          'Full-time': 856,
          Contract: 198,
          'Part-time': 123,
          Freelance: 45,
          Internship: 25,
        },
        industryTrends: [
          { industry: 'Technology', count: 445, growth: '+12%' },
          { industry: 'Healthcare', count: 234, growth: '+8%' },
          { industry: 'Finance', count: 198, growth: '+15%' },
          { industry: 'Education', count: 156, growth: '+6%' },
          { industry: 'Retail', count: 134, growth: '-2%' },
        ],
      },
    };

    ws.send(JSON.stringify(analyticsData));
  }

  private async handleJobSearch(ws: WebSocket, data: any): Promise<void> {
    try {
      const { query = '', filters = {} } = data;

      // Mock search results - will integrate with database
      const allMockJobs = [
        {
          id: '1',
          title: 'Senior Frontend Developer',
          company: 'Google',
          location: 'San Francisco, CA',
          salary: { min: 140000, max: 200000, currency: 'USD' },
          remote: false,
          employmentType: 'full-time',
          description: 'Build amazing user experiences with React and TypeScript',
          skills: ['React', 'TypeScript', 'JavaScript', 'CSS'],
          postedDate: new Date('2024-01-15').toISOString(),
        },
        {
          id: '2',
          title: 'Backend Engineer',
          company: 'Microsoft',
          location: 'Remote',
          salary: { min: 120000, max: 170000, currency: 'USD' },
          remote: true,
          employmentType: 'full-time',
          description: 'Design and build scalable backend systems',
          skills: ['Node.js', 'Python', 'PostgreSQL', 'AWS'],
          postedDate: new Date('2024-01-14').toISOString(),
        },
        {
          id: '3',
          title: 'Full Stack Developer',
          company: 'Amazon',
          location: 'Seattle, WA',
          salary: { min: 110000, max: 160000, currency: 'USD' },
          remote: false,
          employmentType: 'full-time',
          description: 'Work on both frontend and backend systems',
          skills: ['React', 'Node.js', 'AWS', 'DynamoDB'],
          postedDate: new Date('2024-01-13').toISOString(),
        },
        {
          id: '4',
          title: 'DevOps Engineer',
          company: 'Meta',
          location: 'New York, NY',
          salary: { min: 130000, max: 180000, currency: 'USD' },
          remote: false,
          employmentType: 'contract',
          description: 'Manage infrastructure and deployment pipelines',
          skills: ['Kubernetes', 'Docker', 'AWS', 'Terraform'],
          postedDate: new Date('2024-01-12').toISOString(),
        },
        {
          id: '5',
          title: 'Data Scientist',
          company: 'Apple',
          location: 'Remote',
          salary: { min: 135000, max: 185000, currency: 'USD' },
          remote: true,
          employmentType: 'full-time',
          description: 'Analyze data to drive business decisions',
          skills: ['Python', 'Machine Learning', 'SQL', 'Tableau'],
          postedDate: new Date('2024-01-11').toISOString(),
        },
        {
          id: '6',
          title: 'Mobile Developer',
          company: 'Netflix',
          location: 'Los Angeles, CA',
          salary: { min: 125000, max: 175000, currency: 'USD' },
          remote: false,
          employmentType: 'full-time',
          description: 'Build mobile apps for iOS and Android',
          skills: ['Swift', 'Kotlin', 'React Native', 'Flutter'],
          postedDate: new Date('2024-01-10').toISOString(),
        },
      ];

      // Apply search filters
      let filteredJobs = allMockJobs;

      // Text search
      if (query) {
        const searchTerm = query.toLowerCase();
        filteredJobs = filteredJobs.filter(
          (job) =>
            job.title.toLowerCase().includes(searchTerm) ||
            job.company.toLowerCase().includes(searchTerm) ||
            job.description.toLowerCase().includes(searchTerm) ||
            job.skills.some((skill) => skill.toLowerCase().includes(searchTerm)),
        );
      }

      // Location filter
      if (filters.location) {
        const locationFilter = filters.location.toLowerCase();
        filteredJobs = filteredJobs.filter(
          (job) =>
            job.location.toLowerCase().includes(locationFilter) ||
            (locationFilter === 'remote' && job.remote),
        );
      }

      // Salary filter
      if (filters.minSalary) {
        const minSalary = Number.parseInt(filters.minSalary);
        filteredJobs = filteredJobs.filter((job) => job.salary && job.salary.min >= minSalary);
      }

      // Send search results
      const response = {
        type: 'search-results',
        data: filteredJobs.slice(0, 20), // Limit to 20 results
        metadata: {
          total: filteredJobs.length,
          query,
          filters,
          searchTime: Date.now(),
        },
      };

      ws.send(JSON.stringify(response));

      // Log search activity
      logger.info(
        {
          query,
          filters,
          resultsCount: filteredJobs.length,
        },
        'Job search performed',
      );
    } catch (error) {
      logger.error({ err: error }, 'Failed to handle job search');
      const errorResponse = {
        type: 'search-error',
        data: {
          message: 'Search failed. Please try again.',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      ws.send(JSON.stringify(errorResponse));
    }
  }

  /**
   * Send scraper status data for live scraping dashboard
   */
  private sendScraperStatus(ws: WebSocket): void {
    const scraperData = {
      type: 'scraper-status',
      data: {
        overall: 'active',
        active: 2,
        totalJobs: 245,
        successRate: 87,
        errors: 1,
        progress: 65,
        scrapers: [
          {
            name: 'LinkedIn Scraper',
            status: 'active',
            url: 'linkedin.com/jobs',
            jobsFound: 89,
            successRate: 92,
            lastRun: '2 min ago',
            responseTime: 1200,
            progress: 75,
          },
          {
            name: 'Indeed Scraper',
            status: 'active',
            url: 'indeed.com',
            jobsFound: 156,
            successRate: 85,
            lastRun: '1 min ago',
            responseTime: 800,
            progress: 60,
          },
          {
            name: 'Glassdoor Scraper',
            status: 'idle',
            url: 'glassdoor.com',
            jobsFound: 0,
            successRate: 78,
            lastRun: '10 min ago',
            responseTime: 2100,
            progress: 0,
          },
          {
            name: 'AngelList Scraper',
            status: 'error',
            url: 'angel.co',
            jobsFound: 0,
            successRate: 0,
            lastRun: '15 min ago',
            responseTime: 0,
            progress: 0,
            error: 'Rate limit exceeded',
          },
        ],
      },
    };

    ws.send(JSON.stringify(scraperData));
  }

  /**
   * Send scraper statistics for performance charts
   */
  private sendScraperStats(ws: WebSocket): void {
    const currentTime = Date.now();
    const statsData = {
      type: 'scraper-stats',
      data: {
        successRateHistory: [
          { timestamp: currentTime - 300000, rate: 85 },
          { timestamp: currentTime - 240000, rate: 87 },
          { timestamp: currentTime - 180000, rate: 89 },
          { timestamp: currentTime - 120000, rate: 84 },
          { timestamp: currentTime - 60000, rate: 87 },
          { timestamp: currentTime, rate: 87 },
        ],
        scraperPerformance: [
          { name: 'LinkedIn', jobsFound: 89, successRate: 92 },
          { name: 'Indeed', jobsFound: 156, successRate: 85 },
          { name: 'Glassdoor', jobsFound: 0, successRate: 78 },
          { name: 'AngelList', jobsFound: 0, successRate: 0 },
        ],
        errorStats: {
          total: 12,
          rateLimits: 5,
          timeouts: 3,
          parsing: 2,
          network: 2,
        },
        performanceMetrics: {
          avgResponseTime: 1200,
          totalRequests: 347,
          successfulRequests: 302,
          failedRequests: 45,
        },
      },
    };

    ws.send(JSON.stringify(statsData));
  }

  /**
   * Handle start all scrapers command
   */
  private handleStartAllScrapers(ws: WebSocket): void {
    logger.info('Starting all scrapers via WebSocket command');

    // Simulate starting all scrapers
    const response = {
      type: 'scraper-command-response',
      data: {
        command: 'start-all',
        status: 'success',
        message: 'All scrapers started successfully',
        timestamp: new Date().toISOString(),
        activeScrapers: ['LinkedIn', 'Indeed', 'Glassdoor'],
      },
    };

    ws.send(JSON.stringify(response));

    // Broadcast status update to all clients
    this.connectionManager.broadcast({
      type: 'scraper-status-update',
      data: {
        action: 'started',
        affectedScrapers: ['LinkedIn', 'Indeed', 'Glassdoor'],
        timestamp: new Date().toISOString(),
      },
    });

    // Start a progress simulation
    this.simulateScrapingProgress();
  }

  /**
   * Handle stop all scrapers command
   */
  private handleStopAllScrapers(ws: WebSocket): void {
    logger.info('Stopping all scrapers via WebSocket command');

    // Simulate stopping all scrapers
    const response = {
      type: 'scraper-command-response',
      data: {
        command: 'stop-all',
        status: 'success',
        message: 'All scrapers stopped successfully',
        timestamp: new Date().toISOString(),
        stoppedScrapers: ['LinkedIn', 'Indeed', 'Glassdoor'],
      },
    };

    ws.send(JSON.stringify(response));

    // Broadcast status update to all clients
    this.connectionManager.broadcast({
      type: 'scraper-status-update',
      data: {
        action: 'stopped',
        affectedScrapers: ['LinkedIn', 'Indeed', 'Glassdoor'],
        timestamp: new Date().toISOString(),
      },
    });

    // Update connection manager status
    this.connectionManager.updateScrapingStatus({
      active: false,
      progress: 0,
    });
  }

  /**
   * Simulate scraper errors for demo purposes
   */
  private simulateScraperErrors(): void {
    const errorTypes = [
      'Rate limit exceeded',
      'Connection timeout',
      'Parsing error',
      'Network error',
      'Authentication failed',
    ];

    setInterval(() => {
      if (Math.random() < 0.3) {
        // 30% chance of error every interval
        const error = errorTypes[Math.floor(Math.random() * errorTypes.length)];
        this.connectionManager.broadcast({
          type: 'scraping-error',
          data: {
            message: error,
            scraper: ['LinkedIn', 'Indeed', 'Glassdoor'][Math.floor(Math.random() * 3)],
            severity: Math.random() > 0.5 ? 'warning' : 'error',
            timestamp: new Date().toISOString(),
          },
        });
      }
    }, 15000); // Every 15 seconds
  }

  /**
   * Handle creating a new job alert
   */
  private handleCreateAlert(ws: WebSocket, data: any): void {
    try {
      const alert = data.data;
      logger.info({ alertId: alert.id, criteria: alert.criteria }, 'New job alert created');

      const response = {
        type: 'alert-created',
        data: {
          alertId: alert.id,
          status: 'success',
          message: 'Alert created successfully',
          timestamp: new Date().toISOString(),
        },
      };

      ws.send(JSON.stringify(response));

      // Simulate immediate job matching check
      setTimeout(() => {
        this.checkExistingJobsForAlert(alert);
      }, 2000);
    } catch (error) {
      logger.error({ err: error }, 'Failed to create job alert');
      ws.send(
        JSON.stringify({
          type: 'alert-error',
          data: {
            message: 'Failed to create alert',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        }),
      );
    }
  }

  /**
   * Handle deleting a job alert
   */
  private handleDeleteAlert(ws: WebSocket, data: any): void {
    try {
      const { alertId } = data.data;
      logger.info({ alertId }, 'Job alert deleted');

      const response = {
        type: 'alert-deleted',
        data: {
          alertId,
          status: 'success',
          message: 'Alert deleted successfully',
          timestamp: new Date().toISOString(),
        },
      };

      ws.send(JSON.stringify(response));
    } catch (error) {
      logger.error({ err: error }, 'Failed to delete job alert');
      ws.send(
        JSON.stringify({
          type: 'alert-error',
          data: {
            message: 'Failed to delete alert',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        }),
      );
    }
  }

  /**
   * Handle toggling a job alert active/inactive
   */
  private handleToggleAlert(ws: WebSocket, data: any): void {
    try {
      const { alertId, active } = data.data;
      logger.info({ alertId, active }, 'Job alert toggled');

      const response = {
        type: 'alert-toggled',
        data: {
          alertId,
          active,
          status: 'success',
          message: `Alert ${active ? 'activated' : 'deactivated'} successfully`,
          timestamp: new Date().toISOString(),
        },
      };

      ws.send(JSON.stringify(response));
    } catch (error) {
      logger.error({ err: error }, 'Failed to toggle job alert');
      ws.send(
        JSON.stringify({
          type: 'alert-error',
          data: {
            message: 'Failed to toggle alert',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        }),
      );
    }
  }

  /**
   * Check existing jobs against a new alert for immediate matches
   */
  private checkExistingJobsForAlert(alert: any): void {
    // Mock job matching simulation
    const mockJobs = [
      {
        id: '1',
        title: 'Senior React Developer',
        company: 'Google',
        location: 'San Francisco, CA',
        salary: { min: 140000, max: 200000, currency: 'USD' },
        remote: false,
        employmentType: 'full-time',
      },
      {
        id: '2',
        title: 'Frontend Engineer',
        company: 'Microsoft',
        location: 'Remote',
        salary: { min: 120000, max: 170000, currency: 'USD' },
        remote: true,
        employmentType: 'full-time',
      },
    ];

    // Simple matching logic for demo
    const matchingJobs = mockJobs.filter((job) => {
      if (alert.criteria.keywords && alert.criteria.keywords.length > 0) {
        return alert.criteria.keywords.some((keyword: string) =>
          job.title.toLowerCase().includes(keyword.toLowerCase()),
        );
      }
      return false;
    });

    if (matchingJobs.length > 0) {
      this.connectionManager.broadcast({
        type: 'job-match',
        data: {
          alert: alert,
          matchingJobs: matchingJobs,
          totalMatches: matchingJobs.length,
          timestamp: new Date().toISOString(),
        },
      });

      logger.info(
        {
          alertId: alert.id,
          matches: matchingJobs.length,
        },
        'Job matches found for new alert',
      );
    }
  }

  /**
   * Simulate new job notifications for demo purposes
   */
  private simulateNewJobNotifications(): void {
    const mockJobTitles = [
      'Senior Software Engineer',
      'Frontend Developer',
      'Backend Engineer',
      'Full Stack Developer',
      'DevOps Engineer',
      'Data Scientist',
      'Product Manager',
      'UI/UX Designer',
    ];

    const mockCompanies = [
      'Google',
      'Microsoft',
      'Amazon',
      'Meta',
      'Apple',
      'Netflix',
      'Salesforce',
      'Uber',
      'Airbnb',
      'Spotify',
    ];

    const mockLocations = [
      'San Francisco, CA',
      'New York, NY',
      'Seattle, WA',
      'Austin, TX',
      'Remote',
      'Boston, MA',
      'Los Angeles, CA',
    ];

    setInterval(() => {
      if (Math.random() < 0.4) {
        // 40% chance of new job every interval
        const newJob = {
          id: `job_${Date.now()}`,
          title: mockJobTitles[Math.floor(Math.random() * mockJobTitles.length)],
          company: mockCompanies[Math.floor(Math.random() * mockCompanies.length)],
          location: mockLocations[Math.floor(Math.random() * mockLocations.length)],
          salary: {
            min: 80000 + Math.floor(Math.random() * 100000),
            max: 120000 + Math.floor(Math.random() * 100000),
            currency: 'USD',
          },
          remote: Math.random() > 0.6,
          employmentType: ['full-time', 'contract', 'part-time'][Math.floor(Math.random() * 3)],
          postedDate: new Date().toISOString(),
        };

        this.connectionManager.broadcast({
          type: 'new-job',
          data: newJob,
        });

        logger.info({ jobId: newJob.id, title: newJob.title }, 'New job posted');
      }
    }, 20000); // Every 20 seconds
  }

  /**
   * Simulate scraping progress for demo purposes
   */
  simulateScrapingProgress(): void {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 10;

      if (progress >= 100) {
        progress = 100;
        this.connectionManager.updateScrapingStatus({
          active: false,
          progress: 100,
        });
        clearInterval(interval);
      } else {
        this.connectionManager.updateScrapingStatus({
          active: true,
          progress: Math.round(progress),
          totalJobs: Math.floor(progress * 2),
          newJobs: Math.floor(Math.random() * 5),
        });
      }
    }, 1000);
  }

  async start(port = 3000, host = '0.0.0.0'): Promise<void> {
    try {
      await this.server.listen({ port, host });
      logger.info(`Enhanced web server started on http://${host}:${port}`);
      logger.info('WebSocket endpoint available at ws://localhost:3000/ws');

      // Start demo scraping simulation
      setTimeout(() => this.simulateScrapingProgress(), 2000);

      // Start error simulation for demo
      setTimeout(() => this.simulateScraperErrors(), 5000);

      // Start new job notifications simulation
      setTimeout(() => this.simulateNewJobNotifications(), 10000);
    } catch (error) {
      logger.error({ err: error }, 'Failed to start enhanced web server');
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.server.close();
      logger.info('Enhanced web server closed');
    } catch (error) {
      logger.error({ err: error }, 'Error closing enhanced web server');
    }
  }

  getServer(): FastifyInstance {
    return this.server;
  }

  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }
}

// Default export for direct usage
export default EnhancedWebServer;
