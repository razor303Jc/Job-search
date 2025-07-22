/**
 * Web Server Tests
 * Tests for Fastify web server and API endpoints
 */

import { initializeDatabase } from '@/database/index.js';
import type { DatabaseServices } from '@/database/index.js';
import type { Job } from '@/types/index.js';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { JobDorkerServer } from '../server.js';

describe('JobDorkerServer', () => {
  let server: JobDorkerServer;
  let db: DatabaseServices;

  // Test job data
  const testJob: Omit<Job, 'id' | 'scraped_at'> = {
    title: 'Senior TypeScript Developer',
    company: 'Tech Corp',
    location: 'San Francisco, CA',
    url: 'https://example.com/job/123',
    description: 'We are looking for a Senior TypeScript Developer to join our team.',
    employment_type: 'full-time',
    salary_min: 120000,
    salary_max: 180000,
    remote_type: 'hybrid',
    skills: ['TypeScript', 'Node.js', 'React'],
    requirements: ['5+ years experience', "Bachelor's degree"],
    benefits: ['Health insurance', '401k'],
    posted_date: new Date('2024-01-15'),
  };

  beforeAll(async () => {
    // Initialize database for testing
    db = await initializeDatabase(':memory:');

    // Create server instance
    server = new JobDorkerServer({
      host: '127.0.0.1',
      port: 0, // Use random port for testing
      logLevel: 'error', // Reduce noise in tests
    });

    // Manually set database for testing
    (server as any).db = db;
  });

  afterAll(async () => {
    await server.stop();
    db.close();
  });

  beforeEach(async () => {
    // Clear jobs table before each test
    await db.connection.run('DELETE FROM jobs');
  });

  describe('Health Check', () => {
    test('should return health status', async () => {
      const response = await server.getServer().inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        status: 'ok',
        version: '1.0.0',
        database: 'connected',
      });
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('Jobs API', () => {
    beforeEach(async () => {
      // Insert test job
      await db.jobs.create(testJob);
    });

    test('should list jobs', async () => {
      const response = await server.getServer().inject({
        method: 'GET',
        url: '/api/v1/jobs',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.jobs).toHaveLength(1);
      expect(body.jobs[0]).toMatchObject({
        title: testJob.title,
        company: testJob.company,
        location: testJob.location,
      });
      expect(body.pagination).toMatchObject({
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      });
    });

    test('should filter jobs by company', async () => {
      // Add another job with different company
      await db.jobs.create({
        ...testJob,
        company: 'Other Corp',
        title: 'Frontend Developer',
      });

      const response = await server.getServer().inject({
        method: 'GET',
        url: '/api/v1/jobs?company=Tech Corp',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.jobs).toHaveLength(1);
      expect(body.jobs[0].company).toBe('Tech Corp');
    });

    test('should filter jobs by salary range', async () => {
      const response = await server.getServer().inject({
        method: 'GET',
        url: '/api/v1/jobs?salaryMin=100000&salaryMax=200000',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.jobs).toHaveLength(1);
      expect(body.jobs[0].salary_min).toBe(120000);
    });

    test('should handle pagination', async () => {
      // Add more jobs
      for (let i = 0; i < 5; i++) {
        await db.jobs.create({
          ...testJob,
          title: `Developer ${i}`,
          company: `Company ${i}`,
        });
      }

      const response = await server.getServer().inject({
        method: 'GET',
        url: '/api/v1/jobs?limit=3&offset=2',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.jobs).toHaveLength(3);
      expect(body.pagination).toMatchObject({
        total: 6, // 1 original + 5 added
        limit: 3,
        offset: 2,
        hasMore: true,
      });
    });

    test('should get specific job by ID', async () => {
      const jobs = await db.jobs.findMany({});
      const jobId = jobs[0].id;

      const response = await server.getServer().inject({
        method: 'GET',
        url: `/api/v1/jobs/${jobId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.job).toMatchObject({
        id: jobId,
        title: testJob.title,
        company: testJob.company,
      });
    });

    test('should return 404 for non-existent job', async () => {
      const response = await server.getServer().inject({
        method: 'GET',
        url: '/api/v1/jobs/99999',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Job not found');
    });

    test('should search jobs with full-text search', async () => {
      // Add more jobs for search testing
      await db.jobs.create({
        ...testJob,
        title: 'Python Developer',
        description: 'Python developer needed for backend systems',
        skills: ['Python', 'Django', 'PostgreSQL'],
      });

      const response = await server.getServer().inject({
        method: 'POST',
        url: '/api/v1/jobs/search',
        payload: {
          query: 'TypeScript',
          limit: 10,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.results).toHaveLength(1);
      expect(body.results[0].title).toContain('TypeScript');
      expect(body.query).toBe('TypeScript');
    });

    test('should return 400 for search without query', async () => {
      const response = await server.getServer().inject({
        method: 'POST',
        url: '/api/v1/jobs/search',
        payload: {
          limit: 10,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Search query is required');
    });

    test('should get job statistics', async () => {
      // Add more jobs for stats
      await db.jobs.create({
        ...testJob,
        company: 'Other Corp',
        salary_min: 100000,
        salary_max: 150000,
        remote_type: 'remote',
      });

      const response = await server.getServer().inject({
        method: 'GET',
        url: '/api/v1/jobs/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.stats).toMatchObject({
        totalJobs: 2,
        totalCompanies: 2,
        remoteJobs: 1,
      });
      expect(body.stats.avgSalary).toBeGreaterThan(0);
    });
  });

  describe('Database API', () => {
    test('should get database statistics', async () => {
      const response = await server.getServer().inject({
        method: 'GET',
        url: '/api/v1/database/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.stats).toBeDefined();
      expect(typeof body.stats.totalTables).toBe('number');
    });

    test('should create database backup', async () => {
      const response = await server.getServer().inject({
        method: 'POST',
        url: '/api/v1/database/backup',
        payload: {
          filename: 'test-backup.db',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.filename).toBe('test-backup.db');
      expect(body.timestamp).toBeDefined();
    });

    test('should create backup with auto-generated filename', async () => {
      const response = await server.getServer().inject({
        method: 'POST',
        url: '/api/v1/database/backup',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.filename).toMatch(/backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    });
  });

  describe('Web Interface', () => {
    test('should serve home page', async () => {
      const response = await server.getServer().inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.body).toContain('Job Dorker - Job Search Interface');
      expect(response.body).toContain('API Documentation');
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent routes', async () => {
      const response = await server.getServer().inject({
        method: 'GET',
        url: '/non-existent-route',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not Found');
    });

    test('should handle invalid job ID', async () => {
      const response = await server.getServer().inject({
        method: 'GET',
        url: '/api/v1/jobs/invalid-id',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
    });
  });

  describe('CORS', () => {
    test('should include CORS headers', async () => {
      const response = await server.getServer().inject({
        method: 'OPTIONS',
        url: '/api/v1/jobs',
        headers: {
          'Access-Control-Request-Method': 'GET',
          Origin: 'http://localhost:3000',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });
});
