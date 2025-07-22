/**
 * Database connection and setup using better-sqlite3
 * Provides fast, synchronous database operations with WAL mode
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '@/utils/logger.js';
import Database from 'better-sqlite3';

export interface DatabaseConfig {
  filename: string;
  readonly?: boolean;
  memory?: boolean;
  verbose?: boolean;
  fileMustExist?: boolean;
  timeout?: number;
}

export class DatabaseConnection {
  private db: Database.Database | null = null;
  private config: DatabaseConfig;

  constructor(config: Partial<DatabaseConfig> = {}) {
    this.config = {
      filename: config.filename || join(process.cwd(), 'data', 'job-dorker.db'),
      readonly: config.readonly || false,
      memory: config.memory || false,
      verbose: config.verbose || false,
      fileMustExist: config.fileMustExist || false,
      timeout: config.timeout || 5000,
    };
  }

  /**
   * Initialize database connection
   */
  connect(): Database.Database {
    if (this.db) {
      return this.db;
    }

    try {
      // Ensure data directory exists
      if (!this.config.memory) {
        const dataDir = join(process.cwd(), 'data');
        if (!existsSync(dataDir)) {
          mkdirSync(dataDir, { recursive: true });
        }
      }

      // Open database connection
      this.db = new Database(this.config.filename, {
        readonly: this.config.readonly,
        fileMustExist: this.config.fileMustExist,
        timeout: this.config.timeout,
        verbose: this.config.verbose
          ? (message?: unknown) => logger.debug('SQL', { message })
          : undefined,
      });

      // Configure database for performance
      this.setupDatabase();

      logger.info('Database connected', {
        filename: this.config.filename,
        readonly: this.config.readonly,
        memory: this.config.memory,
      });

      return this.db;
    } catch (error) {
      logger.error('Failed to connect to database', { error, config: this.config });
      throw error;
    }
  }

  /**
   * Configure database settings for optimal performance
   */
  private setupDatabase(): void {
    if (!this.db) throw new Error('Database not connected');

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');

    // Set synchronous mode for better performance
    this.db.pragma('synchronous = NORMAL');

    // Set cache size (negative value = KB)
    this.db.pragma('cache_size = -64000'); // 64MB cache

    // Enable foreign key constraints
    this.db.pragma('foreign_keys = ON');

    // Set temp store to memory
    this.db.pragma('temp_store = MEMORY');

    // Set mmap size for better performance
    this.db.pragma('mmap_size = 268435456'); // 256MB

    logger.debug('Database configured with performance optimizations');
  }

  /**
   * Get the database instance
   */
  getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
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
    return this.db !== null;
  }

  /**
   * Execute a transaction
   */
  transaction<T>(fn: (db: Database.Database) => T): T {
    const db = this.getDatabase();
    const transaction = db.transaction(fn);
    return transaction(db);
  }

  /**
   * Get database information
   */
  getInfo(): {
    filename: string;
    readonly: boolean;
    inTransaction: boolean;
    open: boolean;
    memory: boolean;
  } {
    const db = this.getDatabase();
    return {
      filename: this.config.filename,
      readonly: this.config.readonly || false,
      inTransaction: db.inTransaction,
      open: db.open,
      memory: this.config.memory || false,
    };
  }

  /**
   * Backup database to file
   */
  async backup(filename: string): Promise<void> {
    const db = this.getDatabase();

    try {
      const backup = await db.backup(filename);
      logger.info('Database backup completed', {
        filename,
        pages: backup.totalPages,
        size: `${Math.round((backup.totalPages * this.getStats().pageSize) / 1024)}KB`,
      });
    } catch (error) {
      logger.error('Database backup failed', { error, filename });
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  getStats(): {
    pageCount: number;
    pageSize: number;
    cacheSize: number;
    freelistCount: number;
    walMode: boolean;
  } {
    const db = this.getDatabase();

    return {
      pageCount: db.pragma('page_count', { simple: true }) as number,
      pageSize: db.pragma('page_size', { simple: true }) as number,
      cacheSize: db.pragma('cache_size', { simple: true }) as number,
      freelistCount: db.pragma('freelist_count', { simple: true }) as number,
      walMode: (db.pragma('journal_mode', { simple: true }) as string) === 'wal',
    };
  }
}

// Singleton instance
export const dbConnection = new DatabaseConnection();
export default dbConnection;
