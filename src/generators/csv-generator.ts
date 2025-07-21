import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import type { JobListing } from '../parsers/schemas/job.schema.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger({ module: 'csv-generator' });

/**
 * CSV generation options
 */
export interface CsvGeneratorOptions {
  outputPath: string;
  delimiter?: string;
  includeHeaders?: boolean;
  customFields?: string[];
  maxDescriptionLength?: number;
  dateFormat?: 'iso' | 'readable';
}

/**
 * CSV report generation utilities
 */
export class CsvGenerator {
  private static readonly DEFAULT_DELIMITER = ',';
  private static readonly DEFAULT_MAX_DESCRIPTION = 500;

  /**
   * Generate CSV report from job listings
   */
  static async generateReport(jobs: JobListing[], options: CsvGeneratorOptions): Promise<void> {
    try {
      // Ensure output directory exists
      await fs.mkdir(dirname(options.outputPath), { recursive: true });

      const delimiter = options.delimiter || CsvGenerator.DEFAULT_DELIMITER;
      const maxDescLength = options.maxDescriptionLength || CsvGenerator.DEFAULT_MAX_DESCRIPTION;

      // Define column structure
      const columns = CsvGenerator.getColumnDefinitions(options.customFields);

      // Generate CSV content
      let csvContent = '';

      // Add headers if requested
      if (options.includeHeaders !== false) {
        csvContent += `${columns.map((col) => col.header).join(delimiter)}\n`;
      }

      // Add data rows
      for (const job of jobs) {
        const row = columns.map((col) =>
          CsvGenerator.formatCellValue(
            col.getValue(job),
            delimiter,
            col.header === 'Description' ? maxDescLength : undefined,
          ),
        );
        csvContent += `${row.join(delimiter)}\n`;
      }

      // Write to file
      await fs.writeFile(options.outputPath, csvContent, 'utf-8');

      logger.info(
        {
          outputPath: options.outputPath,
          jobCount: jobs.length,
          fileSize: csvContent.length,
          columns: columns.length,
        },
        'CSV report generated successfully',
      );
    } catch (error) {
      logger.error({ error, outputPath: options.outputPath }, 'Failed to generate CSV report');
      throw error;
    }
  }

  /**
   * Generate multiple CSV files by grouping criteria
   */
  static async generateGroupedReports(
    jobs: JobListing[],
    outputDir: string,
    groupBy: 'company' | 'location' | 'employmentType' | 'remote',
    options: Omit<CsvGeneratorOptions, 'outputPath'> = {},
  ): Promise<void> {
    try {
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Group jobs by specified criteria
      const groups = CsvGenerator.groupJobs(jobs, groupBy);

      const promises = Array.from(groups.entries()).map(async ([groupKey, groupJobs]) => {
        const filename = `${groupBy}-${CsvGenerator.sanitizeFilename(groupKey)}.csv`;
        const filePath = `${outputDir}/${filename}`;

        await CsvGenerator.generateReport(groupJobs, {
          ...options,
          outputPath: filePath,
        });

        return { filePath, count: groupJobs.length, group: groupKey };
      });

      const results = await Promise.all(promises);

      logger.info(
        {
          outputDir,
          groupBy,
          groupCount: results.length,
          totalJobs: jobs.length,
          groups: results,
        },
        'Grouped CSV reports generated successfully',
      );
    } catch (error) {
      logger.error({ error, outputDir, groupBy }, 'Failed to generate grouped CSV reports');
      throw error;
    }
  }

  /**
   * Generate a summary CSV with aggregated statistics
   */
  static async generateSummaryReport(
    jobs: JobListing[],
    outputPath: string,
    options: { delimiter?: string } = {},
  ): Promise<void> {
    try {
      // Calculate statistics by company
      const companyStats = CsvGenerator.calculateCompanyStatistics(jobs);

      const delimiter = options.delimiter || CsvGenerator.DEFAULT_DELIMITER;
      const headers = [
        'Company',
        'Total Jobs',
        'Avg Salary Min',
        'Avg Salary Max',
        'Remote Jobs',
        'Locations',
        'Employment Types',
      ];

      let csvContent = `${headers.join(delimiter)}\n`;

      companyStats.forEach((stat) => {
        const row = [
          stat.company,
          stat.totalJobs.toString(),
          stat.avgSalaryMin ? stat.avgSalaryMin.toFixed(0) : '',
          stat.avgSalaryMax ? stat.avgSalaryMax.toFixed(0) : '',
          stat.remoteJobs.toString(),
          stat.locations.join(';'),
          stat.employmentTypes.join(';'),
        ];

        csvContent += `${row.map((cell) => CsvGenerator.formatCellValue(cell, delimiter)).join(delimiter)}\n`;
      });

      // Ensure output directory exists
      await fs.mkdir(dirname(outputPath), { recursive: true });

      await fs.writeFile(outputPath, csvContent, 'utf-8');

      logger.info(
        {
          outputPath,
          companyCount: companyStats.length,
          totalJobs: jobs.length,
        },
        'Summary CSV report generated successfully',
      );
    } catch (error) {
      logger.error({ error, outputPath }, 'Failed to generate summary CSV report');
      throw error;
    }
  }

  /**
   * Validate CSV file structure
   */
  static async validateCsvFile(
    filePath: string,
    expectedColumns?: string[],
  ): Promise<{
    valid: boolean;
    errors: string[];
    rowCount?: number;
    columnCount?: number;
  }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      if (content.trim().length === 0) {
        return { valid: false, errors: ['File is empty'] };
      }

      const lines = content.trim().split('\n');

      if (lines.length === 0) {
        return { valid: false, errors: ['File is empty'] };
      }

      const errors: string[] = [];
      const headerLine = lines[0];

      if (!headerLine) {
        return { valid: false, errors: ['Header line is missing'] };
      }

      const headers = CsvGenerator.parseCsvLine(headerLine);

      // Check expected columns
      if (expectedColumns) {
        const missing = expectedColumns.filter((col) => !headers.includes(col));
        if (missing.length > 0) {
          errors.push(`Missing expected columns: ${missing.join(', ')}`);
        }
      }

      // Check row consistency
      const expectedColumnCount = headers.length;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue; // Skip empty lines

        const row = CsvGenerator.parseCsvLine(line);
        if (row.length !== expectedColumnCount) {
          errors.push(`Row ${i + 1}: Expected ${expectedColumnCount} columns, found ${row.length}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        rowCount: lines.length - 1, // Excluding header
        columnCount: headers.length,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to read CSV: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Define column structure for CSV output
   */
  private static getColumnDefinitions(customFields?: string[]) {
    const defaultColumns = [
      {
        header: 'ID',
        getValue: (job: JobListing) => job.id,
      },
      {
        header: 'Title',
        getValue: (job: JobListing) => job.title,
      },
      {
        header: 'Company',
        getValue: (job: JobListing) => job.company,
      },
      {
        header: 'Location',
        getValue: (job: JobListing) => job.location,
      },
      {
        header: 'Description',
        getValue: (job: JobListing) => job.description.replace(/\n/g, ' '),
      },
      {
        header: 'URL',
        getValue: (job: JobListing) => job.url,
      },
      {
        header: 'Employment Type',
        getValue: (job: JobListing) => job.employmentType,
      },
      {
        header: 'Remote',
        getValue: (job: JobListing) => (job.remote ? 'Yes' : 'No'),
      },
      {
        header: 'Salary Min',
        getValue: (job: JobListing) => job.salary?.min?.toString() || '',
      },
      {
        header: 'Salary Max',
        getValue: (job: JobListing) => job.salary?.max?.toString() || '',
      },
      {
        header: 'Salary Currency',
        getValue: (job: JobListing) => job.salary?.currency || '',
      },
      {
        header: 'Salary Period',
        getValue: (job: JobListing) => job.salary?.period || '',
      },
      {
        header: 'Posted Date',
        getValue: (job: JobListing) => job.postedDate?.toISOString() || '',
      },
      {
        header: 'Source Site',
        getValue: (job: JobListing) => job.source.site,
      },
      {
        header: 'Source URL',
        getValue: (job: JobListing) => job.source.originalUrl,
      },
      {
        header: 'Scraped At',
        getValue: (job: JobListing) => job.source.scrapedAt.toISOString(),
      },
      {
        header: 'Requirements',
        getValue: (job: JobListing) => job.requirements.join('; '),
      },
      {
        header: 'Benefits',
        getValue: (job: JobListing) => job.benefits.join('; '),
      },
      {
        header: 'Tags',
        getValue: (job: JobListing) => job.tags.join('; '),
      },
      {
        header: 'Confidence',
        getValue: (job: JobListing) => job.metadata.confidence.toFixed(2),
      },
    ];

    // If custom fields specified, filter to only those
    if (customFields && customFields.length > 0) {
      return defaultColumns.filter(
        (col) =>
          customFields.includes(col.header) ||
          customFields.includes(col.header.toLowerCase().replace(' ', '_')),
      );
    }

    return defaultColumns;
  }

  /**
   * Format a cell value for CSV output
   */
  private static formatCellValue(value: string, delimiter: string, maxLength?: number): string {
    if (!value) return '';

    // Truncate if needed
    let formattedValue =
      maxLength && value.length > maxLength ? `${value.substring(0, maxLength)}...` : value;

    // Clean up whitespace and newlines
    formattedValue = formattedValue.replace(/\s+/g, ' ').trim();

    // Wrap in quotes if contains delimiter, quotes, or newlines
    if (
      formattedValue.includes(delimiter) ||
      formattedValue.includes('"') ||
      formattedValue.includes('\n')
    ) {
      formattedValue = `"${formattedValue.replace(/"/g, '""')}"`;
    }

    return formattedValue;
  }

  /**
   * Group jobs by specified criteria
   */
  private static groupJobs(
    jobs: JobListing[],
    groupBy: 'company' | 'location' | 'employmentType' | 'remote',
  ): Map<string, JobListing[]> {
    const groups = new Map<string, JobListing[]>();

    jobs.forEach((job) => {
      let key: string;
      switch (groupBy) {
        case 'company':
          key = job.company;
          break;
        case 'location':
          key = job.location;
          break;
        case 'employmentType':
          key = job.employmentType;
          break;
        case 'remote':
          key = job.remote ? 'Remote' : 'On-site';
          break;
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(job);
    });

    return groups;
  }

  /**
   * Calculate statistics by company
   */
  private static calculateCompanyStatistics(jobs: JobListing[]) {
    const companyMap = new Map<string, JobListing[]>();

    // Group by company
    jobs.forEach((job) => {
      if (!companyMap.has(job.company)) {
        companyMap.set(job.company, []);
      }
      companyMap.get(job.company)?.push(job);
    });

    // Calculate stats for each company
    return Array.from(companyMap.entries())
      .map(([company, companyJobs]) => {
        const salaries = companyJobs.filter((j) => j.salary);
        const minSalaries = salaries.map((j) => j.salary?.min).filter(Boolean) as number[];
        const maxSalaries = salaries.map((j) => j.salary?.max).filter(Boolean) as number[];

        return {
          company,
          totalJobs: companyJobs.length,
          avgSalaryMin:
            minSalaries.length > 0
              ? minSalaries.reduce((a, b) => a + b, 0) / minSalaries.length
              : null,
          avgSalaryMax:
            maxSalaries.length > 0
              ? maxSalaries.reduce((a, b) => a + b, 0) / maxSalaries.length
              : null,
          remoteJobs: companyJobs.filter((j) => j.remote).length,
          locations: [...new Set(companyJobs.map((j) => j.location))],
          employmentTypes: [...new Set(companyJobs.map((j) => j.employmentType))],
        };
      })
      .sort((a, b) => b.totalJobs - a.totalJobs); // Sort by job count
  }

  /**
   * Sanitize filename for filesystem
   */
  private static sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9\-_.]/g, '_').toLowerCase();
  }

  /**
   * Parse a CSV line considering quoted values
   */
  private static parseCsvLine(line: string, delimiter = ','): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        // End of field
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    // Add final field
    result.push(current);

    return result;
  }
}
