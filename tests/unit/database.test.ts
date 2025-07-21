import fs from 'node:fs';
import path from 'node:path';
import { DatabaseConnection } from '@/database/connection.js';
import { JobRepository } from '@/database/repositories/job.repository.js';
import type { JobListing } from '@/types/index.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('DatabaseConnection', () => {
  let db: DatabaseConnection;
  const testDbPath = path.join(process.cwd(), 'test-db.sqlite');

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    db = new DatabaseConnection({
      filename: testDbPath,
      verbose: false,
    });

    await db.initialize();
  });

  afterEach(async () => {
    if (db?.isConnected()) {
      db.close();
    }

    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should initialize database and run migrations', async () => {
    expect(db.isConnected()).toBe(true);

    // Check if tables were created
    const tables = db.query<{ name: string }>(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('jobs');
    expect(tableNames).toContain('searches');
    expect(tableNames).toContain('search_results');
    expect(tableNames).toContain('metrics');
    expect(tableNames).toContain('migrations');
  });

  it('should get database statistics', () => {
    const stats = db.getStats();

    expect(stats).toHaveProperty('totalJobs');
    expect(stats).toHaveProperty('totalSearches');
    expect(stats).toHaveProperty('totalSearchResults');
    expect(stats).toHaveProperty('diskUsage');
    expect(stats.totalJobs).toBe(0);
  });

  it('should execute queries with parameters', () => {
    const result = db.execute(
      'INSERT INTO jobs (id, title, company, location, url, source_site, source_url, scraped_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'test-1',
        'Test Job',
        'Test Company',
        'Test Location',
        'https://test.com',
        'test.com',
        'https://test.com',
        new Date().toISOString(),
      ],
    );

    expect(result.changes).toBe(1);

    const jobs = db.query('SELECT * FROM jobs WHERE id = ?', ['test-1']);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toHaveProperty('title', 'Test Job');
  });

  it('should handle transactions', () => {
    const result = db.transaction(() => {
      db.execute(
        'INSERT INTO jobs (id, title, company, location, url, source_site, source_url, scraped_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          'test-1',
          'Job 1',
          'Company 1',
          'Location 1',
          'https://test1.com',
          'test.com',
          'https://test1.com',
          new Date().toISOString(),
        ],
      );
      db.execute(
        'INSERT INTO jobs (id, title, company, location, url, source_site, source_url, scraped_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          'test-2',
          'Job 2',
          'Company 2',
          'Location 2',
          'https://test2.com',
          'test.com',
          'https://test2.com',
          new Date().toISOString(),
        ],
      );
      return 'success';
    });

    expect(result).toBe('success');

    const count = db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM jobs');
    expect(count?.count).toBe(2);
  });
});

describe('JobRepository', () => {
  let db: DatabaseConnection;
  let jobRepo: JobRepository;
  const testDbPath = path.join(process.cwd(), 'test-job-repo.sqlite');

  const createTestJob = (id: string, overrides: Partial<JobListing> = {}): JobListing => ({
    id,
    title: 'Software Engineer',
    company: 'Tech Corp',
    location: 'San Francisco, CA',
    description: 'We are looking for a software engineer...',
    url: `https://example.com/job/${id}`,
    salary: {
      min: 80000,
      max: 120000,
      currency: 'USD',
      period: 'yearly',
    },
    employmentType: 'full-time',
    remote: false,
    postedDate: new Date('2024-01-15'),
    requirements: ['JavaScript', 'React', '3+ years experience'],
    benefits: ['Health insurance', 'Stock options'],
    tags: ['frontend', 'javascript', 'react'],
    source: {
      site: 'example.com',
      originalUrl: `https://example.com/job/${id}`,
      scrapedAt: new Date(),
    },
    metadata: {
      confidence: 0.9,
      rawData: { test: true },
    },
    ...overrides,
  });

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    db = new DatabaseConnection({
      filename: testDbPath,
      verbose: false,
    });

    await db.initialize();
    jobRepo = new JobRepository(db);
  });

  afterEach(async () => {
    if (db?.isConnected()) {
      db.close();
    }

    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should save and retrieve a job', async () => {
    const job = createTestJob('test-job-1');

    await jobRepo.saveJob(job);

    const retrieved = await jobRepo.findById('test-job-1');
    expect(retrieved).toBeTruthy();
    expect(retrieved?.title).toBe('Software Engineer');
    expect(retrieved?.salary?.min).toBe(80000);
    expect(retrieved?.requirements).toEqual(['JavaScript', 'React', '3+ years experience']);
  });

  it('should save multiple jobs in transaction', async () => {
    const jobs = [
      createTestJob('job-1'),
      createTestJob('job-2', { title: 'Frontend Developer' }),
      createTestJob('job-3', { title: 'Backend Developer' }),
    ];

    await jobRepo.saveJobs(jobs);

    const count = await jobRepo.countJobs();
    expect(count).toBe(3);
  });

  it('should search jobs with filters', async () => {
    const jobs = [
      createTestJob('job-1', { title: 'Frontend Developer', remote: true }),
      createTestJob('job-2', { title: 'Backend Developer', remote: false }),
      createTestJob('job-3', { title: 'Full Stack Developer', employmentType: 'contract' }),
    ];

    await jobRepo.saveJobs(jobs);

    // Search by keywords
    const frontendJobs = await jobRepo.searchJobs({ keywords: ['Frontend'] });
    expect(frontendJobs).toHaveLength(1);
    expect(frontendJobs[0].title).toBe('Frontend Developer');

    // Search by remote
    const remoteJobs = await jobRepo.searchJobs({ remote: true });
    expect(remoteJobs).toHaveLength(1);

    // Search by employment type
    const contractJobs = await jobRepo.searchJobs({ employmentTypes: ['contract'] });
    expect(contractJobs).toHaveLength(1);
  });

  it('should get job statistics', async () => {
    const jobs = [
      createTestJob('job-1', { employmentType: 'full-time' }),
      createTestJob('job-2', { employmentType: 'part-time' }),
      createTestJob('job-3', {
        employmentType: 'full-time',
        source: { site: 'indeed.com', originalUrl: 'https://indeed.com', scrapedAt: new Date() },
      }),
    ];

    await jobRepo.saveJobs(jobs);

    const stats = await jobRepo.getJobStats();
    expect(stats.total).toBe(3);
    expect(stats.byEmploymentType['full-time']).toBe(2);
    expect(stats.byEmploymentType['part-time']).toBe(1);
    expect(stats.bySource['example.com']).toBe(2);
    expect(stats.bySource['indeed.com']).toBe(1);
  });

  it('should find similar jobs', async () => {
    const baseJob = createTestJob('base-job');
    const similarJob = createTestJob('similar-job', {
      title: 'Senior Software Engineer',
      company: 'Tech Corp',
    });
    const differentJob = createTestJob('different-job', {
      title: 'Data Scientist',
      company: 'Data Corp',
    });

    await jobRepo.saveJobs([baseJob, similarJob, differentJob]);

    const similar = await jobRepo.findSimilarJobs(baseJob, 5);
    expect(similar).toHaveLength(2);

    // Should prioritize same company
    expect(similar[0].company).toBe('Tech Corp');
  });

  it('should delete old jobs', async () => {
    const oldDate = new Date('2023-01-01');
    const jobs = [createTestJob('old-job'), createTestJob('new-job')];

    await jobRepo.saveJobs(jobs);

    // Manually update one job to be old
    db.execute('UPDATE jobs SET created_at = ? WHERE id = ?', [oldDate.toISOString(), 'old-job']);

    const deleted = await jobRepo.deleteOldJobs(new Date('2023-12-01'));
    expect(deleted).toBe(1);

    const remaining = await jobRepo.countJobs();
    expect(remaining).toBe(1);
  });

  it('should check if job exists', async () => {
    const job = createTestJob('existing-job');
    await jobRepo.saveJob(job);

    expect(await jobRepo.exists('existing-job')).toBe(true);
    expect(await jobRepo.exists('non-existing-job')).toBe(false);
  });
});
