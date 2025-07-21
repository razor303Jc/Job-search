import fs from 'node:fs';
import path from 'node:path';
import type { DbJobListing } from '@/types/index.js';
import { logger } from '@/utils/logger.js';
import Database from 'better-sqlite3';

/**
 * Database configuration options
 */
export interface DatabaseConfig {
  filename: string;
  verbose?: boolean;
  timeout?: number;
  fileMustExist?: boolean;
  readonly?: boolean;
}

/**
 * SQLite database connection manager
 */
export class DatabaseConnection {
  private db: Database.Database | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = {
      timeout: 30000,
      verbose: false,
      fileMustExist: false,
      readonly: false,
      ...config,
    };
  }

  /**
   * Initialize database connection and run migrations
   */
  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      const dbDir = path.dirname(this.config.filename);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Connect to database
      this.db = new Database(this.config.filename, {
        verbose: this.config.verbose ? logger.debug.bind(logger) : undefined,
        timeout: this.config.timeout,
        fileMustExist: this.config.fileMustExist,
        readonly: this.config.readonly,
      });

      // Configure database
      this.configurePragmas();

      // Run migrations
      await this.runMigrations();

      logger.info(
        {
          filename: this.config.filename,
          size: fs.statSync(this.config.filename).size,
        },
        'Database initialized successfully',
      );
    } catch (error) {
      logger.error({ error, config: this.config }, 'Failed to initialize database');
      throw error;
    }
  }

  /**
   * Configure SQLite pragma settings for performance and reliability
   */
  private configurePragmas(): void {
    if (!this.db) throw new Error('Database not initialized');

    // WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');

    // Increase cache size (in KB)
    this.db.pragma('cache_size = 10000');

    // Foreign key constraints
    this.db.pragma('foreign_keys = ON');

    // Sync mode for durability vs performance balance
    this.db.pragma('synchronous = NORMAL');

    // Enable memory-mapped I/O
    this.db.pragma('mmap_size = 268435456'); // 256MB

    // Temp store in memory
    this.db.pragma('temp_store = memory');

    logger.debug('Database pragmas configured');
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Create migrations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrations = this.getMigrations();
    const executedMigrations = this.getExecutedMigrations();

    for (const migration of migrations) {
      if (!executedMigrations.includes(migration.version)) {
        logger.info({ version: migration.version, name: migration.name }, 'Running migration');

        try {
          this.db.exec(migration.sql);

          // Record migration
          this.db
            .prepare(`
            INSERT INTO migrations (version, name) VALUES (?, ?)
          `)
            .run(migration.version, migration.name);

          logger.info({ version: migration.version }, 'Migration completed');
        } catch (error) {
          logger.error({ error, migration }, 'Migration failed');
          throw error;
        }
      }
    }
  }

  /**
   * Get list of migrations to run
   */
  private getMigrations(): Array<{ version: number; name: string; sql: string }> {
    return [
      {
        version: 1,
        name: 'create_jobs_table',
        sql: `
          CREATE TABLE jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            company TEXT NOT NULL,
            location TEXT NOT NULL,
            description TEXT,
            url TEXT NOT NULL,
            salary_min INTEGER,
            salary_max INTEGER,
            salary_currency TEXT DEFAULT 'USD',
            salary_period TEXT DEFAULT 'yearly',
            employment_type TEXT DEFAULT 'full-time',
            remote BOOLEAN DEFAULT FALSE,
            posted_date TEXT,
            expiry_date TEXT,
            requirements TEXT, -- JSON array
            benefits TEXT,     -- JSON array
            tags TEXT,         -- JSON array
            source_site TEXT NOT NULL,
            source_url TEXT NOT NULL,
            scraped_at TEXT NOT NULL,
            confidence REAL DEFAULT 0.5,
            raw_data TEXT,     -- JSON object
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `,
      },
      {
        version: 2,
        name: 'create_indexes',
        sql: `
          CREATE INDEX idx_jobs_company ON jobs(company);
          CREATE INDEX idx_jobs_location ON jobs(location);
          CREATE INDEX idx_jobs_employment_type ON jobs(employment_type);
          CREATE INDEX idx_jobs_remote ON jobs(remote);
          CREATE INDEX idx_jobs_posted_date ON jobs(posted_date);
          CREATE INDEX idx_jobs_salary_min ON jobs(salary_min);
          CREATE INDEX idx_jobs_source_site ON jobs(source_site);
          CREATE INDEX idx_jobs_created_at ON jobs(created_at);
        `,
      },
      {
        version: 3,
        name: 'create_searches_table',
        sql: `
          CREATE TABLE searches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            keywords TEXT NOT NULL, -- JSON array
            location TEXT,
            remote BOOLEAN DEFAULT FALSE,
            salary_min INTEGER,
            salary_max INTEGER,
            employment_types TEXT, -- JSON array
            exclude_keywords TEXT, -- JSON array
            date_posted TEXT,
            experience_level TEXT,
            max_results INTEGER DEFAULT 50,
            schedule_cron TEXT,
            active BOOLEAN DEFAULT TRUE,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `,
      },
      {
        version: 4,
        name: 'create_search_results_table',
        sql: `
          CREATE TABLE search_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            search_id INTEGER NOT NULL,
            job_id TEXT NOT NULL,
            rank INTEGER NOT NULL,
            score REAL DEFAULT 0.0,
            executed_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (search_id) REFERENCES searches(id) ON DELETE CASCADE,
            FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
            UNIQUE(search_id, job_id, executed_at)
          );
        `,
      },
      {
        version: 5,
        name: 'create_metrics_table',
        sql: `
          CREATE TABLE metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            metric_type TEXT NOT NULL, -- 'scraping', 'parsing', 'search'
            source TEXT, -- site name or process name
            jobs_scraped INTEGER DEFAULT 0,
            jobs_parsed INTEGER DEFAULT 0,
            success_rate REAL DEFAULT 0.0,
            avg_response_time INTEGER DEFAULT 0,
            errors_count INTEGER DEFAULT 0,
            memory_usage INTEGER DEFAULT 0,
            cpu_usage REAL DEFAULT 0.0,
            metadata TEXT -- JSON object
          );
        `,
      },
    ];
  }

  /**
   * Get list of executed migrations
   */
  private getExecutedMigrations(): number[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT version FROM migrations ORDER BY version');
      return stmt.all().map((row: { version: number }) => row.version);
    } catch {
      return [];
    }
  }

  /**
   * Get database connection
   */
  getConnection(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Execute a query with parameters
   */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(params || []) as T[];
    } catch (error) {
      logger.error({ error, sql, params }, 'Query execution failed');
      throw error;
    }
  }

  /**
   * Execute a query and return first result
   */
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | null {
    const results = this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Execute an insert/update/delete statement
   */
  execute(sql: string, params?: unknown[]): Database.RunResult {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(sql);
      return stmt.run(params || []);
    } catch (error) {
      logger.error({ error, sql, params }, 'Statement execution failed');
      throw error;
    }
  }

  /**
   * Begin a transaction
   */
  transaction<T>(fn: () => T): T {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(fn);
    return transaction();
  }

  /**
   * Create a prepared statement
   */
  prepare(sql: string): Database.Statement {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare(sql);
  }

  /**
   * Get database statistics
   */
  getStats(): {
    totalJobs: number;
    totalSearches: number;
    totalSearchResults: number;
    diskUsage: number;
    walSize: number;
  } {
    if (!this.db) throw new Error('Database not initialized');

    const totalJobs =
      this.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM jobs')?.count || 0;
    const totalSearches =
      this.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM searches')?.count || 0;
    const totalSearchResults =
      this.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM search_results')?.count || 0;

    const diskUsage = fs.existsSync(this.config.filename)
      ? fs.statSync(this.config.filename).size
      : 0;
    const walFile = `${this.config.filename}-wal`;
    const walSize = fs.existsSync(walFile) ? fs.statSync(walFile).size : 0;

    return {
      totalJobs,
      totalSearches,
      totalSearchResults,
      diskUsage,
      walSize,
    };
  }

  /**
   * Optimize database (VACUUM and ANALYZE)
   */
  optimize(): void {
    if (!this.db) throw new Error('Database not initialized');

    logger.info('Starting database optimization');

    const start = Date.now();
    this.db.exec('VACUUM');
    this.db.exec('ANALYZE');

    logger.info({ duration: Date.now() - start }, 'Database optimization completed');
  }

  /**
   * Backup database to file
   */
  backup(backupPath: string): void {
    if (!this.db) throw new Error('Database not initialized');

    logger.info({ backupPath }, 'Starting database backup');

    const start = Date.now();
    this.db.backup(backupPath);

    logger.info(
      {
        backupPath,
        duration: Date.now() - start,
        size: fs.statSync(backupPath).size,
      },
      'Database backup completed',
    );
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Database connection closed');
    }
  }

  /**
   * Check if database is connected
   */
  isConnected(): boolean {
    return this.db?.open === true;
  }
}
