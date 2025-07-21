import type { DatabaseConnection } from '@/database/connection.js';
import { JobRepository } from '@/database/repositories/job.repository.js';
import { logger } from '@/utils/logger.js';
import fastify from 'fastify';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';

/**
 * Web server configuration
 */
export interface WebServerConfig {
  port: number;
  host: string;
  cors?: boolean;
  swagger?: boolean;
  rateLimit?: {
    max: number;
    timeWindow: number;
  };
}

/**
 * Fastify web server for job search API and UI
 */
export class WebServer {
  private app: FastifyInstance;
  private config: WebServerConfig;
  private db: DatabaseConnection;
  private jobRepository: JobRepository;

  constructor(config: WebServerConfig, db: DatabaseConnection) {
    this.config = config;
    this.db = db;
    this.jobRepository = new JobRepository(db);

    const fastifyOptions: FastifyServerOptions = {
      logger: {
        level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
      },
    };

    this.app = fastify(fastifyOptions);
    this.setupPlugins();
    this.setupRoutes();
  }

  /**
   * Setup Fastify plugins
   */
  private async setupPlugins(): Promise<void> {
    // CORS support
    if (this.config.cors) {
      await this.app.register(import('@fastify/cors'), {
        origin: true,
        credentials: true,
      });
    }

    // Rate limiting
    if (this.config.rateLimit) {
      await this.app.register(import('@fastify/rate-limit'), {
        max: this.config.rateLimit.max,
        timeWindow: this.config.rateLimit.timeWindow,
      });
    }

    // Swagger documentation
    if (this.config.swagger) {
      await this.app.register(import('@fastify/swagger'), {
        swagger: {
          info: {
            title: 'Job Dorker API',
            description: 'Job search and scraping API',
            version: '1.0.0',
          },
          host: `${this.config.host}:${this.config.port}`,
          schemes: ['http'],
          consumes: ['application/json'],
          produces: ['application/json'],
        },
      });

      await this.app.register(import('@fastify/swagger-ui'), {
        routePrefix: '/docs',
        uiConfig: {
          docExpansion: 'list',
          deepLinking: false,
        },
      });
    }

    // Health check
    this.app.get('/health', async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: this.db.isConnected(),
        version: '1.0.0',
      };
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Jobs API
    this.app.register(async (app) => {
      // Get jobs with filtering
      app.get(
        '/api/jobs',
        {
          schema: {
            querystring: {
              type: 'object',
              properties: {
                keywords: { type: 'string' },
                location: { type: 'string' },
                remote: { type: 'boolean' },
                minSalary: { type: 'number' },
                maxSalary: { type: 'number' },
                employmentType: { type: 'string' },
                limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
                offset: { type: 'number', minimum: 0, default: 0 },
                sortBy: {
                  type: 'string',
                  enum: ['posted_date', 'salary_min', 'confidence', 'created_at'],
                  default: 'created_at',
                },
                sortOrder: { type: 'string', enum: ['ASC', 'DESC'], default: 'DESC' },
              },
            },
          },
        },
        async (request) => {
          const query = request.query as Record<string, unknown>;

          const filters = {
            keywords: query.keywords ? query.keywords.split(',') : undefined,
            locations: query.location ? [query.location] : undefined,
            remote: query.remote,
            minSalary: query.minSalary,
            maxSalary: query.maxSalary,
            employmentTypes: query.employmentType ? [query.employmentType] : undefined,
            limit: query.limit || 20,
            offset: query.offset || 0,
            sortBy: query.sortBy || 'created_at',
            sortOrder: query.sortOrder || 'DESC',
          };

          const [jobs, total] = await Promise.all([
            this.jobRepository.searchJobs(filters),
            this.jobRepository.countJobs(filters),
          ]);

          return {
            jobs,
            pagination: {
              total,
              limit: filters.limit,
              offset: filters.offset,
              hasMore: filters.offset + filters.limit < total,
            },
          };
        },
      );

      // Get job by ID
      app.get('/api/jobs/:id', async (request) => {
        const { id } = request.params as { id: string };
        const job = await this.jobRepository.findById(id);

        if (!job) {
          throw new Error('Job not found');
        }

        return job;
      });

      // Get job statistics
      app.get('/api/jobs/stats', async () => {
        return await this.jobRepository.getJobStats();
      });

      // Get similar jobs
      app.get('/api/jobs/:id/similar', async (request) => {
        const { id } = request.params as { id: string };
        const job = await this.jobRepository.findById(id);

        if (!job) {
          throw new Error('Job not found');
        }

        const similarJobs = await this.jobRepository.findSimilarJobs(job, 10);
        return { similarJobs };
      });
    });

    // Database API
    this.app.register(async (app) => {
      // Database statistics
      app.get('/api/db/stats', async () => {
        return this.db.getStats();
      });

      // Database optimization
      app.post('/api/db/optimize', async () => {
        this.db.optimize();
        return { message: 'Database optimization completed' };
      });
    });

    // Static files and UI
    this.app.register(async (app) => {
      // Simple web UI
      app.get('/', async () => {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Job Dorker</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat { background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #007acc; }
        .stat-label { color: #666; margin-top: 5px; }
        .links { margin: 20px 0; }
        .links a { display: inline-block; margin: 5px 10px 5px 0; padding: 10px 20px; background: #007acc; color: white; text-decoration: none; border-radius: 5px; }
        .links a:hover { background: #005fa3; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Job Dorker</h1>
        <p>Node.js Job Scraper using Google Dorks with intelligent parsing and comprehensive reporting</p>
        
        <div class="stats" id="stats">
            <div class="stat">
                <div class="stat-value" id="totalJobs">-</div>
                <div class="stat-label">Total Jobs</div>
            </div>
            <div class="stat">
                <div class="stat-value" id="recentJobs">-</div>
                <div class="stat-label">Recent Jobs (7 days)</div>
            </div>
            <div class="stat">
                <div class="stat-value" id="avgSalary">-</div>
                <div class="stat-label">Average Salary</div>
            </div>
        </div>

        <div class="links">
            <a href="/api/jobs">📄 Jobs API</a>
            <a href="/api/jobs/stats">📊 Statistics</a>
            <a href="/docs">📚 API Documentation</a>
            <a href="/health">❤️ Health Check</a>
        </div>

        <h2>Recent Jobs</h2>
        <div id="recentJobsList">Loading...</div>
    </div>

    <script>
        // Load statistics
        fetch('/api/jobs/stats')
            .then(r => r.json())
            .then(stats => {
                document.getElementById('totalJobs').textContent = stats.total.toLocaleString();
                document.getElementById('recentJobs').textContent = stats.recentJobs.toLocaleString();
                document.getElementById('avgSalary').textContent = stats.avgSalary ? 
                    '$' + Math.round(stats.avgSalary).toLocaleString() : 'N/A';
            })
            .catch(e => console.error('Failed to load stats:', e));

        // Load recent jobs
        fetch('/api/jobs?limit=10')
            .then(r => r.json())
            .then(data => {
                const html = data.jobs.map(job => \`
                    <div style="border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px;">
                        <h3 style="margin: 0 0 10px 0; color: #007acc;">
                            <a href="/api/jobs/\${job.id}" style="color: inherit; text-decoration: none;">\${job.title}</a>
                        </h3>
                        <p style="margin: 5px 0; color: #666;"><strong>\${job.company}</strong> • \${job.location}</p>
                        <p style="margin: 10px 0; font-size: 14px; line-height: 1.4;">\${job.description.substring(0, 200)}...</p>
                        <div style="font-size: 12px; color: #888;">
                            \${job.salary ? \`$\${job.salary.min}-$\${job.salary.max} \${job.salary.period}\` : ''} • 
                            \${job.employmentType} • 
                            Posted: \${new Date(job.postedDate || job.source.scrapedAt).toLocaleDateString()}
                        </div>
                    </div>
                \`).join('');
                document.getElementById('recentJobsList').innerHTML = html;
            })
            .catch(e => {
                document.getElementById('recentJobsList').innerHTML = 'Failed to load jobs';
                console.error('Failed to load jobs:', e);
            });
    </script>
</body>
</html>
        `;
      });
    });

    // Error handling
    this.app.setErrorHandler((error, request, reply) => {
      logger.error({ error, url: request.url }, 'Request error');

      reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
        statusCode: 500,
      });
    });

    // 404 handler
    this.app.setNotFoundHandler((request, reply) => {
      reply.status(404).send({
        error: 'Not Found',
        message: `Route ${request.method} ${request.url} not found`,
        statusCode: 404,
      });
    });
  }

  /**
   * Start the web server
   */
  async start(): Promise<void> {
    try {
      await this.app.listen({
        port: this.config.port,
        host: this.config.host,
      });

      logger.info(
        {
          port: this.config.port,
          host: this.config.host,
          swagger: this.config.swagger
            ? `http://${this.config.host}:${this.config.port}/docs`
            : false,
        },
        'Web server started',
      );
    } catch (error) {
      logger.error({ error }, 'Failed to start web server');
      throw error;
    }
  }

  /**
   * Stop the web server
   */
  async stop(): Promise<void> {
    try {
      await this.app.close();
      logger.info('Web server stopped');
    } catch (error) {
      logger.error({ error }, 'Error stopping web server');
      throw error;
    }
  }

  /**
   * Get Fastify instance
   */
  getInstance(): FastifyInstance {
    return this.app;
  }
}
