import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PdfGenerator, type PdfGeneratorOptions } from '../src/generators/pdf-generator.js';
import type { JobListing } from '../src/parsers/schemas/job.schema.js';

// Mock job data
const mockJobs: JobListing[] = [
  {
    id: 'job-1',
    title: 'Software Engineer',
    company: 'Tech Corp',
    location: 'San Francisco, CA',
    description: 'Build amazing software products using modern technologies.',
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
    requirements: ['JavaScript', 'React', 'Node.js'],
    benefits: ['Health insurance', '401k', 'PTO'],
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
    postedDate: new Date('2024-01-10'),
    requirements: ['Python', 'Django', 'PostgreSQL'],
    benefits: ['Remote work', 'Stock options'],
    tags: ['backend', 'python'],
    source: {
      site: 'test-site',
      originalUrl: 'https://example.com/job/2',
      scrapedAt: new Date('2024-01-11'),
    },
    metadata: {
      confidence: 0.85,
      rawData: { source: 'test' },
    },
  },
];

const createMockJob = (overrides: Partial<JobListing> = {}): JobListing => ({
  id: overrides.id || `job-${Date.now()}`,
  title: overrides.title || 'Test Job',
  company: overrides.company || 'Test Company',
  location: overrides.location || 'Test Location',
  description: overrides.description || 'Test job description',
  url: overrides.url || 'https://example.com/job',
  salary: overrides.salary,
  employmentType: overrides.employmentType || 'full-time',
  remote: overrides.remote || false,
  postedDate: overrides.postedDate || new Date(),
  requirements: overrides.requirements || [],
  benefits: overrides.benefits || [],
  tags: overrides.tags || [],
  source: overrides.source || {
    site: 'test-site',
    originalUrl: 'https://example.com/job',
    scrapedAt: new Date(),
  },
  metadata: overrides.metadata || {
    confidence: 1,
    rawData: {},
  },
});

describe('PDF Generator', () => {
  let testOutputDir: string;
  let testPdfPath: string;

  beforeEach(async () => {
    // Create temporary test directory
    testOutputDir = join(tmpdir(), `pdf-generator-test-${Date.now()}`);
    await fs.mkdir(testOutputDir, { recursive: true });
    testPdfPath = join(testOutputDir, 'test-report.pdf');
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('generateReport', () => {
    it('should generate a PDF report with basic content', async () => {
      const options: PdfGeneratorOptions = {
        outputPath: testPdfPath,
        title: 'Test Job Report',
      };

      await PdfGenerator.generateReport(mockJobs.slice(0, 5), options);

      // Verify file was created
      const stats = await fs.stat(testPdfPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should generate PDF with custom title and metadata', async () => {
      const options: PdfGeneratorOptions = {
        outputPath: testPdfPath,
        title: 'Custom Report Title',
        metadata: {
          author: 'Test Author',
          subject: 'Test Subject',
          keywords: 'test, jobs, pdf',
          creator: 'Test Creator',
        },
      };

      await PdfGenerator.generateReport(mockJobs.slice(0, 3), options);

      const stats = await fs.stat(testPdfPath);
      expect(stats.size).toBeGreaterThan(1000);
    });

    it('should handle empty job list', async () => {
      const options: PdfGeneratorOptions = {
        outputPath: testPdfPath,
        title: 'Empty Report',
      };

      await PdfGenerator.generateReport([], options);

      const stats = await fs.stat(testPdfPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should generate PDF with limited jobs based on filters', async () => {
      const options: PdfGeneratorOptions = {
        outputPath: testPdfPath,
        filters: {
          maxJobs: 2,
          includeDescription: true,
          includeRequirements: true,
          includeBenefits: false,
        },
      };

      await PdfGenerator.generateReport(mockJobs, options);

      const stats = await fs.stat(testPdfPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should generate PDF without charts and analytics', async () => {
      const options: PdfGeneratorOptions = {
        outputPath: testPdfPath,
        layout: {
          includeCharts: false,
          includeAnalytics: false,
          includeJobDetails: true,
        },
      };

      await PdfGenerator.generateReport(mockJobs.slice(0, 3), options);

      const stats = await fs.stat(testPdfPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should generate minimal PDF with only analytics', async () => {
      const options: PdfGeneratorOptions = {
        outputPath: testPdfPath,
        layout: {
          includeCharts: true,
          includeAnalytics: true,
          includeJobDetails: false,
          theme: 'minimal',
        },
      };

      await PdfGenerator.generateReport(mockJobs, options);

      const stats = await fs.stat(testPdfPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should create output directory if it does not exist', async () => {
      const nestedDir = join(testOutputDir, 'nested', 'directory');
      const nestedPdfPath = join(nestedDir, 'report.pdf');

      const options: PdfGeneratorOptions = {
        outputPath: nestedPdfPath,
      };

      await PdfGenerator.generateReport(mockJobs.slice(0, 2), options);

      // Verify nested directory was created
      const stats = await fs.stat(nestedDir);
      expect(stats.isDirectory()).toBe(true);

      // Verify PDF was created
      const pdfStats = await fs.stat(nestedPdfPath);
      expect(pdfStats.size).toBeGreaterThan(0);
    });

    it('should handle jobs with various salary configurations', async () => {
      const jobsWithSalaries: JobListing[] = [
        createMockJob({
          title: 'High Salary Job',
          salary: { min: 100000, max: 150000, currency: 'USD', period: 'yearly' },
        }),
        createMockJob({
          title: 'Medium Salary Job',
          salary: { min: 60000, max: 80000, currency: 'USD', period: 'yearly' },
        }),
        createMockJob({
          title: 'Euro Job',
          salary: { min: 50000, max: 70000, currency: 'EUR', period: 'yearly' },
        }),
        createMockJob({
          title: 'No Salary Job',
          salary: undefined,
        }),
      ];

      const options: PdfGeneratorOptions = {
        outputPath: testPdfPath,
        layout: { includeAnalytics: true },
      };

      await PdfGenerator.generateReport(jobsWithSalaries, options);

      const stats = await fs.stat(testPdfPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should handle jobs with remote work options', async () => {
      const remoteJobs: JobListing[] = [
        createMockJob({ title: 'Remote Job 1', remote: true }),
        createMockJob({ title: 'Remote Job 2', remote: true }),
        createMockJob({ title: 'Office Job', remote: false }),
      ];

      const options: PdfGeneratorOptions = {
        outputPath: testPdfPath,
        layout: { includeAnalytics: true },
      };

      await PdfGenerator.generateReport(remoteJobs, options);

      const stats = await fs.stat(testPdfPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should handle various employment types', async () => {
      const diverseJobs: JobListing[] = [
        createMockJob({ employmentType: 'full-time' }),
        createMockJob({ employmentType: 'part-time' }),
        createMockJob({ employmentType: 'contract' }),
        createMockJob({ employmentType: 'freelance' }),
      ];

      const options: PdfGeneratorOptions = {
        outputPath: testPdfPath,
        layout: { includeAnalytics: true },
      };

      await PdfGenerator.generateReport(diverseJobs, options);

      const stats = await fs.stat(testPdfPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should throw error for invalid output path', async () => {
      const invalidPath = '/invalid/path/that/does/not/exist/and/cannot/be/created.pdf';

      const options: PdfGeneratorOptions = {
        outputPath: invalidPath,
      };

      await expect(PdfGenerator.generateReport(mockJobs.slice(0, 2), options)).rejects.toThrow();
    });
  });

  describe('validatePdfFile', () => {
    it('should validate a properly generated PDF file', async () => {
      // First generate a PDF
      const options: PdfGeneratorOptions = {
        outputPath: testPdfPath,
      };

      await PdfGenerator.generateReport(mockJobs.slice(0, 2), options);

      // Then validate it
      const validation = await PdfGenerator.validatePdfFile(testPdfPath);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.fileSize).toBeGreaterThan(0);
    });

    it('should fail validation for non-existent file', async () => {
      const nonExistentPath = join(testOutputDir, 'does-not-exist.pdf');

      const validation = await PdfGenerator.validatePdfFile(nonExistentPath);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should fail validation for empty file', async () => {
      // Create empty file
      await fs.writeFile(testPdfPath, '');

      const validation = await PdfGenerator.validatePdfFile(testPdfPath);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('PDF file is empty');
    });

    it('should fail validation for non-PDF file', async () => {
      // Create text file with PDF extension
      await fs.writeFile(testPdfPath, 'This is not a PDF file');

      const validation = await PdfGenerator.validatePdfFile(testPdfPath);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should fail validation for corrupted PDF file', async () => {
      // Create file with PDF header but corrupted content
      await fs.writeFile(testPdfPath, '%PDF-1.4corrupted content');

      const validation = await PdfGenerator.validatePdfFile(testPdfPath);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('PDF file appears to be corrupted (too small)');
    });
  });

  describe('edge cases', () => {
    it('should handle jobs with very long descriptions', async () => {
      const longDescription = 'A'.repeat(2000);

      const jobWithLongDesc = createMockJob({
        description: longDescription,
        title: 'Job with Very Long Description',
      });

      const options: PdfGeneratorOptions = {
        outputPath: testPdfPath,
        filters: { includeDescription: true },
      };

      await PdfGenerator.generateReport([jobWithLongDesc], options);

      const stats = await fs.stat(testPdfPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should handle jobs with many requirements and benefits', async () => {
      const jobWithManyDetails = createMockJob({
        requirements: Array.from({ length: 20 }, (_, i) => `Requirement ${i + 1}`),
        benefits: Array.from({ length: 15 }, (_, i) => `Benefit ${i + 1}`),
        title: 'Job with Many Details',
      });

      const options: PdfGeneratorOptions = {
        outputPath: testPdfPath,
        filters: {
          includeRequirements: true,
          includeBenefits: true,
        },
      };

      await PdfGenerator.generateReport([jobWithManyDetails], options);

      const stats = await fs.stat(testPdfPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should handle jobs with special characters in company names', async () => {
      const specialCharJobs: JobListing[] = [
        createMockJob({ company: 'Acme & Co.' }),
        createMockJob({ company: 'Tech-Solutions™' }),
        createMockJob({ company: 'Global Corp (USA)' }),
        createMockJob({ company: 'StartUp@2023' }),
      ];

      const options: PdfGeneratorOptions = {
        outputPath: testPdfPath,
        layout: { includeAnalytics: true },
      };

      await PdfGenerator.generateReport(specialCharJobs, options);

      const stats = await fs.stat(testPdfPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should handle large dataset with many pages', async () => {
      // Create 50 jobs to test multi-page generation
      const manyJobs: JobListing[] = Array.from({ length: 50 }, (_, i) =>
        createMockJob({
          title: `Job Title ${i + 1}`,
          company: `Company ${(i % 10) + 1}`,
          description: `This is job description ${i + 1} with some details about the role and responsibilities.`,
        }),
      );

      const options: PdfGeneratorOptions = {
        outputPath: testPdfPath,
        filters: {
          includeDescription: true,
          includeRequirements: true,
          includeBenefits: true,
        },
      };

      await PdfGenerator.generateReport(manyJobs, options);

      const stats = await fs.stat(testPdfPath);
      expect(stats.size).toBeGreaterThan(10000); // Should be substantial for 50 jobs
    });
  });
});
