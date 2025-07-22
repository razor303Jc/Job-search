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

    // Static files serving
    await this.server.register(import('@fastify/static'), {
      root: join(__dirname, '../../web/static'),
      prefix: '/static/',
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
        this.connectionManager.sendToConnection(ws, { type: 'pong' });
        break;

      case 'subscribe-jobs':
        // Subscribe to job updates for specific criteria
        this.connectionManager.sendToConnection(ws, {
          type: 'subscribed',
          data: { subscription: 'jobs', criteria: data.criteria },
        });
        break;

      default:
        logger.warn({ messageType: data.type }, 'Unknown WebSocket message type');
    }
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
