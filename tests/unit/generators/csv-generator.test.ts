import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CsvGenerator } from '../../../src/generators/csv-generator.js';
import type { JobListing } from '../../../src/parsers/schemas/job.schema.js';

describe('CsvGenerator', () => {
  let tempDir: string;
  let mockJobs: JobListing[];

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = await fs.mkdtemp(join(tmpdir(), 'csv-generator-test-'));

    // Create mock job data
    mockJobs = [
      {
        id: 'job-1',
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        description: 'Build amazing software products with cutting-edge technology.',
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
    it('should generate a valid CSV report with headers', async () => {
      const outputPath = join(tempDir, 'report.csv');

      await CsvGenerator.generateReport(mockJobs, {
        outputPath,
        includeHeaders: true,
      });

      // Check file exists
      const exists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Read and validate content
      const content = await fs.readFile(outputPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(3); // Header + 2 data rows

      // Check header row
      const headers = lines[0];
      expect(headers).toContain('ID');
      expect(headers).toContain('Title');
      expect(headers).toContain('Company');
      expect(headers).toContain('Location');

      // Check first data row
      const firstRow = lines[1];
      expect(firstRow).toContain('job-1');
      expect(firstRow).toContain('Software Engineer');
      expect(firstRow).toContain('Tech Corp');
    });

    it('should generate CSV without headers when requested', async () => {
      const outputPath = join(tempDir, 'no-headers.csv');

      await CsvGenerator.generateReport(mockJobs, {
        outputPath,
        includeHeaders: false,
      });

      const content = await fs.readFile(outputPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(2); // Only data rows
      expect(lines[0]).toContain('job-1'); // First line should be data
    });

    it('should handle custom delimiter', async () => {
      const outputPath = join(tempDir, 'semicolon.csv');

      await CsvGenerator.generateReport(mockJobs, {
        outputPath,
        delimiter: ';',
      });

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain(';');

      // Check that semicolons are used as column separators, not commas
      const lines = content.trim().split('\n');
      const headerLine = lines[0];

      // Count semicolons and commas in header (which shouldn't have data commas)
      const semicolonCount = (headerLine.match(/;/g) || []).length;
      const commaCount = (headerLine.match(/,/g) || []).length;

      expect(semicolonCount).toBeGreaterThan(0); // Should have semicolons as delimiters
      expect(commaCount).toBe(0); // Header should not contain commas
    });

    it('should truncate long descriptions', async () => {
      const jobWithLongDescription = {
        ...mockJobs[0],
        description: 'A'.repeat(1000), // Very long description
      };

      const outputPath = join(tempDir, 'truncated.csv');

      await CsvGenerator.generateReport([jobWithLongDescription], {
        outputPath,
        maxDescriptionLength: 100,
      });

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('...'); // Should have truncation indicator
    });

    it('should properly escape quotes and commas in cell values', async () => {
      const jobWithSpecialChars = {
        ...mockJobs[0],
        title: 'Software Engineer, "Senior Level"',
        company: 'Tech "Innovators", Inc.',
        description: 'Description with, commas and "quotes"',
      };

      const outputPath = join(tempDir, 'escaped.csv');

      await CsvGenerator.generateReport([jobWithSpecialChars], {
        outputPath,
      });

      const content = await fs.readFile(outputPath, 'utf-8');

      // Should wrap fields with quotes and escape internal quotes
      expect(content).toContain('"Software Engineer, ""Senior Level"""');
      expect(content).toContain('"Tech ""Innovators"", Inc."');
    });

    it('should create output directory if it does not exist', async () => {
      const nestedPath = join(tempDir, 'nested', 'deep', 'report.csv');

      await CsvGenerator.generateReport(mockJobs, {
        outputPath: nestedPath,
      });

      const exists = await fs
        .access(nestedPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('generateGroupedReports', () => {
    it('should generate separate CSV files grouped by company', async () => {
      const outputDir = join(tempDir, 'grouped-by-company');

      await CsvGenerator.generateGroupedReports(mockJobs, outputDir, 'company');

      // Check files exist
      const files = await fs.readdir(outputDir);
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.includes('tech_corp'))).toBe(true);
      expect(files.some((f) => f.includes('startup_inc'))).toBe(true);

      // Check file content
      const techCorpFile = files.find((f) => f.includes('tech_corp'));
      const content = await fs.readFile(join(outputDir, techCorpFile!), 'utf-8');
      expect(content).toContain('Software Engineer');
    });

    it('should generate separate CSV files grouped by location', async () => {
      const outputDir = join(tempDir, 'grouped-by-location');

      await CsvGenerator.generateGroupedReports(mockJobs, outputDir, 'location');

      const files = await fs.readdir(outputDir);
      expect(files.some((f) => f.includes('san_francisco'))).toBe(true);
      expect(files.some((f) => f.includes('remote'))).toBe(true);
    });

    it('should generate separate CSV files grouped by employment type', async () => {
      const mixedJobs = [
        ...mockJobs,
        {
          ...mockJobs[0],
          id: 'job-3',
          employmentType: 'part-time' as const,
        },
      ];

      const outputDir = join(tempDir, 'grouped-by-employment');

      await CsvGenerator.generateGroupedReports(mixedJobs, outputDir, 'employmentType');

      const files = await fs.readdir(outputDir);
      expect(files.some((f) => f.includes('full-time'))).toBe(true);
      expect(files.some((f) => f.includes('part-time'))).toBe(true);
    });

    it('should generate separate CSV files grouped by remote status', async () => {
      const outputDir = join(tempDir, 'grouped-by-remote');

      await CsvGenerator.generateGroupedReports(mockJobs, outputDir, 'remote');

      const files = await fs.readdir(outputDir);
      expect(files.some((f) => f.includes('remote'))).toBe(true);
      expect(files.some((f) => f.includes('on-site'))).toBe(true);
    });
  });

  describe('generateSummaryReport', () => {
    it('should generate a summary CSV with company statistics', async () => {
      const outputPath = join(tempDir, 'summary.csv');

      await CsvGenerator.generateSummaryReport(mockJobs, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(3); // Header + 2 companies

      // Check header
      const headers = lines[0];
      expect(headers).toContain('Company');
      expect(headers).toContain('Total Jobs');
      expect(headers).toContain('Avg Salary Min');

      // Check data rows
      expect(content).toContain('Tech Corp');
      expect(content).toContain('Startup Inc');
    });

    it('should handle companies with multiple jobs', async () => {
      const duplicateCompanyJobs = [
        ...mockJobs,
        {
          ...mockJobs[0],
          id: 'job-3',
          title: 'Senior Engineer',
        },
      ];

      const outputPath = join(tempDir, 'multi-job-summary.csv');

      await CsvGenerator.generateSummaryReport(duplicateCompanyJobs, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');

      // Tech Corp should show 2 jobs
      expect(content).toContain('Tech Corp');
      const lines = content.split('\n');
      const techCorpLine = lines.find((line) => line.includes('Tech Corp'));
      expect(techCorpLine).toContain('2'); // Total jobs count
    });

    it('should calculate average salaries correctly', async () => {
      const outputPath = join(tempDir, 'salary-summary.csv');

      await CsvGenerator.generateSummaryReport(mockJobs, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');

      // Check that salary calculations are present
      expect(content).toContain('100000'); // Tech Corp min salary
      expect(content).toContain('80000'); // Startup Inc min salary
    });
  });

  describe('validateCsvFile', () => {
    it('should validate a correct CSV file', async () => {
      const outputPath = join(tempDir, 'valid.csv');

      await CsvGenerator.generateReport(mockJobs, { outputPath });

      const validation = await CsvGenerator.validateCsvFile(outputPath);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.rowCount).toBe(2);
      expect(validation.columnCount).toBeGreaterThan(10);
    });

    it('should detect inconsistent column counts', async () => {
      const invalidCsv = 'col1,col2,col3\nval1,val2\nval1,val2,val3,val4';
      const outputPath = join(tempDir, 'invalid.csv');

      await fs.writeFile(outputPath, invalidCsv, 'utf-8');

      const validation = await CsvGenerator.validateCsvFile(outputPath);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some((e) => e.includes('Expected 3 columns'))).toBe(true);
    });

    it('should validate expected columns when provided', async () => {
      const outputPath = join(tempDir, 'expected-cols.csv');

      await CsvGenerator.generateReport(mockJobs, { outputPath });

      const validation = await CsvGenerator.validateCsvFile(outputPath, [
        'ID',
        'Title',
        'Company',
        'Missing Column',
      ]);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('Missing expected columns'))).toBe(true);
    });

    it('should handle empty files', async () => {
      const outputPath = join(tempDir, 'empty.csv');
      await fs.writeFile(outputPath, '', 'utf-8');

      const validation = await CsvGenerator.validateCsvFile(outputPath);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('File is empty');
    });

    it('should handle non-existent files gracefully', async () => {
      const validation = await CsvGenerator.validateCsvFile('/non/existent/file.csv');

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('CSV parsing', () => {
    it('should correctly parse CSV lines with quoted values', async () => {
      const csvContent =
        'Name,Description\n"John Doe","Software Engineer, Senior Level"\n"Jane, Smith","Backend ""Expert"""\n';
      const outputPath = join(tempDir, 'quoted.csv');

      await fs.writeFile(outputPath, csvContent, 'utf-8');

      const validation = await CsvGenerator.validateCsvFile(outputPath);

      expect(validation.valid).toBe(true);
      expect(validation.rowCount).toBe(2);
      expect(validation.columnCount).toBe(2);
    });
  });

  describe('filename sanitization', () => {
    it('should sanitize filenames with special characters', async () => {
      const jobsWithSpecialNames = [
        {
          ...mockJobs[0],
          company: 'Tech/Corp & Co!',
        },
      ];

      const outputDir = join(tempDir, 'sanitized');

      await CsvGenerator.generateGroupedReports(jobsWithSpecialNames, outputDir, 'company');

      const files = await fs.readdir(outputDir);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/^company-tech_corp___co_.csv$/);
    });
  });
});
