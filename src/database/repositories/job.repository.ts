import type { JobListing, JobSearchCriteria } from '@/types/index.js';
import { logger } from '@/utils/logger.js';
import type Database from 'better-sqlite3';
import type { DatabaseConnection } from '../connection.js';

/**
 * Database row representation of a job
 */
interface JobRow {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string | null;
  url: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: string;
  employment_type: string;
  remote: boolean;
  posted_date: string | null;
  expiry_date: string | null;
  requirements: string; // JSON
  benefits: string; // JSON
  tags: string; // JSON
  source_site: string;
  source_url: string;
  scraped_at: string;
  confidence: number;
  raw_data: string | null; // JSON
  created_at: string;
  updated_at: string;
}

/**
 * Search filters for job queries
 */
export interface JobSearchFilters {
  keywords?: string[];
  companies?: string[];
  locations?: string[];
  minSalary?: number;
  maxSalary?: number;
  employmentTypes?: string[];
  remote?: boolean;
  postedAfter?: Date;
  postedBefore?: Date;
  sources?: string[];
  minConfidence?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'posted_date' | 'salary_min' | 'confidence' | 'created_at';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Repository for job-related database operations
 */
export class JobRepository {
  private db: DatabaseConnection;
  private insertJobStmt: Database.Statement | null = null;
  private updateJobStmt: Database.Statement | null = null;

  constructor(db: DatabaseConnection) {
    this.db = db;
    this.prepareStatements();
  }

  /**
   * Prepare frequently used statements for better performance
   */
  private prepareStatements(): void {
    if (!this.db.isConnected()) return;

    this.insertJobStmt = this.db.prepare(`
      INSERT OR REPLACE INTO jobs (
        id, title, company, location, description, url,
        salary_min, salary_max, salary_currency, salary_period,
        employment_type, remote, posted_date, expiry_date,
        requirements, benefits, tags, source_site, source_url,
        scraped_at, confidence, raw_data, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
      )
    `);

    this.updateJobStmt = this.db.prepare(`
      UPDATE jobs SET
        title = ?, company = ?, location = ?, description = ?,
        url = ?, salary_min = ?, salary_max = ?, salary_currency = ?,
        salary_period = ?, employment_type = ?, remote = ?,
        posted_date = ?, expiry_date = ?, requirements = ?,
        benefits = ?, tags = ?, confidence = ?, raw_data = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
  }

  /**
   * Save a job listing to database
   */
  async saveJob(job: JobListing): Promise<void> {
    if (!this.insertJobStmt) {
      this.prepareStatements();
    }

    try {
      const params = [
        job.id,
        job.title,
        job.company,
        job.location,
        job.description || null,
        job.url,
        job.salary?.min || null,
        job.salary?.max || null,
        job.salary?.currency || 'USD',
        job.salary?.period || 'yearly',
        job.employmentType || 'full-time',
        job.remote || false,
        job.postedDate?.toISOString() || null,
        job.expiryDate?.toISOString() || null,
        JSON.stringify(job.requirements || []),
        JSON.stringify(job.benefits || []),
        JSON.stringify(job.tags || []),
        job.source.site,
        job.source.originalUrl,
        job.source.scrapedAt.toISOString(),
        job.metadata.confidence,
        job.metadata.rawData ? JSON.stringify(job.metadata.rawData) : null,
      ];

      this.insertJobStmt?.run(params);
      logger.debug({ jobId: job.id }, 'Job saved to database');
    } catch (error) {
      logger.error({ error, jobId: job.id }, 'Failed to save job');
      throw error;
    }
  }

  /**
   * Save multiple jobs in a transaction for better performance
   */
  async saveJobs(jobs: JobListing[]): Promise<void> {
    if (jobs.length === 0) return;

    const saveTransaction = this.db.transaction(() => {
      for (const job of jobs) {
        const params = [
          job.id,
          job.title,
          job.company,
          job.location,
          job.description || null,
          job.url,
          job.salary?.min || null,
          job.salary?.max || null,
          job.salary?.currency || 'USD',
          job.salary?.period || 'yearly',
          job.employmentType || 'full-time',
          job.remote || false,
          job.postedDate?.toISOString() || null,
          job.expiryDate?.toISOString() || null,
          JSON.stringify(job.requirements || []),
          JSON.stringify(job.benefits || []),
          JSON.stringify(job.tags || []),
          job.source.site,
          job.source.originalUrl,
          job.source.scrapedAt.toISOString(),
          job.metadata.confidence,
          job.metadata.rawData ? JSON.stringify(job.metadata.rawData) : null,
        ];

        this.insertJobStmt?.run(params);
      }
    });

    try {
      saveTransaction();
      logger.info({ count: jobs.length }, 'Jobs saved to database');
    } catch (error) {
      logger.error({ error, count: jobs.length }, 'Failed to save jobs');
      throw error;
    }
  }

  /**
   * Find job by ID
   */
  async findById(id: string): Promise<JobListing | null> {
    try {
      const row = this.db.queryOne<JobRow>('SELECT * FROM jobs WHERE id = ?', [id]);
      return row ? this.rowToJobListing(row) : null;
    } catch (error) {
      logger.error({ error, id }, 'Failed to find job by ID');
      throw error;
    }
  }

  /**
   * Check if job exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      const result = this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM jobs WHERE id = ?',
        [id],
      );
      return (result?.count || 0) > 0;
    } catch (error) {
      logger.error({ error, id }, 'Failed to check job existence');
      return false;
    }
  }

  /**
   * Search jobs with filters
   */
  async searchJobs(filters: JobSearchFilters = {}): Promise<JobListing[]> {
    try {
      const { sql, params } = this.buildSearchQuery(filters);
      const rows = this.db.query<JobRow>(sql, params);
      return rows.map((row) => this.rowToJobListing(row));
    } catch (error) {
      logger.error({ error, filters }, 'Failed to search jobs');
      throw error;
    }
  }

  /**
   * Get jobs count with filters
   */
  async countJobs(filters: JobSearchFilters = {}): Promise<number> {
    try {
      const { sql, params } = this.buildSearchQuery(filters, true);
      const result = this.db.queryOne<{ count: number }>(sql, params);
      return result?.count || 0;
    } catch (error) {
      logger.error({ error, filters }, 'Failed to count jobs');
      return 0;
    }
  }

  /**
   * Build SQL query for job search
   */
  private buildSearchQuery(
    filters: JobSearchFilters,
    count = false,
  ): { sql: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    // Keywords search (in title, company, or description)
    if (filters.keywords && filters.keywords.length > 0) {
      const keywordConditions = filters.keywords.map(
        () => '(title LIKE ? OR company LIKE ? OR description LIKE ?)',
      );
      conditions.push(`(${keywordConditions.join(' AND ')})`);

      for (const keyword of filters.keywords) {
        const likePattern = `%${keyword}%`;
        params.push(likePattern, likePattern, likePattern);
      }
    }

    // Companies filter
    if (filters.companies && filters.companies.length > 0) {
      const placeholders = filters.companies.map(() => '?').join(',');
      conditions.push(`company IN (${placeholders})`);
      params.push(...filters.companies);
    }

    // Locations filter
    if (filters.locations && filters.locations.length > 0) {
      const locationConditions = filters.locations.map(() => 'location LIKE ?');
      conditions.push(`(${locationConditions.join(' OR ')})`);
      params.push(...filters.locations.map((loc) => `%${loc}%`));
    }

    // Salary range
    if (filters.minSalary !== undefined) {
      conditions.push('salary_min >= ?');
      params.push(filters.minSalary);
    }
    if (filters.maxSalary !== undefined) {
      conditions.push('salary_max <= ?');
      params.push(filters.maxSalary);
    }

    // Employment types
    if (filters.employmentTypes && filters.employmentTypes.length > 0) {
      const placeholders = filters.employmentTypes.map(() => '?').join(',');
      conditions.push(`employment_type IN (${placeholders})`);
      params.push(...filters.employmentTypes);
    }

    // Remote filter
    if (filters.remote !== undefined) {
      conditions.push('remote = ?');
      params.push(filters.remote);
    }

    // Date range
    if (filters.postedAfter) {
      conditions.push('posted_date >= ?');
      params.push(filters.postedAfter.toISOString());
    }
    if (filters.postedBefore) {
      conditions.push('posted_date <= ?');
      params.push(filters.postedBefore.toISOString());
    }

    // Sources filter
    if (filters.sources && filters.sources.length > 0) {
      const placeholders = filters.sources.map(() => '?').join(',');
      conditions.push(`source_site IN (${placeholders})`);
      params.push(...filters.sources);
    }

    // Minimum confidence
    if (filters.minConfidence !== undefined) {
      conditions.push('confidence >= ?');
      params.push(filters.minConfidence);
    }

    // Build the query
    const selectClause = count ? 'SELECT COUNT(*) as count' : 'SELECT *';
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let sql = `${selectClause} FROM jobs ${whereClause}`;

    // Add ordering and pagination for non-count queries
    if (!count) {
      const sortBy = filters.sortBy || 'created_at';
      const sortOrder = filters.sortOrder || 'DESC';
      sql += ` ORDER BY ${sortBy} ${sortOrder}`;

      if (filters.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);

        if (filters.offset) {
          sql += ' OFFSET ?';
          params.push(filters.offset);
        }
      }
    }

    return { sql, params };
  }

  /**
   * Convert database row to JobListing object
   */
  private rowToJobListing(row: JobRow): JobListing {
    return {
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.location,
      description: row.description || '',
      url: row.url,
      salary:
        row.salary_min || row.salary_max
          ? {
              min: row.salary_min || undefined,
              max: row.salary_max || undefined,
              currency: row.salary_currency,
              period: row.salary_period as JobListing['salary']['period'],
            }
          : undefined,
      employmentType: row.employment_type as JobListing['employmentType'],
      remote: Boolean(row.remote),
      postedDate: row.posted_date ? new Date(row.posted_date) : undefined,
      expiryDate: row.expiry_date ? new Date(row.expiry_date) : undefined,
      requirements: this.parseJsonField(row.requirements, []),
      benefits: this.parseJsonField(row.benefits, []),
      tags: this.parseJsonField(row.tags, []),
      source: {
        site: row.source_site,
        originalUrl: row.source_url,
        scrapedAt: new Date(row.scraped_at),
      },
      metadata: {
        confidence: row.confidence,
        rawData: this.parseJsonField(row.raw_data, null),
      },
    };
  }

  /**
   * Safely parse JSON field with fallback
   */
  private parseJsonField<T>(value: string | null, fallback: T): T {
    if (!value) return fallback;

    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  /**
   * Delete job by ID
   */
  async deleteJob(id: string): Promise<boolean> {
    try {
      const result = this.db.execute('DELETE FROM jobs WHERE id = ?', [id]);
      const deleted = result.changes > 0;
      if (deleted) {
        logger.debug({ jobId: id }, 'Job deleted from database');
      }
      return deleted;
    } catch (error) {
      logger.error({ error, id }, 'Failed to delete job');
      throw error;
    }
  }

  /**
   * Delete jobs older than specified date
   */
  async deleteOldJobs(olderThan: Date): Promise<number> {
    try {
      const result = this.db.execute('DELETE FROM jobs WHERE created_at < ?', [
        olderThan.toISOString(),
      ]);
      const deletedCount = result.changes;
      logger.info({ deletedCount, olderThan }, 'Old jobs deleted');
      return deletedCount;
    } catch (error) {
      logger.error({ error, olderThan }, 'Failed to delete old jobs');
      throw error;
    }
  }

  /**
   * Get job statistics
   */
  async getJobStats(): Promise<{
    total: number;
    byEmploymentType: Record<string, number>;
    bySource: Record<string, number>;
    avgSalary: number | null;
    recentJobs: number;
  }> {
    try {
      const total = await this.countJobs();

      const employmentTypeStats = this.db.query<{ employment_type: string; count: number }>(`
        SELECT employment_type, COUNT(*) as count 
        FROM jobs 
        GROUP BY employment_type
      `);

      const sourceStats = this.db.query<{ source_site: string; count: number }>(`
        SELECT source_site, COUNT(*) as count 
        FROM jobs 
        GROUP BY source_site
      `);

      const avgSalaryResult = this.db.queryOne<{ avg_salary: number | null }>(`
        SELECT AVG((salary_min + salary_max) / 2) as avg_salary 
        FROM jobs 
        WHERE salary_min IS NOT NULL AND salary_max IS NOT NULL
      `);

      const recentJobsResult = this.db.queryOne<{ count: number }>(`
        SELECT COUNT(*) as count 
        FROM jobs 
        WHERE created_at >= date('now', '-7 days')
      `);

      return {
        total,
        byEmploymentType: Object.fromEntries(
          employmentTypeStats.map((row) => [row.employment_type, row.count]),
        ),
        bySource: Object.fromEntries(sourceStats.map((row) => [row.source_site, row.count])),
        avgSalary: avgSalaryResult?.avg_salary || null,
        recentJobs: recentJobsResult?.count || 0,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get job statistics');
      throw error;
    }
  }

  /**
   * Get similar jobs based on title and company
   */
  async findSimilarJobs(job: JobListing, limit = 10): Promise<JobListing[]> {
    try {
      const sql = `
        SELECT * FROM jobs 
        WHERE id != ? 
        AND (
          title LIKE ? OR 
          company = ? OR 
          (salary_min <= ? AND salary_max >= ?)
        )
        ORDER BY 
          CASE 
            WHEN company = ? THEN 3
            WHEN title LIKE ? THEN 2
            ELSE 1
          END DESC,
          created_at DESC
        LIMIT ?
      `;

      const titlePattern = `%${job.title.split(' ').join('%')}%`;
      const params = [
        job.id,
        titlePattern,
        job.company,
        job.salary?.max || 999999,
        job.salary?.min || 0,
        job.company,
        titlePattern,
        limit,
      ];

      const rows = this.db.query<JobRow>(sql, params);
      return rows.map((row) => this.rowToJobListing(row));
    } catch (error) {
      logger.error({ error, jobId: job.id }, 'Failed to find similar jobs');
      return [];
    }
  }
}
