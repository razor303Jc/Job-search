import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JsonGenerator } from '../../../src/generators/json-generator.js';
import type { JobListing } from '../../../src/parsers/schemas/job.schema.js';

describe('JsonGenerator', () => {
  let tempDir: string;
  let mockJobs: JobListing[];

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = await fs.mkdtemp(join(tmpdir(), 'json-generator-test-'));

    // Create mock job data
    mockJobs = [
      {
        id: 'job-1',
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        description: 'Build amazing software products.',
        url: 'https://example.com/job/1',
        salary: {
          min: 100000,
          max: 150000,
          currency: 'USD',
          period: 'yearly',
        },
        employmentType: 'full-time',
        remote: false,
        postedDate: new Date('2024-01-15'),
        requirements: ['JavaScript', 'React'],
        benefits: ['Health insurance', '401k'],
        tags: ['frontend', 'tech'],
        source: {
          site: 'test-site',
          originalUrl: 'https://example.com/job/1',
          scrapedAt: new Date('2024-01-16'),
        },
        metadata: {
          confidence: 0.9,
          rawData: { source: 'test' },
        },
      },
      {
        id: 'job-2',
        title: 'Backend Developer',
        company: 'Startup Inc',
        location: 'Remote',
        description: 'Work on scalable backend systems.',
        url: 'https://example.com/job/2',
        salary: {
          min: 80000,
          max: 120000,
          currency: 'USD',
          period: 'yearly',
        },
        employmentType: 'full-time',
        remote: true,
        requirements: ['Python', 'Django'],
        benefits: ['Flexible PTO'],
        tags: ['backend', 'remote'],
        source: {
          site: 'test-site',
          originalUrl: 'https://example.com/job/2',
          scrapedAt: new Date('2024-01-16'),
        },
        metadata: {
          confidence: 0.8,
        },
      },
    ];
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('generateReport', () => {
    it('should generate a valid JSON report', async () => {
      const outputPath = join(tempDir, 'report.json');

      await JsonGenerator.generateReport(mockJobs, {
        outputPath,
        pretty: true,
        metadata: { testRun: true },
      });

      // Check file exists
      const exists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Parse and validate content
      const content = await fs.readFile(outputPath, 'utf-8');
      const report = JSON.parse(content);

      expect(report.jobs).toHaveLength(2);
      expect(report.totalFound).toBe(2);
      expect(report.source).toBe('job-dorker');
      expect(report.metadata.testRun).toBe(true);
      expect(new Date(report.timestamp)).toBeInstanceOf(Date);

      // Check job structure
      expect(report.jobs[0].id).toBe('job-1');
      expect(report.jobs[0].title).toBe('Software Engineer');
      expect(report.jobs[0].salary.min).toBe(100000);
    });

    it('should generate compact JSON when pretty is false', async () => {
      const outputPath = join(tempDir, 'compact.json');

      await JsonGenerator.generateReport(mockJobs, {
        outputPath,
        pretty: false,
      });

      const content = await fs.readFile(outputPath, 'utf-8');

      // Compact JSON should not have indentation
      expect(content).not.toContain('\n  ');

      // But should still be valid JSON
      const report = JSON.parse(content);
      expect(report.jobs).toHaveLength(2);
    });

    it('should create output directory if it does not exist', async () => {
      const nestedPath = join(tempDir, 'nested', 'deep', 'report.json');

      await JsonGenerator.generateReport(mockJobs, {
        outputPath: nestedPath,
      });

      const exists = await fs
        .access(nestedPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('generateIndividualFiles', () => {
    it('should generate separate JSON files for each job', async () => {
      const outputDir = join(tempDir, 'individual');

      await JsonGenerator.generateIndividualFiles(mockJobs, outputDir, {
        pretty: true,
        filenamePrefix: 'job',
      });

      // Check files exist
      const files = await fs.readdir(outputDir);
      expect(files).toHaveLength(2);
      expect(files.some((f) => f.includes('job-1'))).toBe(true);
      expect(files.some((f) => f.includes('job-2'))).toBe(true);

      // Check first file content
      const firstFile = files.find((f) => f.includes('job-1'));
      const content = await fs.readFile(join(outputDir, firstFile!), 'utf-8');
      const job = JSON.parse(content);

      expect(job.id).toBe('job-1');
      expect(job.title).toBe('Software Engineer');
    });

    it('should use default filename prefix when not provided', async () => {
      const outputDir = join(tempDir, 'default-prefix');

      await JsonGenerator.generateIndividualFiles(mockJobs, outputDir);

      const files = await fs.readdir(outputDir);
      expect(files.every((f) => f.startsWith('job-'))).toBe(true);
    });
  });

  describe('generateSummary', () => {
    it('should generate a summary with statistics', async () => {
      const outputPath = join(tempDir, 'summary.json');

      await JsonGenerator.generateSummary(mockJobs, outputPath, {
        searchKeywords: ['developer'],
      });

      const content = await fs.readFile(outputPath, 'utf-8');
      const summary = JSON.parse(content);

      expect(summary.metadata.totalJobs).toBe(2);
      expect(summary.statistics.totalJobs).toBe(2);
      expect(summary.statistics.companiesCount).toBe(2);
      expect(summary.statistics.remoteJobs).toBe(1);
      expect(summary.statistics.topCompanies).toHaveLength(2);
      expect(summary.samples.jobs).toHaveLength(2);

      // Check salary statistics
      expect(summary.statistics.salaryStats.withSalary).toBe(2);
      expect(summary.statistics.salaryStats.avgMin).toBe(90000); // (100000 + 80000) / 2
      expect(summary.statistics.salaryStats.avgMax).toBe(135000); // (150000 + 120000) / 2
    });

    it('should handle jobs without salary data in statistics', async () => {
      const jobsWithoutSalary = mockJobs.map((job) => ({
        ...job,
        salary: undefined,
      }));

      const outputPath = join(tempDir, 'no-salary-summary.json');

      await JsonGenerator.generateSummary(jobsWithoutSalary, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      const summary = JSON.parse(content);

      expect(summary.statistics.salaryStats.withSalary).toBe(0);
      expect(summary.statistics.salaryStats.avgMin).toBe(0);
      expect(summary.statistics.salaryStats.avgMax).toBe(0);
    });
  });

  describe('validateJsonFile', () => {
    it('should validate a correct JSON file', async () => {
      const outputPath = join(tempDir, 'valid.json');

      await JsonGenerator.generateReport(mockJobs, { outputPath });

      const validation = await JsonGenerator.validateJsonFile(outputPath);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.jobCount).toBe(2);
    });

    it('should detect missing required fields', async () => {
      const invalidData = {
        jobs: [
          { title: 'Job 1' }, // Missing required fields
          { id: 'job-2', company: 'Company' }, // Missing title
        ],
      };

      const outputPath = join(tempDir, 'invalid.json');
      await fs.writeFile(outputPath, JSON.stringify(invalidData), 'utf-8');

      const validation = await JsonGenerator.validateJsonFile(outputPath);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some((e) => e.includes('missing id'))).toBe(true);
      expect(validation.errors.some((e) => e.includes('missing title'))).toBe(true);
    });

    it('should handle invalid JSON files', async () => {
      const outputPath = join(tempDir, 'invalid-json.json');
      await fs.writeFile(outputPath, '{ invalid json }', 'utf-8');

      const validation = await JsonGenerator.validateJsonFile(outputPath);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('Failed to parse JSON');
    });

    it('should handle non-existent files gracefully', async () => {
      const validation = await JsonGenerator.validateJsonFile('/non/existent/file.json');

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('statistics calculation', () => {
    it('should calculate employment type distribution', async () => {
      const mixedJobs = [
        ...mockJobs,
        {
          ...mockJobs[0],
          id: 'job-3',
          employmentType: 'part-time' as const,
        },
        {
          ...mockJobs[0],
          id: 'job-4',
          employmentType: 'contract' as const,
        },
      ];

      const outputPath = join(tempDir, 'employment-types.json');
      await JsonGenerator.generateSummary(mixedJobs, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      const summary = JSON.parse(content);

      expect(summary.statistics.employmentTypes['full-time']).toBe(2);
      expect(summary.statistics.employmentTypes['part-time']).toBe(1);
      expect(summary.statistics.employmentTypes.contract).toBe(1);
    });

    it('should handle multiple currencies in salary stats', async () => {
      const multiCurrencyJobs = [
        mockJobs[0],
        {
          ...mockJobs[1],
          salary: {
            min: 70000,
            max: 90000,
            currency: 'EUR',
            period: 'yearly' as const,
          },
        },
      ];

      const outputPath = join(tempDir, 'multi-currency.json');
      await JsonGenerator.generateSummary(multiCurrencyJobs, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      const summary = JSON.parse(content);

      expect(summary.statistics.salaryStats.currencies.USD).toBe(1);
      expect(summary.statistics.salaryStats.currencies.EUR).toBe(1);
    });
  });
});
