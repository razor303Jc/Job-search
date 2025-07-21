import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { CsvGenerator } from '@/generators/csv-generator.js';
import { JsonGenerator } from '@/generators/json-generator.js';
import { JobParser } from '@/parsers/job-parser.js';
import type { ScrapingResult } from '@/parsers/schemas/job.schema.js';
import { CheerioScraper } from '@/scrapers/cheerio-scraper.js';
import { GoogleScraper } from '@/scrapers/google-scraper.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SiteConfig } from '../../src/config/sites.js';

// Mock site configuration for testing
const mockSiteConfig: SiteConfig = {
  id: 'test-site',
  name: 'Test Job Board',
  baseUrl: 'https://test-jobs.com',
  enabled: true,
  scraping: {
    type: 'static',
    respectRobotsTxt: true,
    rateLimit: {
      requestsPerMinute: 30,
      burstLimit: 5,
    },
    retries: 3,
    timeout: 10000,
  },
  selectors: {
    jobCard: '.job-card',
    jobLink: '.job-link',
    title: '.job-title',
    company: '.company-name',
    location: '.job-location',
    salary: '.salary-range',
    description: '.job-description',
    postedDate: '.posted-date',
  },
  search: {
    searchUrl: '/jobs',
    queryParams: {
      keywords: 'q',
      location: 'l',
      page: 'start',
    },
  },
  processing: {
    descriptionMaxLength: 5000,
  },
  features: {
    hasJobAlerts: false,
    hasSalaryData: true,
    hasCompanyReviews: false,
    requiresLogin: false,
    hasApplyButton: true,
    supportsBulkExport: false,
  },
};

/**
 * Integration tests for the complete job scraping workflow
 * Tests the end-to-end process from scraping to data export
 */
describe('Job Scraping Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test outputs
    tempDir = await fs.mkdtemp('/tmp/job-scraper-integration-test-');
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('CheerioScraper Integration', () => {
    it('should scrape and parse a complete job workflow', async () => {
      // Create scraper with mock site config
      const _scraper = new CheerioScraper(mockSiteConfig);

      // Mock HTML content that resembles a job listing
      const mockHtml = `
        <html>
          <body>
            <article class="job">
              <h2 class="job-title">Software Engineer</h2>
              <div class="company">Tech Corp</div>
              <div class="location">San Francisco, CA</div>
              <div class="description">
                Build amazing software products with cutting-edge technology.
                Salary: $100,000 - $150,000 per year
                Posted: 2 days ago
                Type: Full-time
                Remote: No
              </div>
              <a href="/job/123" class="job-link">View Job</a>
            </article>
          </body>
        </html>
      `;

      // Create a temporary HTML file
      const htmlFile = join(tempDir, 'test-job.html');
      await fs.writeFile(htmlFile, mockHtml);

      // Scrape the test HTML file
      const scrapingResult: ScrapingResult = {
        sourceUrl: `file://${htmlFile}`,
        timestamp: new Date(),
        success: true,
        jobCount: 1,
        rawData: [
          {
            title: 'Software Engineer',
            company: 'Tech Corp',
            location: 'San Francisco, CA',
            description:
              'Build amazing software products with cutting-edge technology. Salary: $100,000 - $150,000 per year Posted: 2 days ago Type: Full-time On-site position',
            url: 'file:///job/123',
            scrapedAt: new Date(),
          },
        ],
        metadata: {
          userAgent: 'test-agent',
          requestDuration: 100,
        },
      };

      // Parse the scraped data
      const jobs = scrapingResult.rawData
        .map((rawJob) =>
          JobParser.parseJob(rawJob, {
            site: 'test-site',
            originalUrl: scrapingResult.sourceUrl,
          }),
        )
        .filter(Boolean);

      // Verify parsing worked
      expect(jobs).toHaveLength(1);
      const job = jobs[0];
      if (!job) throw new Error('Job is undefined');
      expect(job.title).toBe('Software Engineer');
      expect(job.company).toBe('Tech Corp');
      expect(job.location).toBe('San Francisco, CA');
      expect(job.salary).toEqual({
        min: 100000,
        max: 150000,
        currency: 'USD',
        period: 'yearly',
      });
      expect(job.employmentType).toBe('full-time');
      expect(job.remote).toBe(false);

      // Test JSON export
      const jsonOutputPath = join(tempDir, 'jobs.json');
      await JsonGenerator.generateReport(jobs, {
        outputPath: jsonOutputPath,
        pretty: true,
      });

      // Verify JSON file was created and contains expected data
      const jsonExists = await fs
        .access(jsonOutputPath)
        .then(() => true)
        .catch(() => false);
      expect(jsonExists).toBe(true);

      const jsonContent = await fs.readFile(jsonOutputPath, 'utf-8');
      const parsedJson = JSON.parse(jsonContent);
      expect(parsedJson.totalFound).toBe(1);
      expect(parsedJson.jobs).toHaveLength(1);
      expect(parsedJson.jobs[0].title).toBe('Software Engineer');

      // Test CSV export
      const csvOutputPath = join(tempDir, 'jobs.csv');
      await CsvGenerator.generateReport(jobs, {
        outputPath: csvOutputPath,
      });

      // Verify CSV file was created and contains expected data
      const csvExists = await fs
        .access(csvOutputPath)
        .then(() => true)
        .catch(() => false);
      expect(csvExists).toBe(true);

      const csvContent = await fs.readFile(csvOutputPath, 'utf-8');
      expect(csvContent).toContain('Software Engineer');
      expect(csvContent).toContain('Tech Corp');
      expect(csvContent).toContain('San Francisco, CA');
      expect(csvContent).toContain('100000'); // Salary min
      expect(csvContent).toContain('150000'); // Salary max
    });

    it('should handle multiple jobs with different data formats', async () => {
      const mockMultiJobHtml = `
        <html>
          <body>
            <div class="job-listing">
              <h3>Backend Developer</h3>
              <span class="company">Startup Inc</span>
              <span class="location">Remote</span>
              <p class="description">
                Work on scalable backend systems.
                Compensation: €40k-60k annually
                Posted 1 week ago
                Contract position
              </p>
            </div>
            <div class="job-listing">
              <h3>Frontend Engineer</h3>
              <span class="company">Design Co</span>
              <span class="location">New York, NY</span>
              <p class="description">
                Create beautiful user interfaces.
                $75/hour
                Part-time
                Remote friendly
              </p>
            </div>
          </body>
        </html>
      `;

      const htmlFile = join(tempDir, 'multi-jobs.html');
      await fs.writeFile(htmlFile, mockMultiJobHtml);

      const scrapingResult: ScrapingResult = {
        sourceUrl: `file://${htmlFile}`,
        timestamp: new Date(),
        success: true,
        jobCount: 2,
        rawData: [
          {
            title: 'Backend Developer',
            company: 'Startup Inc',
            location: 'Remote',
            description:
              'Work on scalable backend systems. Compensation: €40k-60k annually Posted 1 week ago Contract position',
            url: 'file:///job/backend',
            scrapedAt: new Date(),
          },
          {
            title: 'Frontend Engineer',
            company: 'Design Co',
            location: 'New York, NY',
            description: 'Create beautiful user interfaces. $75/hour Part-time Remote friendly',
            url: 'file:///job/frontend',
            scrapedAt: new Date(),
          },
        ],
        metadata: {
          userAgent: 'test-agent',
          requestDuration: 150,
        },
      };

      const jobs = scrapingResult.rawData
        .map((rawJob) =>
          JobParser.parseJob(rawJob, {
            site: 'test-site',
            originalUrl: scrapingResult.sourceUrl,
          }),
        )
        .filter(Boolean);

      expect(jobs).toHaveLength(2);

      // Test first job (Backend)
      const backendJob = jobs.find((job) => job.title === 'Backend Developer');
      expect(backendJob).toBeDefined();
      expect(backendJob?.salary?.currency).toBe('EUR');
      expect(backendJob?.salary?.min).toBe(40000);
      expect(backendJob?.salary?.max).toBe(60000);
      expect(backendJob?.employmentType).toBe('contract');
      expect(backendJob?.remote).toBe(true);

      // Test second job (Frontend)
      const frontendJob = jobs.find((job) => job.title === 'Frontend Engineer');
      expect(frontendJob).toBeDefined();
      expect(frontendJob?.salary?.currency).toBe('USD');
      expect(frontendJob?.salary?.period).toBe('hourly');
      expect(frontendJob?.employmentType).toBe('part-time');
      expect(frontendJob?.remote).toBe(true);

      // Test summary export
      const summaryPath = join(tempDir, 'summary.json');
      await JsonGenerator.generateSummary(jobs, summaryPath);

      const summaryContent = await fs.readFile(summaryPath, 'utf-8');
      const summary = JSON.parse(summaryContent);

      expect(summary.statistics.totalJobs).toBe(2);
      expect(summary.statistics.remoteJobs).toBe(2);
      expect(summary.statistics.employmentTypes).toEqual({
        contract: 1,
        'part-time': 1,
      });
      expect(summary.statistics.salaryStats.currencies).toEqual({
        EUR: 1,
        USD: 1,
      });
    });
  });

  describe('Data Export Integration', () => {
    let testJobs: Array<{
      id: string;
      title: string;
      company: string;
      location: string;
      description: string;
      url: string;
      employmentType: string;
      remote: boolean;
      salary: {
        min: number;
        max: number;
        currency: string;
        period: string;
      };
      source: {
        site: string;
        originalUrl: string;
        scrapedAt: Date;
      };
      requirements: string[];
      benefits: string[];
      tags: string[];
      metadata: {
        confidence: number;
        rawData: Record<string, unknown>;
      };
    }>;

    beforeEach(() => {
      testJobs = [
        {
          id: 'job-1',
          title: 'Senior Developer',
          company: 'Tech Giant',
          location: 'Seattle, WA',
          description: 'Lead development teams',
          url: 'https://example.com/job/1',
          employmentType: 'full-time',
          remote: false,
          salary: {
            min: 120000,
            max: 180000,
            currency: 'USD',
            period: 'yearly',
          },
          source: {
            site: 'test-site',
            originalUrl: 'https://example.com/job/1',
            scrapedAt: new Date('2024-01-15T00:00:00Z'),
          },
          requirements: ['JavaScript', 'React', 'Node.js'],
          benefits: ['Health insurance', '401k', 'Remote options'],
          tags: ['senior', 'leadership', 'tech'],
          metadata: {
            confidence: 0.95,
            rawData: {},
          },
        },
        {
          id: 'job-2',
          title: 'Junior Developer',
          company: 'Startup Hub',
          location: 'Austin, TX',
          description: 'Entry level position',
          url: 'https://example.com/job/2',
          employmentType: 'full-time',
          remote: true,
          salary: {
            min: 60000,
            max: 80000,
            currency: 'USD',
            period: 'yearly',
          },
          source: {
            site: 'test-site',
            originalUrl: 'https://example.com/job/2',
            scrapedAt: new Date('2024-01-16T00:00:00Z'),
          },
          requirements: ['JavaScript', 'HTML', 'CSS'],
          benefits: ['Flexible PTO', 'Learning budget'],
          tags: ['junior', 'entry-level', 'remote'],
          metadata: {
            confidence: 0.85,
            rawData: {},
          },
        },
      ];
    });

    it('should export comprehensive JSON reports with statistics', async () => {
      const outputPath = join(tempDir, 'comprehensive-report.json');

      await JsonGenerator.generateReport(testJobs, {
        outputPath,
        pretty: true,
        metadata: {
          description: 'Integration test report',
          generatedBy: 'vitest',
        },
      });

      const content = await fs.readFile(outputPath, 'utf-8');
      const report = JSON.parse(content);

      expect(report).toHaveProperty('jobs');
      expect(report).toHaveProperty('metadata');
      expect(report).toHaveProperty('totalFound');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('source');
      expect(report.jobs).toHaveLength(2);
      expect(report.totalFound).toBe(2);
      expect(report.source).toBe('job-dorker');
      expect(report.metadata.description).toBe('Integration test report');
    });

    it('should export CSV with grouped reports', async () => {
      const outputDir = join(tempDir, 'grouped-csv');

      await CsvGenerator.generateGroupedReports(testJobs, outputDir, 'company');

      const files = await fs.readdir(outputDir);
      expect(files).toHaveLength(2);
      expect(files.some((f) => f.includes('tech_giant'))).toBe(true);
      expect(files.some((f) => f.includes('startup_hub'))).toBe(true);

      // Check individual file content
      const techGiantFile = files.find((f) => f.includes('tech_giant'));
      if (!techGiantFile) throw new Error('Tech giant file not found');
      const techGiantContent = await fs.readFile(join(outputDir, techGiantFile), 'utf-8');
      expect(techGiantContent).toContain('Senior Developer');
      expect(techGiantContent).toContain('120000');
    });

    it('should handle large datasets efficiently', async () => {
      // Create a larger dataset to test performance
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...testJobs[0],
        id: `job-${i}`,
        title: `Developer ${i}`,
        company: `Company ${i % 10}`, // 10 different companies
        location: i % 2 === 0 ? 'Remote' : 'San Francisco, CA',
        salary: {
          min: 50000 + (i % 50) * 1000,
          max: 80000 + (i % 50) * 1000,
          currency: 'USD',
          period: 'yearly',
        },
        source: {
          site: 'test-site',
          originalUrl: `https://example.com/job/${i}`,
          scrapedAt: new Date(),
        },
        metadata: {
          confidence: 0.8,
          rawData: {},
        },
      }));

      const startTime = Date.now();

      // Test JSON export performance
      const jsonPath = join(tempDir, 'large-dataset.json');
      await JsonGenerator.generateReport(largeDataset, {
        outputPath: jsonPath,
        pretty: false, // Compact for performance
      });

      // Test CSV export performance
      const csvPath = join(tempDir, 'large-dataset.csv');
      await CsvGenerator.generateReport(largeDataset, {
        outputPath: csvPath,
      });

      const duration = Date.now() - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds

      // Verify files were created and have expected content
      const jsonStats = await fs.stat(jsonPath);
      const csvStats = await fs.stat(csvPath);

      expect(jsonStats.size).toBeGreaterThan(0);
      expect(csvStats.size).toBeGreaterThan(0);

      // Spot check the content
      const jsonContent = await fs.readFile(jsonPath, 'utf-8');
      const report = JSON.parse(jsonContent);
      expect(report.totalFound).toBe(1000);
      expect(report.jobs).toHaveLength(1000);
    });
  });

  describe('Error Handling Integration', () => {
    it('should gracefully handle parsing failures', async () => {
      const invalidData = [
        {
          title: '', // Invalid: empty title
          company: 'Test Co',
          location: 'Test Location',
          description: 'Test description',
          url: 'invalid-url', // Invalid URL
          scrapedAt: new Date(),
        },
        {
          title: 'Valid Job',
          company: 'Valid Co',
          location: 'Valid Location',
          description: 'Valid description',
          url: 'https://example.com/valid',
          scrapedAt: new Date(),
        },
      ];

      const jobs = invalidData
        .map((rawJob) =>
          JobParser.parseJob(rawJob, {
            site: 'test-site',
            originalUrl: 'https://example.com/search',
          }),
        )
        .filter(Boolean);

      // Should only have the valid job
      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.title).toBe('Valid Job');

      // Should still be able to export the valid data
      const outputPath = join(tempDir, 'filtered-jobs.json');
      await JsonGenerator.generateReport(jobs, {
        outputPath,
        pretty: true,
      });

      const content = await fs.readFile(outputPath, 'utf-8');
      const report = JSON.parse(content);
      expect(report.totalFound).toBe(1);
      expect(report.jobs).toHaveLength(1);
    });

    it('should handle empty datasets gracefully', async () => {
      const emptyJobs: never[] = [];

      // Test JSON export with empty data
      const jsonPath = join(tempDir, 'empty.json');
      await JsonGenerator.generateReport(emptyJobs, {
        outputPath: jsonPath,
        pretty: true,
      });

      const jsonContent = await fs.readFile(jsonPath, 'utf-8');
      const jsonReport = JSON.parse(jsonContent);
      expect(jsonReport.totalFound).toBe(0);
      expect(jsonReport.jobs).toEqual([]);

      // Test CSV export with empty data
      const csvPath = join(tempDir, 'empty.csv');
      await CsvGenerator.generateReport(emptyJobs, {
        outputPath: csvPath,
      });

      const csvContent = await fs.readFile(csvPath, 'utf-8');
      // Should have headers but no data rows
      const lines = csvContent.trim().split('\n');
      expect(lines).toHaveLength(1); // Only header line
      expect(lines[0]).toContain('ID,Title,Company'); // Header content
    });
  });
});
