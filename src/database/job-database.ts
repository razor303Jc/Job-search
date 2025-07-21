import Database from 'better-sqlite3';
import type { JobListing, DbJobListing } from '@/types/index.js';
import { logger } from '@/utils/logger.js';
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Database connection and operations for job storage
 */
export class JobDatabase {
  private db: Database.Database;
  private readonly dbPath: string;

  constructor(dbPath = './data/jobs.db') {
    this.dbPath = dbPath;
    this.db = this.initializeDatabase();
  }

  /**
   * Initialize database connection and create tables
   */
  private initializeDatabase(): Database.Database {
    try {
      // Ensure directory exists
      const dir = dirname(this.dbPath);
      fs.mkdir(dir, { recursive: true }).catch(() => {
        // Directory might already exist, ignore error
      });

      const db = new Database(this.dbPath);
      
      // Enable WAL mode for better concurrent access
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('cache_size = 1000');
      db.pragma('temp_store = memory');

      this.createTables(db);
      logger.info({ dbPath: this.dbPath }, 'Database initialized');
      
      return db;
    } catch (error) {
      logger.error({ error, dbPath: this.dbPath }, 'Failed to initialize database');
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private createTables(db: Database.Database): void {
    // Jobs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        location TEXT NOT NULL,
        description TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        salary_min INTEGER,
        salary_max INTEGER,
        salary_currency TEXT DEFAULT 'USD',
        salary_period TEXT DEFAULT 'yearly',
        employment_type TEXT NOT NULL DEFAULT 'full-time',
        remote BOOLEAN NOT NULL DEFAULT 0,
        posted_date TEXT,
        expiry_date TEXT,
        requirements TEXT, -- JSON array
        benefits TEXT, -- JSON array
        tags TEXT, -- JSON array
        source_site TEXT NOT NULL,
        source_url TEXT NOT NULL,
        scraped_at TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.0,
        raw_data TEXT, -- JSON object
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes for better query performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
      CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);
      CREATE INDEX IF NOT EXISTS idx_jobs_employment_type ON jobs(employment_type);
      CREATE INDEX IF NOT EXISTS idx_jobs_remote ON jobs(remote);
      CREATE INDEX IF NOT EXISTS idx_jobs_source_site ON jobs(source_site);
      CREATE INDEX IF NOT EXISTS idx_jobs_scraped_at ON jobs(scraped_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_salary_min ON jobs(salary_min);
      CREATE INDEX IF NOT EXISTS idx_jobs_title_company ON jobs(title, company);
    `);

    // Search statistics table
    db.exec(`
      CREATE TABLE IF NOT EXISTS search_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        search_terms TEXT NOT NULL,
        total_found INTEGER NOT NULL DEFAULT 0,
        total_scraped INTEGER NOT NULL DEFAULT 0,
        success_rate REAL NOT NULL DEFAULT 0.0,
        duration INTEGER NOT NULL DEFAULT 0,
        errors_count INTEGER NOT NULL DEFAULT 0,
        sources TEXT, -- JSON array of sources
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Duplicate tracking table
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_duplicates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        duplicate_job_id TEXT NOT NULL,
        similarity_score REAL NOT NULL,
        duplicate_type TEXT NOT NULL, -- 'exact', 'similar', 'potential'
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (duplicate_job_id) REFERENCES jobs(id)
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_duplicates_job_id ON job_duplicates(job_id);
      CREATE INDEX IF NOT EXISTS idx_duplicates_similarity ON job_duplicates(similarity_score);
    `);

    logger.info('Database tables created successfully');
  }

  /**
   * Save a job listing to the database
   */
  saveJob(job: JobListing): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO jobs (
          id, title, company, location, description, url,
          salary_min, salary_max, salary_currency, salary_period,
          employment_type, remote, posted_date, expiry_date,
          requirements, benefits, tags,
          source_site, source_url, scraped_at,
          confidence, raw_data, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        job.id,
        job.title,
        job.company,
        job.location,
        job.description,
        job.url,
        job.salary?.min || null,
        job.salary?.max || null,
        job.salary?.currency || 'USD',
        job.salary?.period || 'yearly',
        job.employmentType,
        job.remote ? 1 : 0,
        job.postedDate?.toISOString() || null,
        job.expiryDate?.toISOString() || null,
        JSON.stringify(job.requirements),
        JSON.stringify(job.benefits),
        JSON.stringify(job.tags),
        job.source.site,
        job.source.originalUrl,
        job.source.scrapedAt.toISOString(),
        job.metadata.confidence,
        JSON.stringify(job.metadata.rawData || {}),
        new Date().toISOString()
      );

      return result.changes > 0;
    } catch (error) {
      logger.error({ error, jobId: job.id }, 'Failed to save job');
      return false;
    }
  }

  /**
   * Save multiple jobs in a transaction
   */
  saveJobs(jobs: JobListing[]): number {
    const saveTransaction = this.db.transaction((jobList: JobListing[]) => {
      let savedCount = 0;
      for (const job of jobList) {
        if (this.saveJob(job)) {
          savedCount++;
        }
      }
      return savedCount;
    });

    try {
      const savedCount = saveTransaction(jobs);
      logger.info({ savedCount, totalJobs: jobs.length }, 'Bulk job save completed');
      return savedCount;
    } catch (error) {
      logger.error({ error, jobCount: jobs.length }, 'Failed to save jobs');
      return 0;
    }
  }

  /**
   * Search for jobs with filters
   */
  searchJobs(filters: {
    keywords?: string[];
    location?: string;
    company?: string;
    remote?: boolean;
    employmentType?: string[];
    salaryMin?: number;
    salaryMax?: number;
    limit?: number;
    offset?: number;
  } = {}): JobListing[] {
    try {
      let query = 'SELECT * FROM jobs WHERE 1=1';
      const params: any[] = [];

      // Add filters
      if (filters.keywords && filters.keywords.length > 0) {
        const keywordConditions = filters.keywords.map(() => 
          '(title LIKE ? OR description LIKE ? OR tags LIKE ?)'
        ).join(' AND ');
        query += ` AND (${keywordConditions})`;
        
        for (const keyword of filters.keywords) {
          const likePattern = `%${keyword}%`;
          params.push(likePattern, likePattern, likePattern);
        }
      }

      if (filters.location) {
        query += ' AND location LIKE ?';
        params.push(`%${filters.location}%`);
      }

      if (filters.company) {
        query += ' AND company LIKE ?';
        params.push(`%${filters.company}%`);
      }

      if (filters.remote !== undefined) {
        query += ' AND remote = ?';
        params.push(filters.remote ? 1 : 0);
      }

      if (filters.employmentType && filters.employmentType.length > 0) {
        const placeholders = filters.employmentType.map(() => '?').join(',');
        query += ` AND employment_type IN (${placeholders})`;
        params.push(...filters.employmentType);
      }

      if (filters.salaryMin !== undefined) {
        query += ' AND salary_min >= ?';
        params.push(filters.salaryMin);
      }

      if (filters.salaryMax !== undefined) {
        query += ' AND salary_max <= ?';
        params.push(filters.salaryMax);
      }

      // Add ordering and pagination
      query += ' ORDER BY scraped_at DESC';
      
      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
        
        if (filters.offset) {
          query += ' OFFSET ?';
          params.push(filters.offset);
        }
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as DbJobListing[];

      return rows.map(row => this.dbRowToJobListing(row));
    } catch (error) {
      logger.error({ error, filters }, 'Failed to search jobs');
      return [];
    }
  }

  /**
   * Get job by ID
   */
  getJobById(id: string): JobListing | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM jobs WHERE id = ?');
      const row = stmt.get(id) as DbJobListing | undefined;
      
      return row ? this.dbRowToJobListing(row) : null;
    } catch (error) {
      logger.error({ error, id }, 'Failed to get job by ID');
      return null;
    }
  }

  /**
   * Check if job exists by URL
   */
  jobExists(url: string): boolean {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM jobs WHERE url = ?');
      return stmt.get(url) !== undefined;
    } catch (error) {
      logger.error({ error, url }, 'Failed to check job existence');
      return false;
    }
  }

  /**
   * Get job statistics
   */
  getStats(): {
    totalJobs: number;
    uniqueCompanies: number;
    remoteJobs: number;
    avgSalary: number | null;
    topCompanies: Array<{ company: string; count: number }>;
    topLocations: Array<{ location: string; count: number }>;
  } {
    try {
      const totalJobs = this.db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number };
      
      const uniqueCompanies = this.db.prepare('SELECT COUNT(DISTINCT company) as count FROM jobs').get() as { count: number };
      
      const remoteJobs = this.db.prepare('SELECT COUNT(*) as count FROM jobs WHERE remote = 1').get() as { count: number };
      
      const avgSalary = this.db.prepare(`
        SELECT AVG((salary_min + salary_max) / 2) as avg 
        FROM jobs 
        WHERE salary_min IS NOT NULL AND salary_max IS NOT NULL
      `).get() as { avg: number | null };

      const topCompanies = this.db.prepare(`
        SELECT company, COUNT(*) as count 
        FROM jobs 
        GROUP BY company 
        ORDER BY count DESC 
        LIMIT 10
      `).all() as Array<{ company: string; count: number }>;

      const topLocations = this.db.prepare(`
        SELECT location, COUNT(*) as count 
        FROM jobs 
        GROUP BY location 
        ORDER BY count DESC 
        LIMIT 10
      `).all() as Array<{ location: string; count: number }>;

      return {
        totalJobs: totalJobs.count,
        uniqueCompanies: uniqueCompanies.count,
        remoteJobs: remoteJobs.count,
        avgSalary: avgSalary.avg,
        topCompanies,
        topLocations,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get database stats');
      return {
        totalJobs: 0,
        uniqueCompanies: 0,
        remoteJobs: 0,
        avgSalary: null,
        topCompanies: [],
        topLocations: [],
      };
    }
  }

  /**
   * Save search statistics
   */
  saveSearchStats(stats: {
    searchTerms: string[];
    totalFound: number;
    totalScraped: number;
    successRate: number;
    duration: number;
    errorsCount: number;
    sources: string[];
  }): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO search_stats (
          search_terms, total_found, total_scraped, success_rate,
          duration, errors_count, sources
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        JSON.stringify(stats.searchTerms),
        stats.totalFound,
        stats.totalScraped,
        stats.successRate,
        stats.duration,
        stats.errorsCount,
        JSON.stringify(stats.sources)
      );
    } catch (error) {
      logger.error({ error }, 'Failed to save search stats');
    }
  }

  /**
   * Convert database row to JobListing object
   */
  private dbRowToJobListing(row: DbJobListing): JobListing {
    const salary = row.salary_min !== undefined && row.salary_max !== undefined ? {
      min: row.salary_min,
      max: row.salary_max,
      currency: row.salary_currency || 'USD',
      period: (row.salary_period as 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly') || 'yearly',
    } : undefined;

    const jobListing: JobListing = {
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.location,
      description: row.description,
      url: row.url,
      employmentType: row.employmentType,
      remote: Boolean(row.remote),
      requirements: JSON.parse(row.requirements as string || '[]'),
      benefits: JSON.parse(row.benefits as string || '[]'),
      tags: JSON.parse(row.tags as string || '[]'),
      source: {
        site: row.sourceData ? JSON.parse(row.sourceData).site : 'Unknown',
        originalUrl: row.sourceData ? JSON.parse(row.sourceData).originalUrl : row.url,
        scrapedAt: new Date(row.createdAt),
      },
      metadata: {
        confidence: row.confidence || 0,
        rawData: row.raw_data ? JSON.parse(row.raw_data) : undefined,
      },
    };

    // Add optional properties only if they exist
    if (row.postedDate) {
      jobListing.postedDate = new Date(row.postedDate);
    }
    
    if (row.expiryDate) {
      jobListing.expiryDate = new Date(row.expiryDate);
    }

    if (salary) {
      jobListing.salary = salary;
    }

    return jobListing;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    logger.info('Database connection closed');
  }
}

// Export singleton instance
export const jobDatabase = new JobDatabase();