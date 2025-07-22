/**
 * Job data model and repository
 * Handles CRUD operations for job listings
 */

import type { JobListing } from '@/scrapers/base-scraper.js';
import { logger } from '@/utils/logger.js';
import type Database from 'better-sqlite3';

export interface JobRecord {
  // Database-specific fields
  id?: number;

  // Job listing fields
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  description?: string;
  salary?: string;
  posted_date?: string;

  // Additional fields
  employment_type?: string;
  experience_level?: string;
  remote_type?: string;
  application_deadline?: string;
  company_size?: string;
  industry?: string;
  skills?: string; // JSON array
  benefits?: string; // JSON array

  // Metadata fields (flattened from JobListing.metadata)
  scraped_at: string; // ISO date string
  updated_at?: string;
  confidence_score: number;
  has_details: boolean;
  raw_data?: string; // JSON

  // Search context
  search_query?: string;
  search_params?: string; // JSON
  page_number?: number;
  position_on_page?: number;

  // Status tracking
  status?: 'active' | 'expired' | 'filled' | 'removed';
  duplicate_of?: number;
}

export interface JobSearchOptions {
  query?: string;
  company?: string;
  location?: string;
  source?: string;
  employment_type?: string;
  remote_type?: string;
  posted_after?: string;
  posted_before?: string;
  salary_min?: number;
  salary_max?: number;
  status?: string;
  limit?: number;
  offset?: number;
  sort_by?: 'scraped_at' | 'posted_date' | 'company' | 'title';
  sort_order?: 'ASC' | 'DESC';
}

export interface JobStats {
  total: number;
  by_source: Record<string, number>;
  by_status: Record<string, number>;
  by_employment_type: Record<string, number>;
  by_remote_type: Record<string, number>;
  recent_24h: number;
  recent_7d: number;
  recent_30d: number;
}

export class JobRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.prepareStatements();
  }

  private insertStmt?: Database.Statement;
  private updateStmt?: Database.Statement;
  private findByIdStmt?: Database.Statement;
  private findByUrlStmt?: Database.Statement;
  private deleteStmt?: Database.Statement;

  private prepareStatements(): void {
    this.insertStmt = this.db.prepare(`
      INSERT INTO jobs (
        title, company, location, url, source, description, salary,
        employment_type, experience_level, remote_type, posted_date,
        application_deadline, company_size, industry, skills, benefits,
        scraped_at, confidence_score, has_details, raw_data,
        search_query, search_params, page_number, position_on_page
      ) VALUES (
        @title, @company, @location, @url, @source, @description, @salary,
        @employment_type, @experience_level, @remote_type, @posted_date,
        @application_deadline, @company_size, @industry, @skills, @benefits,
        @scraped_at, @confidence_score, @has_details, @raw_data,
        @search_query, @search_params, @page_number, @position_on_page
      )
    `);

    this.updateStmt = this.db.prepare(`
      UPDATE jobs SET
        title = @title,
        company = @company,
        location = @location,
        description = @description,
        salary = @salary,
        employment_type = @employment_type,
        experience_level = @experience_level,
        remote_type = @remote_type,
        posted_date = @posted_date,
        application_deadline = @application_deadline,
        company_size = @company_size,
        industry = @industry,
        skills = @skills,
        benefits = @benefits,
        confidence_score = @confidence_score,
        has_details = @has_details,
        raw_data = @raw_data,
        status = @status
      WHERE id = @id
    `);

    this.findByIdStmt = this.db.prepare('SELECT * FROM jobs WHERE id = ?');
    this.findByUrlStmt = this.db.prepare('SELECT * FROM jobs WHERE url = ?');
    this.deleteStmt = this.db.prepare('DELETE FROM jobs WHERE id = ?');
  }

  /**
   * Convert JobListing to JobRecord for database storage
   */
  private jobListingToRecord(
    job: JobListing,
    searchContext?: {
      query?: string;
      params?: Record<string, any>;
      pageNumber?: number;
      positionOnPage?: number;
    },
  ): Omit<JobRecord, 'id'> {
    const record: Omit<JobRecord, 'id'> = {
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      source: job.source,
      scraped_at: job.metadata.scrapedAt.toISOString(),
      confidence_score: job.metadata.confidence,
      has_details: job.metadata.hasDetails,
      status: 'active',
    };

    // Handle optional fields
    if (job.description) record.description = job.description;
    if (job.salary) record.salary = job.salary;
    if (job.postedDate) record.posted_date = job.postedDate;
    if (job.raw) record.raw_data = JSON.stringify(job.raw);

    // Search context
    if (searchContext?.query) record.search_query = searchContext.query;
    if (searchContext?.params) record.search_params = JSON.stringify(searchContext.params);
    if (searchContext?.pageNumber) record.page_number = searchContext.pageNumber;
    if (searchContext?.positionOnPage) record.position_on_page = searchContext.positionOnPage;

    return record;
  }

  /**
   * Convert JobRecord to JobListing
   */
  recordToJobListing(record: JobRecord): JobListing {
    const listing: JobListing = {
      id: record.id?.toString() || record.url,
      title: record.title,
      company: record.company,
      location: record.location,
      url: record.url,
      source: record.source,
      metadata: {
        scrapedAt: new Date(record.scraped_at),
        confidence: record.confidence_score,
        hasDetails: record.has_details,
      },
    };

    // Handle optional fields
    if (record.description) listing.description = record.description;
    if (record.salary) listing.salary = record.salary;
    if (record.posted_date) listing.postedDate = record.posted_date;
    if (record.raw_data) {
      try {
        listing.raw = JSON.parse(record.raw_data);
      } catch {
        // Ignore invalid JSON
      }
    }

    return listing;
  }

  /**
   * Create a new job record
   */
  async create(
    job: JobListing,
    searchContext?: {
      query?: string;
      params?: Record<string, any>;
      pageNumber?: number;
      positionOnPage?: number;
    },
  ): Promise<JobRecord> {
    try {
      const record = this.jobListingToRecord(job, searchContext);
      const result = this.insertStmt?.run(record);

      if (!result) {
        throw new Error('Failed to insert job record');
      }

      const created = this.findByIdStmt?.get(result.lastInsertRowid) as JobRecord;

      logger.debug('Job created', {
        id: created.id,
        title: created.title,
        company: created.company,
        source: created.source,
      });

      return created;
    } catch (error) {
      logger.error('Failed to create job', { error, job: job.title });
      throw error;
    }
  }

  /**
   * Update an existing job record
   */
  async update(id: number, updates: Partial<JobRecord>): Promise<JobRecord | null> {
    try {
      const existing = this.findByIdStmt?.get(id) as JobRecord;
      if (!existing) {
        return null;
      }

      const updated = { ...existing, ...updates, id };
      this.updateStmt?.run(updated);

      const result = this.findByIdStmt?.get(id) as JobRecord;

      logger.debug('Job updated', {
        id: result.id,
        title: result.title,
        changes: Object.keys(updates),
      });

      return result;
    } catch (error) {
      logger.error('Failed to update job', { error, id, updates });
      throw error;
    }
  }

  /**
   * Find job by ID
   */
  async findById(id: number): Promise<JobRecord | null> {
    const result = this.findByIdStmt?.get(id) as JobRecord | undefined;
    return result || null;
  }

  /**
   * Find job by URL (for deduplication)
   */
  async findByUrl(url: string): Promise<JobRecord | null> {
    const result = this.findByUrlStmt?.get(url) as JobRecord | undefined;
    return result || null;
  }

  /**
   * Find many jobs with filtering (simpler than search)
   */
  async findMany(
    filters: {
      company?: string;
      location?: string;
      salaryMin?: number;
      salaryMax?: number;
      employmentType?: string;
      remoteType?: string;
      postedAfter?: Date;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<JobRecord[]> {
    const { limit = 50, offset = 0 } = filters;
    let whereClause = 'WHERE 1=1';
    const params: any = {};

    if (filters.company) {
      whereClause += ' AND LOWER(company) LIKE LOWER(@company)';
      params.company = `%${filters.company}%`;
    }

    if (filters.location) {
      whereClause += ' AND LOWER(location) LIKE LOWER(@location)';
      params.location = `%${filters.location}%`;
    }

    if (filters.salaryMin) {
      whereClause += ' AND (salary_min >= @salaryMin OR salary_max >= @salaryMin)';
      params.salaryMin = filters.salaryMin;
    }

    if (filters.salaryMax) {
      whereClause += ' AND (salary_min <= @salaryMax OR salary_max <= @salaryMax)';
      params.salaryMax = filters.salaryMax;
    }

    if (filters.employmentType) {
      whereClause += ' AND employment_type = @employmentType';
      params.employmentType = filters.employmentType;
    }

    if (filters.remoteType) {
      whereClause += ' AND remote_type = @remoteType';
      params.remoteType = filters.remoteType;
    }

    if (filters.postedAfter) {
      whereClause += ' AND posted_date >= @postedAfter';
      params.postedAfter = filters.postedAfter.toISOString();
    }

    const sql = `
      SELECT * FROM jobs 
      ${whereClause}
      ORDER BY scraped_at DESC
      LIMIT @limit OFFSET @offset
    `;

    const stmt = this.db.prepare(sql);
    return stmt.all({
      ...params,
      limit,
      offset,
    }) as JobRecord[];
  }

  /**
   * Count jobs with filtering
   */
  async count(
    filters: {
      company?: string;
      location?: string;
      salaryMin?: number;
      salaryMax?: number;
      employmentType?: string;
      remoteType?: string;
      postedAfter?: Date;
    } = {},
  ): Promise<number> {
    let whereClause = 'WHERE 1=1';
    const params: any = {};

    if (filters.company) {
      whereClause += ' AND LOWER(company) LIKE LOWER(@company)';
      params.company = `%${filters.company}%`;
    }

    if (filters.location) {
      whereClause += ' AND LOWER(location) LIKE LOWER(@location)';
      params.location = `%${filters.location}%`;
    }

    if (filters.salaryMin) {
      whereClause += ' AND (salary_min >= @salaryMin OR salary_max >= @salaryMin)';
      params.salaryMin = filters.salaryMin;
    }

    if (filters.salaryMax) {
      whereClause += ' AND (salary_min <= @salaryMax OR salary_max <= @salaryMax)';
      params.salaryMax = filters.salaryMax;
    }

    if (filters.employmentType) {
      whereClause += ' AND employment_type = @employmentType';
      params.employmentType = filters.employmentType;
    }

    if (filters.remoteType) {
      whereClause += ' AND remote_type = @remoteType';
      params.remoteType = filters.remoteType;
    }

    if (filters.postedAfter) {
      whereClause += ' AND posted_date >= @postedAfter';
      params.postedAfter = filters.postedAfter.toISOString();
    }

    const sql = `SELECT COUNT(*) as total FROM jobs ${whereClause}`;
    const stmt = this.db.prepare(sql);
    const { total } = stmt.get(params) as { total: number };
    return total;
  }

  /**
   * Search jobs with filters
   */
  async search(options: JobSearchOptions = {}): Promise<{
    jobs: JobRecord[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { limit = 50, offset = 0, sort_by = 'scraped_at', sort_order = 'DESC' } = options;

    let whereClause = 'WHERE 1=1';
    const params: any = {};

    // Build dynamic WHERE clause
    if (options.query) {
      whereClause += ' AND jobs.id IN (SELECT rowid FROM jobs_fts WHERE jobs_fts MATCH @query)';
      params.query = options.query;
    }

    if (options.company) {
      whereClause += ' AND LOWER(company) LIKE LOWER(@company)';
      params.company = `%${options.company}%`;
    }

    if (options.location) {
      whereClause += ' AND LOWER(location) LIKE LOWER(@location)';
      params.location = `%${options.location}%`;
    }

    if (options.source) {
      whereClause += ' AND source = @source';
      params.source = options.source;
    }

    if (options.employment_type) {
      whereClause += ' AND employment_type = @employment_type';
      params.employment_type = options.employment_type;
    }

    if (options.remote_type) {
      whereClause += ' AND remote_type = @remote_type';
      params.remote_type = options.remote_type;
    }

    if (options.posted_after) {
      whereClause += ' AND posted_date >= @posted_after';
      params.posted_after = options.posted_after;
    }

    if (options.posted_before) {
      whereClause += ' AND posted_date <= @posted_before';
      params.posted_before = options.posted_before;
    }

    if (options.status) {
      whereClause += ' AND status = @status';
      params.status = options.status;
    }

    // Count total results
    const countSQL = `SELECT COUNT(*) as total FROM jobs ${whereClause}`;
    const countStmt = this.db.prepare(countSQL);
    const { total } = countStmt.get(params) as { total: number };

    // Get paginated results
    const searchSQL = `
      SELECT * FROM jobs 
      ${whereClause}
      ORDER BY ${sort_by} ${sort_order}
      LIMIT @limit OFFSET @offset
    `;

    const searchStmt = this.db.prepare(searchSQL);
    const jobs = searchStmt.all({
      ...params,
      limit,
      offset,
    }) as JobRecord[];

    return {
      jobs,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    };
  }

  /**
   * Get job statistics
   */
  async getStats(): Promise<JobStats> {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as total FROM jobs');
    const { total } = totalStmt.get() as { total: number };

    const bySourceStmt = this.db.prepare(`
      SELECT source, COUNT(*) as count 
      FROM jobs 
      GROUP BY source
    `);
    const by_source = Object.fromEntries(
      (bySourceStmt.all() as Array<{ source: string; count: number }>).map((row) => [
        row.source,
        row.count,
      ]),
    );

    const byStatusStmt = this.db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM jobs 
      GROUP BY status
    `);
    const by_status = Object.fromEntries(
      (byStatusStmt.all() as Array<{ status: string; count: number }>).map((row) => [
        row.status,
        row.count,
      ]),
    );

    const byEmploymentStmt = this.db.prepare(`
      SELECT employment_type, COUNT(*) as count 
      FROM jobs 
      WHERE employment_type IS NOT NULL
      GROUP BY employment_type
    `);
    const by_employment_type = Object.fromEntries(
      (byEmploymentStmt.all() as Array<{ employment_type: string; count: number }>).map((row) => [
        row.employment_type,
        row.count,
      ]),
    );

    const byRemoteStmt = this.db.prepare(`
      SELECT remote_type, COUNT(*) as count 
      FROM jobs 
      WHERE remote_type IS NOT NULL
      GROUP BY remote_type
    `);
    const by_remote_type = Object.fromEntries(
      (byRemoteStmt.all() as Array<{ remote_type: string; count: number }>).map((row) => [
        row.remote_type,
        row.count,
      ]),
    );

    // Recent counts
    const recent24hStmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM jobs 
      WHERE scraped_at >= datetime('now', '-1 day')
    `);
    const { count: recent_24h } = recent24hStmt.get() as { count: number };

    const recent7dStmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM jobs 
      WHERE scraped_at >= datetime('now', '-7 days')
    `);
    const { count: recent_7d } = recent7dStmt.get() as { count: number };

    const recent30dStmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM jobs 
      WHERE scraped_at >= datetime('now', '-30 days')
    `);
    const { count: recent_30d } = recent30dStmt.get() as { count: number };

    return {
      total,
      by_source,
      by_status,
      by_employment_type,
      by_remote_type,
      recent_24h,
      recent_7d,
      recent_30d,
    };
  }

  /**
   * Delete a job record
   */
  async delete(id: number): Promise<boolean> {
    try {
      const result = this.deleteStmt?.run(id);

      if (!result) {
        throw new Error('Failed to delete job record');
      }

      const deleted = result.changes > 0;

      if (deleted) {
        logger.debug('Job deleted', { id });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete job', { error, id });
      throw error;
    }
  }

  /**
   * Bulk insert jobs (more efficient for large imports)
   */
  async bulkCreate(
    jobs: JobListing[],
    searchContext?: {
      query?: string;
      params?: Record<string, any>;
      pageNumber?: number;
    },
  ): Promise<JobRecord[]> {
    const transaction = this.db.transaction((jobsToInsert: JobListing[]) => {
      const results: JobRecord[] = [];

      for (let i = 0; i < jobsToInsert.length; i++) {
        const job = jobsToInsert[i];
        if (!job) continue;

        const context = {
          ...searchContext,
          positionOnPage: i + 1,
        };

        try {
          // Check for duplicates by URL
          const existing = this.findByUrlStmt?.get(job.url) as JobRecord | undefined;
          if (existing) {
            logger.debug('Skipping duplicate job', { url: job.url, title: job.title });
            results.push(existing);
            continue;
          }

          const record = this.jobListingToRecord(job, context);
          const result = this.insertStmt?.run(record);

          if (!result) {
            throw new Error('Failed to insert job record in bulk operation');
          }

          const created = this.findByIdStmt?.get(result.lastInsertRowid) as JobRecord;
          results.push(created);
        } catch (error) {
          logger.warn('Failed to insert job in bulk operation', {
            error,
            title: job.title,
            url: job.url,
          });
        }
      }

      return results;
    });

    try {
      const results = transaction(jobs);

      logger.info('Bulk job creation completed', {
        attempted: jobs.length,
        successful: results.length,
        duplicates: jobs.length - results.length,
      });

      return results;
    } catch (error) {
      logger.error('Bulk job creation failed', { error, count: jobs.length });
      throw error;
    }
  }

  /**
   * Mark jobs as duplicates
   */
  async markDuplicate(duplicateId: number, originalId: number): Promise<boolean> {
    try {
      const stmt = this.db.prepare(
        'UPDATE jobs SET duplicate_of = @originalId WHERE id = @duplicateId',
      );
      const result = stmt.run({ originalId, duplicateId });

      const marked = result.changes > 0;
      if (marked) {
        logger.debug('Job marked as duplicate', { duplicateId, originalId });
      }

      return marked;
    } catch (error) {
      logger.error('Failed to mark job as duplicate', { error, duplicateId, originalId });
      throw error;
    }
  }
}

export default JobRepository;
