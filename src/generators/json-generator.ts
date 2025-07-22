import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import type { JobListing, ScrapingResult } from '../parsers/schemas/job.schema.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger({ module: 'json-generator' });

/**
 * JSON report generation utilities
 */
export class JsonGenerator {
  /**
   * Generate a JSON report from job listings
   */
  static async generateReport(
    jobs: JobListing[],
    options: {
      outputPath: string;
      metadata?: Record<string, unknown>;
      pretty?: boolean;
    },
  ): Promise<void> {
    try {
      // Ensure output directory exists
      await fs.mkdir(dirname(options.outputPath), { recursive: true });

      // Create report data
      const report: ScrapingResult = {
        jobs,
        totalFound: jobs.length,
        searchCriteria: {
          keywords: [], // Will be filled by calling code
          excludeKeywords: [],
          datePosted: 'any',
          maxResults: jobs.length,
        },
        timestamp: new Date(),
        source: 'job-dorker',
        errors: [],
        metadata: options.metadata || {},
      };

      // Serialize to JSON
      const jsonContent = options.pretty
        ? JSON.stringify(report, JsonGenerator.createJsonReplacer(), 2)
        : JSON.stringify(report, JsonGenerator.createJsonReplacer());

      // Write to file
      await fs.writeFile(options.outputPath, jsonContent, 'utf-8');

      logger.info(
        {
          outputPath: options.outputPath,
          jobCount: jobs.length,
          fileSize: jsonContent.length,
        },
        'JSON report generated successfully',
      );
    } catch (error) {
      logger.error({ error, outputPath: options.outputPath }, 'Failed to generate JSON report');
      throw error;
    }
  }

  /**
   * Generate multiple JSON files (one per job)
   */
  static async generateIndividualFiles(
    jobs: JobListing[],
    outputDir: string,
    options: {
      pretty?: boolean;
      filenamePrefix?: string;
    } = {},
  ): Promise<void> {
    try {
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      const promises = jobs.map(async (job, index) => {
        const filename = `${options.filenamePrefix || 'job'}-${index + 1}-${job.id}.json`;
        const filePath = `${outputDir}/${filename}`;

        const jsonContent = options.pretty
          ? JSON.stringify(job, JsonGenerator.createJsonReplacer(), 2)
          : JSON.stringify(job, JsonGenerator.createJsonReplacer());

        await fs.writeFile(filePath, jsonContent, 'utf-8');
        return filePath;
      });

      const filePaths = await Promise.all(promises);

      logger.info(
        {
          outputDir,
          fileCount: filePaths.length,
          jobCount: jobs.length,
        },
        'Individual JSON files generated successfully',
      );
    } catch (error) {
      logger.error({ error, outputDir }, 'Failed to generate individual JSON files');
      throw error;
    }
  }

  /**
   * Generate a summary JSON with statistics
   */
  static async generateSummary(
    jobs: JobListing[],
    outputPath: string,
    searchCriteria?: Record<string, unknown>,
  ): Promise<void> {
    try {
      // Calculate statistics
      const stats = JsonGenerator.calculateStatistics(jobs);

      const summary = {
        metadata: {
          generatedAt: new Date().toISOString(),
          totalJobs: jobs.length,
          searchCriteria,
        },
        statistics: stats,
        samples: {
          // Include first 3 jobs as samples
          jobs: jobs.slice(0, 3).map((job) => ({
            id: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            url: job.url,
            salary: job.salary,
            employmentType: job.employmentType,
            remote: job.remote,
          })),
        },
      };

      // Ensure output directory exists
      await fs.mkdir(dirname(outputPath), { recursive: true });

      // Write summary
      await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), 'utf-8');

      logger.info(
        {
          outputPath,
          totalJobs: jobs.length,
          statistics: stats,
        },
        'JSON summary generated successfully',
      );
    } catch (error) {
      logger.error({ error, outputPath }, 'Failed to generate JSON summary');
      throw error;
    }
  }

  /**
   * Validate JSON structure
   */
  static async validateJsonFile(filePath: string): Promise<{
    valid: boolean;
    errors: string[];
    jobCount?: number;
  }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      const errors: string[] = [];

      // Basic structure validation
      if (data.jobs && !Array.isArray(data.jobs)) {
        errors.push('jobs field must be an array');
      }

      if (data.jobs) {
        // Validate each job has required fields
        data.jobs.forEach(
          (
            job: {
              id?: string;
              title?: string;
              company?: string;
              url?: string;
              [key: string]: unknown;
            },
            index: number,
          ) => {
            if (!job.id) errors.push(`Job ${index}: missing id`);
            if (!job.title) errors.push(`Job ${index}: missing title`);
            if (!job.company) errors.push(`Job ${index}: missing company`);
            if (!job.url) errors.push(`Job ${index}: missing url`);
          },
        );
      }

      return {
        valid: errors.length === 0,
        errors,
        jobCount: data.jobs ? data.jobs.length : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }

  /**
   * Calculate job statistics
   */
  private static calculateStatistics(jobs: JobListing[]) {
    const stats = {
      totalJobs: jobs.length,
      companiesCount: new Set(jobs.map((j) => j.company)).size,
      locationsCount: new Set(jobs.map((j) => j.location)).size,
      remoteJobs: jobs.filter((j) => j.remote).length,
      employmentTypes: {} as Record<string, number>,
      topCompanies: [] as Array<{ company: string; count: number }>,
      topLocations: [] as Array<{ location: string; count: number }>,
      salaryStats: {
        withSalary: 0,
        avgMin: 0,
        avgMax: 0,
        currencies: {} as Record<string, number>,
      },
    };

    // Employment type distribution
    jobs.forEach((job) => {
      stats.employmentTypes[job.employmentType] =
        (stats.employmentTypes[job.employmentType] || 0) + 1;
    });

    // Company frequency
    const companyCount = new Map<string, number>();
    jobs.forEach((job) => {
      companyCount.set(job.company, (companyCount.get(job.company) || 0) + 1);
    });
    stats.topCompanies = Array.from(companyCount.entries())
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Location frequency
    const locationCount = new Map<string, number>();
    jobs.forEach((job) => {
      locationCount.set(job.location, (locationCount.get(job.location) || 0) + 1);
    });
    stats.topLocations = Array.from(locationCount.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Salary statistics
    const jobsWithSalary = jobs.filter((j) => j.salary);
    stats.salaryStats.withSalary = jobsWithSalary.length;

    if (jobsWithSalary.length > 0) {
      const minSalaries = jobsWithSalary.map((j) => j.salary?.min).filter(Boolean) as number[];
      const maxSalaries = jobsWithSalary.map((j) => j.salary?.max).filter(Boolean) as number[];

      if (minSalaries.length > 0) {
        stats.salaryStats.avgMin = minSalaries.reduce((a, b) => a + b, 0) / minSalaries.length;
      }

      if (maxSalaries.length > 0) {
        stats.salaryStats.avgMax = maxSalaries.reduce((a, b) => a + b, 0) / maxSalaries.length;
      }

      // Currency distribution
      jobsWithSalary.forEach((job) => {
        if (job.salary) {
          const currency = job.salary.currency;
          stats.salaryStats.currencies[currency] =
            (stats.salaryStats.currencies[currency] || 0) + 1;
        }
      });
    }

    return stats;
  }

  /**
   * Create JSON replacer function for consistent serialization
   */
  private static createJsonReplacer() {
    return (_key: string, value: unknown) => {
      // Convert dates to ISO strings
      if (value instanceof Date) {
        return value.toISOString();
      }

      // Sort object keys for consistent output
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const sorted: Record<string, unknown> = {};
        Object.keys(value as Record<string, unknown>)
          .sort()
          .forEach((k) => {
            sorted[k] = (value as Record<string, unknown>)[k];
          });
        return sorted;
      }

      return value;
    };
  }
}
