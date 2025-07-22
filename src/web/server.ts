/**
 * Fastify web server for Job Dorker
 * Provides REST API and web interface for job searching and management
 */

import { join } from 'node:path';
import { initializeDatabase } from '@/database/index.js';
import type { DatabaseServices } from '@/database/index.js';
import { logger } from '@/utils/logger.js';
import Fastify, { type FastifyInstance } from 'fastify';

export interface ServerConfig {
  host?: string;
  port?: number;
  logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

export class JobDorkerServer {
  private server: FastifyInstance;
  private db?: DatabaseServices;
  private config: Required<ServerConfig>;

  constructor(config: ServerConfig = {}) {
    this.config = {
      host: config.host || '0.0.0.0',
      port: config.port || 3000,
      logLevel: config.logLevel || 'info',
    };

    // Create Fastify instance
    this.server = Fastify({
      logger: {
        level: this.config.logLevel,
      },
    });

    this.setupRoutes();
    this.setupErrorHandlers();
  }

  /**
   * Setup Fastify plugins
   */
  private async setupPlugins(): Promise<void> {
    // Static file serving (make it optional if directory doesn't exist)
    try {
      await this.server.register(import('@fastify/static'), {
        root: join(process.cwd(), 'src', 'web', 'public'),
        prefix: '/public/',
      });
    } catch (error) {
      logger.warn('Static file serving disabled - public directory not found', { error });
    }

    // CORS support
    await this.server.register(import('@fastify/cors'), {
      origin: true,
    });

    // JSON parser
    await this.server.register(import('@fastify/sensible'));

    logger.debug('Fastify plugins registered successfully');
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.server.get('/health', async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: this.db ? 'connected' : 'disconnected',
      };
    });

    // API routes
    this.server.register(this.apiRoutes, { prefix: '/api/v1' });

    // Web interface routes
    this.server.register(this.webRoutes);

    logger.debug('Routes registered successfully');
  }

  /**
   * API routes for job management
   */
  private apiRoutes = async (server: FastifyInstance): Promise<void> => {
    // Jobs API
    server.register(async (jobsServer) => {
      // GET /api/v1/jobs - List jobs with filtering
      jobsServer.get('/jobs', async (request, reply) => {
        if (!this.db) {
          return reply.status(503).send({ error: 'Database not available' });
        }

        const query = request.query as any;
        const filters: Parameters<typeof this.db.jobs.findMany>[0] = {};

        if (query.company) filters.company = query.company;
        if (query.location) filters.location = query.location;
        if (query.salaryMin) filters.salaryMin = Number(query.salaryMin);
        if (query.salaryMax) filters.salaryMax = Number(query.salaryMax);
        if (query.employmentType) filters.employmentType = query.employmentType;
        if (query.remoteType) filters.remoteType = query.remoteType;
        if (query.postedAfter) filters.postedAfter = new Date(query.postedAfter);
        if (query.limit) filters.limit = Number(query.limit);
        if (query.offset) filters.offset = Number(query.offset);

        // Set defaults
        filters.limit = filters.limit || 50;
        filters.offset = filters.offset || 0;

        try {
          const jobs = await this.db.jobs.findMany(filters);
          const total = await this.db.jobs.count(filters);

          return {
            jobs,
            pagination: {
              total,
              limit: filters.limit,
              offset: filters.offset,
              hasMore: filters.offset + filters.limit < total,
            },
          };
        } catch (error) {
          logger.error('Failed to fetch jobs', { error });
          return reply.status(500).send({ error: 'Failed to fetch jobs' });
        }
      });

      // GET /api/v1/jobs/:id - Get specific job
      jobsServer.get('/jobs/:id', async (request, reply) => {
        if (!this.db) {
          return reply.status(503).send({ error: 'Database not available' });
        }

        const { id } = request.params as { id: string };

        try {
          const job = await this.db.jobs.findById(Number(id));
          if (!job) {
            return reply.status(404).send({ error: 'Job not found' });
          }
          return { job };
        } catch (error) {
          logger.error('Failed to fetch job', { error, id });
          return reply.status(500).send({ error: 'Failed to fetch job' });
        }
      });

      // POST /api/v1/jobs/search - Full-text search
      jobsServer.post('/jobs/search', async (request, reply) => {
        if (!this.db) {
          return reply.status(503).send({ error: 'Database not available' });
        }

        const { query: searchQuery, limit = 50, offset = 0 } = request.body as any;

        if (!searchQuery) {
          return reply.status(400).send({ error: 'Search query is required' });
        }

        try {
          const results = await this.db.jobs.search({
            query: searchQuery,
            limit,
            offset,
          });
          return {
            results: results.jobs,
            query: searchQuery,
            pagination: {
              limit,
              offset,
              count: results.jobs.length,
              total: results.total,
            },
          };
        } catch (error) {
          logger.error('Failed to search jobs', { error, searchQuery });
          return reply.status(500).send({ error: 'Failed to search jobs' });
        }
      });

      // GET /api/v1/jobs/stats - Job statistics
      jobsServer.get('/jobs/stats', async (_request, reply) => {
        if (!this.db) {
          return reply.status(503).send({ error: 'Database not available' });
        }

        try {
          const stats = await this.db.jobs.getStats();
          return { stats };
        } catch (error) {
          logger.error('Failed to fetch job stats', { error });
          return reply.status(500).send({ error: 'Failed to fetch job stats' });
        }
      });
    });

    // Database API
    server.register(async (dbServer) => {
      // GET /api/v1/database/stats - Database statistics
      dbServer.get('/database/stats', async (_request, reply) => {
        if (!this.db) {
          return reply.status(503).send({ error: 'Database not available' });
        }

        try {
          const stats = this.db.getStats();
          return { stats };
        } catch (error) {
          logger.error('Failed to fetch database stats', { error });
          return reply.status(500).send({ error: 'Failed to fetch database stats' });
        }
      });

      // POST /api/v1/database/backup - Create database backup
      dbServer.post('/database/backup', async (request, reply) => {
        if (!this.db) {
          return reply.status(503).send({ error: 'Database not available' });
        }

        const { filename } = request.body as any;
        const backupName =
          filename || `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;

        try {
          await this.db.backup(backupName);
          return {
            success: true,
            filename: backupName,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          logger.error('Failed to create backup', { error, filename: backupName });
          return reply.status(500).send({ error: 'Failed to create backup' });
        }
      });
    });
  };

  /**
   * Web interface routes
   */
  private webRoutes = async (server: FastifyInstance): Promise<void> => {
    // Home page
    server.get('/', async (_request, reply) => {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Job Dorker - Job Search Interface</title>
    <link rel="stylesheet" href="/public/styles.css">
</head>
<body>
    <div class="container">
        <h1>🔍 Job Dorker - Job Search Interface</h1>
        
        <div class="stats" id="stats">
            <div class="stat-card">
                <div class="stat-number" id="total-jobs">-</div>
                <div class="stat-label">Total Jobs</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="total-companies">-</div>
                <div class="stat-label">Companies</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="avg-salary">-</div>
                <div class="stat-label">Avg Salary</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="remote-jobs">-</div>
                <div class="stat-label">Remote Jobs</div>
            </div>
        </div>

        <div class="search-box">
            <input type="text" id="search-input" placeholder="Search jobs by title, company, or skills..." />
        </div>

        <div class="jobs-list">
            <h3>Recent Jobs</h3>
            <div id="jobs-container">Loading jobs...</div>
        </div>

        <div class="api-docs">
            <h3>API Documentation</h3>
            <div class="endpoint">
                <span class="method get">GET</span>
                <code>/api/v1/jobs</code> - List jobs with optional filtering
            </div>
            <div class="endpoint">
                <span class="method get">GET</span>
                <code>/api/v1/jobs/:id</code> - Get specific job details
            </div>
            <div class="endpoint">
                <span class="method post">POST</span>
                <code>/api/v1/jobs/search</code> - Full-text search jobs
            </div>
            <div class="endpoint">
                <span class="method get">GET</span>
                <code>/api/v1/jobs/stats</code> - Job statistics
            </div>
            <div class="endpoint">
                <span class="method get">GET</span>
                <code>/api/v1/database/stats</code> - Database statistics
            </div>
        </div>
    </div>

    <script>
        // Load job statistics
        async function loadStats() {
            try {
                const response = await fetch('/api/v1/jobs/stats');
                if (response.ok) {
                    const { stats } = await response.json();
                    document.getElementById('total-jobs').textContent = stats.totalJobs || 0;
                    document.getElementById('total-companies').textContent = stats.totalCompanies || 0;
                    document.getElementById('avg-salary').textContent = stats.avgSalary ? '$' + Math.round(stats.avgSalary).toLocaleString() : 'N/A';
                    document.getElementById('remote-jobs').textContent = stats.remoteJobs || 0;
                }
            } catch (error) {
                console.error('Failed to load stats:', error);
            }
        }

        // Load recent jobs
        async function loadJobs() {
            try {
                const response = await fetch('/api/v1/jobs?limit=10');
                if (response.ok) {
                    const { jobs } = await response.json();
                    const container = document.getElementById('jobs-container');
                    
                    if (jobs.length === 0) {
                        container.innerHTML = '<p>No jobs found. Start scraping to see jobs here!</p>';
                        return;
                    }

                    container.innerHTML = jobs.map(job => \`
                        <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 6px; background: white;">
                            <h4 style="margin: 0 0 10px 0; color: #333;">\${job.title}</h4>
                            <p style="margin: 5px 0; color: #666;"><strong>\${job.company}</strong> - \${job.location}</p>
                            \${job.salary_min || job.salary_max ? \`<p style="margin: 5px 0; color: #28a745;">$\${job.salary_min || 'N/A'} - $\${job.salary_max || 'N/A'}</p>\` : ''}
                            <p style="margin: 5px 0; font-size: 14px; color: #888;">Posted: \${new Date(job.scraped_at).toLocaleDateString()}</p>
                            <a href="\${job.url}" target="_blank" style="color: #007bff; text-decoration: none;">View Job →</a>
                        </div>
                    \`).join('');
                }
            } catch (error) {
                console.error('Failed to load jobs:', error);
                document.getElementById('jobs-container').innerHTML = '<p>Failed to load jobs. Please try again.</p>';
            }
        }

        // Search functionality
        document.getElementById('search-input').addEventListener('keypress', async function(e) {
            if (e.key === 'Enter') {
                const query = this.value.trim();
                if (!query) return;

                try {
                    const response = await fetch('/api/v1/jobs/search', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query, limit: 20 })
                    });

                    if (response.ok) {
                        const { results } = await response.json();
                        const container = document.getElementById('jobs-container');
                        
                        if (results.length === 0) {
                            container.innerHTML = '<p>No jobs found for your search.</p>';
                            return;
                        }

                        container.innerHTML = '<h4>Search Results:</h4>' + results.map(job => \`
                            <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 6px; background: white;">
                                <h4 style="margin: 0 0 10px 0; color: #333;">\${job.title}</h4>
                                <p style="margin: 5px 0; color: #666;"><strong>\${job.company}</strong> - \${job.location}</p>
                                \${job.salary_min || job.salary_max ? \`<p style="margin: 5px 0; color: #28a745;">$\${job.salary_min || 'N/A'} - $\${job.salary_max || 'N/A'}</p>\` : ''}
                                <a href="\${job.url}" target="_blank" style="color: #007bff; text-decoration: none;">View Job →</a>
                            </div>
                        \`).join('');
                    }
                } catch (error) {
                    console.error('Search failed:', error);
                }
            }
        });

        // Load initial data
        loadStats();
        loadJobs();
    </script>
</body>
</html>`;

      reply.type('text/html');
      return html;
    });
  };

  /**
   * Setup error handlers
   */
  private setupErrorHandlers(): void {
    this.server.setErrorHandler((error, request, reply) => {
      logger.error('Server error', {
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
      });

      reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
      });
    });

    this.server.setNotFoundHandler((request, reply) => {
      reply.status(404).send({
        error: 'Not Found',
        message: `Route ${request.method} ${request.url} not found`,
      });
    });
  }

  /**
   * Initialize database connection
   */
  async initializeDatabase(): Promise<void> {
    try {
      this.db = await initializeDatabase();
      logger.info('Database initialized for web server');
    } catch (error) {
      logger.error('Failed to initialize database', { error });
      throw error;
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      // Initialize database first
      await this.initializeDatabase();

      // Setup plugins before starting
      await this.setupPlugins();

      // Start server
      await this.server.listen({
        host: this.config.host,
        port: this.config.port,
      });

      logger.info('Job Dorker web server started', {
        host: this.config.host,
        port: this.config.port,
        url: `http://${this.config.host}:${this.config.port}`,
      });
    } catch (error) {
      logger.error('Failed to start server', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    try {
      await this.server.close();
      if (this.db) {
        this.db.close();
      }
      logger.info('Job Dorker web server stopped');
    } catch (error) {
      logger.error('Failed to stop server', { error });
      throw error;
    }
  }

  /**
   * Get server instance for testing
   */
  getServer(): FastifyInstance {
    return this.server;
  }
}

export default JobDorkerServer;
