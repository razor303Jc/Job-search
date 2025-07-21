import { stringify } from 'csv-stringify';
import PDFDocument from 'pdfkit';
import fastStringify from 'fast-json-stringify';
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import type { JobListing, ReportOptions } from '@/types/index.js';
import { logger } from '@/utils/logger.js';

/**
 * Report generator for exporting job data in various formats
 */
export class ReportGenerator {
  private readonly jsonStringifier;

  constructor() {
    // Pre-compile JSON schema for faster serialization
    this.jsonStringifier = fastStringify({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          company: { type: 'string' },
          location: { type: 'string' },
          description: { type: 'string' },
          url: { type: 'string' },
          salary: {
            type: 'object',
            properties: {
              min: { type: 'number' },
              max: { type: 'number' },
              currency: { type: 'string' },
              period: { type: 'string' }
            }
          },
          employmentType: { type: 'string' },
          remote: { type: 'boolean' },
          postedDate: { type: 'string' },
          requirements: { type: 'array', items: { type: 'string' } },
          benefits: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          source: {
            type: 'object',
            properties: {
              site: { type: 'string' },
              originalUrl: { type: 'string' },
              scrapedAt: { type: 'string' }
            }
          }
        }
      }
    });
  }

  /**
   * Generate report in specified format
   */
  async generateReport(jobs: JobListing[], options: ReportOptions): Promise<void> {
    try {
      // Apply filters if specified
      const filteredJobs = this.applyFilters(jobs, options.filters);
      
      // Ensure output directory exists
      if (options.outputPath) {
        const dir = dirname(options.outputPath);
        await fs.mkdir(dir, { recursive: true });
      }

      switch (options.format) {
        case 'csv':
          await this.generateCSV(filteredJobs, options);
          break;
        case 'json':
          await this.generateJSON(filteredJobs, options);
          break;
        case 'pdf':
          await this.generatePDF(filteredJobs, options);
          break;
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }

      logger.info({ 
        format: options.format, 
        jobCount: filteredJobs.length,
        outputPath: options.outputPath
      }, 'Report generated successfully');
    } catch (error) {
      logger.error({ error, options }, 'Failed to generate report');
      throw error;
    }
  }

  /**
   * Generate CSV report
   */
  private async generateCSV(jobs: JobListing[], options: ReportOptions): Promise<void> {
    const csvData = jobs.map(job => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      employment_type: job.employmentType,
      remote: job.remote,
      salary_min: job.salary?.min || '',
      salary_max: job.salary?.max || '',
      salary_currency: job.salary?.currency || '',
      salary_period: job.salary?.period || '',
      url: job.url,
      source_site: job.source.site,
      scraped_at: job.source.scrapedAt.toISOString(),
      posted_date: job.postedDate?.toISOString() || '',
      requirements: job.requirements.join('; '),
      benefits: job.benefits.join('; '),
      tags: job.tags.join(', '),
      description: this.truncateText(job.description, 1000), // Limit description length
    }));

    return new Promise((resolve, reject) => {
      stringify(csvData, {
        header: true,
        delimiter: ',',
        quoted: true,
      }, (err, output) => {
        if (err) {
          reject(err);
          return;
        }

        if (options.outputPath) {
          fs.writeFile(options.outputPath, output, 'utf-8')
            .then(() => resolve())
            .catch(reject);
        } else {
          console.log(output);
          resolve();
        }
      });
    });
  }

  /**
   * Generate JSON report
   */
  private async generateJSON(jobs: JobListing[], options: ReportOptions): Promise<void> {
    const jsonData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalJobs: jobs.length,
        format: 'json',
        filters: options.filters || {},
        analytics: options.analytics ? this.generateAnalytics(jobs) : undefined,
      },
      jobs: jobs.map(job => ({
        ...job,
        postedDate: job.postedDate?.toISOString(),
        expiryDate: job.expiryDate?.toISOString(),
        source: {
          ...job.source,
          scrapedAt: job.source.scrapedAt.toISOString(),
        },
      })),
    };

    const jsonString = this.jsonStringifier(jsonData.jobs);
    const fullReport = JSON.stringify({
      ...jsonData,
      jobs: JSON.parse(jsonString),
    }, null, 2);

    if (options.outputPath) {
      await fs.writeFile(options.outputPath, fullReport, 'utf-8');
    } else {
      console.log(fullReport);
    }
  }

  /**
   * Generate PDF report
   */
  private async generatePDF(jobs: JobListing[], options: ReportOptions): Promise<void> {
    const doc = new PDFDocument({ margin: 50 });
    
    if (options.outputPath) {
      doc.pipe(require('fs').createWriteStream(options.outputPath));
    }

    // Title
    doc.fontSize(20).text('Job Search Report', { align: 'center' });
    doc.moveDown();

    // Summary
    doc.fontSize(14).text('Summary', { underline: true });
    doc.fontSize(12)
       .text(`Total Jobs: ${jobs.length}`)
       .text(`Generated: ${new Date().toLocaleDateString()}`)
       .moveDown();

    // Analytics if requested
    if (options.analytics) {
      const analytics = this.generateAnalytics(jobs);
      
      doc.fontSize(14).text('Analytics', { underline: true });
      doc.fontSize(12)
         .text(`Average Salary: ${analytics.averageSalary ? `$${analytics.averageSalary.toLocaleString()}` : 'N/A'}`)
         .text(`Remote Jobs: ${analytics.remoteJobsPercentage}%`)
         .text(`Top Company: ${analytics.topCompanies[0]?.company || 'N/A'} (${analytics.topCompanies[0]?.count || 0} jobs)`)
         .text(`Top Location: ${analytics.topLocations[0]?.location || 'N/A'} (${analytics.topLocations[0]?.count || 0} jobs)`)
         .moveDown();
    }

    // Job listings
    doc.fontSize(14).text('Job Listings', { underline: true });
    doc.moveDown();

    for (const [index, job] of jobs.entries()) {
      // Check if we need a new page
      if (doc.y > 700) {
        doc.addPage();
      }

      doc.fontSize(12)
         .text(`${index + 1}. ${job.title}`, { continued: true })
         .fontSize(10)
         .text(` at ${job.company}`, { align: 'left' });

      doc.fontSize(10)
         .text(`Location: ${job.location}`)
         .text(`Employment Type: ${job.employmentType}`)
         .text(`Remote: ${job.remote ? 'Yes' : 'No'}`);

      if (job.salary) {
        const salaryText = `$${job.salary.min?.toLocaleString() || '?'} - $${job.salary.max?.toLocaleString() || '?'} ${job.salary.period}`;
        doc.text(`Salary: ${salaryText}`);
      }

      doc.text(`Source: ${job.source.site}`)
         .text(`URL: ${job.url}`, { link: job.url })
         .moveDown(0.5);

      // Limit jobs per page to avoid memory issues
      if (index >= 100) {
        doc.text('... (truncated for brevity)');
        break;
      }
    }

    doc.end();

    // Wait for PDF to be written
    return new Promise((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);
    });
  }

  /**
   * Apply filters to job list
   */
  private applyFilters(jobs: JobListing[], filters?: ReportOptions['filters']): JobListing[] {
    if (!filters) return jobs;

    return jobs.filter(job => {
      // Salary filter
      if (filters.minSalary !== undefined && job.salary?.min && job.salary.min < filters.minSalary) {
        return false;
      }
      if (filters.maxSalary !== undefined && job.salary?.max && job.salary.max > filters.maxSalary) {
        return false;
      }

      // Location filter
      if (filters.location && !job.location.toLowerCase().includes(filters.location.toLowerCase())) {
        return false;
      }

      // Remote filter
      if (filters.remote !== undefined && job.remote !== filters.remote) {
        return false;
      }

      // Keywords filter
      if (filters.keywords && filters.keywords.length > 0) {
        const searchText = `${job.title} ${job.description} ${job.tags.join(' ')}`.toLowerCase();
        const hasKeyword = filters.keywords.some(keyword => 
          searchText.includes(keyword.toLowerCase())
        );
        if (!hasKeyword) return false;
      }

      return true;
    });
  }

  /**
   * Generate analytics data
   */
  private generateAnalytics(jobs: JobListing[]): {
    totalJobs: number;
    averageSalary: number | null;
    salaryRange: { min: number; max: number } | null;
    remoteJobsPercentage: number;
    topCompanies: Array<{ company: string; count: number }>;
    topLocations: Array<{ location: string; count: number }>;
    employmentTypeDistribution: Record<string, number>;
    topTags: Array<{ tag: string; count: number }>;
  } {
    const salaries = jobs
      .filter(job => job.salary?.min && job.salary?.max)
      .map(job => (job.salary!.min! + job.salary!.max!) / 2);

    const averageSalary = salaries.length > 0 
      ? salaries.reduce((sum, salary) => sum + salary, 0) / salaries.length 
      : null;

    const salaryRange = salaries.length > 0 
      ? { min: Math.min(...salaries), max: Math.max(...salaries) }
      : null;

    const remoteJobs = jobs.filter(job => job.remote).length;
    const remoteJobsPercentage = Math.round((remoteJobs / jobs.length) * 100);

    // Company distribution
    const companyCount = new Map<string, number>();
    jobs.forEach(job => {
      companyCount.set(job.company, (companyCount.get(job.company) || 0) + 1);
    });
    const topCompanies = Array.from(companyCount.entries())
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Location distribution
    const locationCount = new Map<string, number>();
    jobs.forEach(job => {
      locationCount.set(job.location, (locationCount.get(job.location) || 0) + 1);
    });
    const topLocations = Array.from(locationCount.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Employment type distribution
    const employmentTypeDistribution: Record<string, number> = {};
    jobs.forEach(job => {
      employmentTypeDistribution[job.employmentType] = (employmentTypeDistribution[job.employmentType] || 0) + 1;
    });

    // Tag frequency
    const tagCount = new Map<string, number>();
    jobs.forEach(job => {
      job.tags.forEach(tag => {
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      });
    });
    const topTags = Array.from(tagCount.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    return {
      totalJobs: jobs.length,
      averageSalary,
      salaryRange,
      remoteJobsPercentage,
      topCompanies,
      topLocations,
      employmentTypeDistribution,
      topTags,
    };
  }

  /**
   * Group jobs by specified field
   */
  groupJobs(jobs: JobListing[], groupBy: ReportOptions['groupBy']): Record<string, JobListing[]> {
    if (!groupBy) return { all: jobs };

    const groups: Record<string, JobListing[]> = {};

    jobs.forEach(job => {
      let key: string;
      
      switch (groupBy) {
        case 'company':
          key = job.company;
          break;
        case 'location':
          key = job.location;
          break;
        case 'salary':
          if (job.salary?.min) {
            const salaryRange = this.getSalaryRange(job.salary.min);
            key = salaryRange;
          } else {
            key = 'Unknown';
          }
          break;
        case 'employmentType':
          key = job.employmentType;
          break;
        default:
          key = 'all';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key]!.push(job);
    });

    return groups;
  }

  /**
   * Get salary range category
   */
  private getSalaryRange(salary: number): string {
    if (salary < 30000) return 'Under $30k';
    if (salary < 50000) return '$30k - $50k';
    if (salary < 80000) return '$50k - $80k';
    if (salary < 120000) return '$80k - $120k';
    if (salary < 200000) return '$120k - $200k';
    return 'Over $200k';
  }

  /**
   * Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}

// Export singleton instance
export const reportGenerator = new ReportGenerator();