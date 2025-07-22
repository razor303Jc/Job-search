/**
 * Database migration system
 * Handles schema evolution and data migrations
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '@/utils/logger.js';
import type Database from 'better-sqlite3';

export interface Migration {
  id: number;
  name: string;
  filename: string;
  sql: string;
  applied_at?: Date;
}

export interface MigrationResult {
  migration: Migration;
  success: boolean;
  error?: string;
  duration: number;
}

export class MigrationManager {
  private db: Database.Database;
  private migrationsPath: string;

  constructor(db: Database.Database, migrationsPath?: string) {
    this.db = db;
    this.migrationsPath = migrationsPath || join(process.cwd(), 'src', 'database', 'migrations');
  }

  /**
   * Initialize migrations table
   */
  private initializeMigrationsTable(): void {
    const createTable = this.db.prepare(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        filename TEXT NOT NULL,
        sql TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(id, name)
      )
    `);

    createTable.run();
    logger.debug('Migrations table initialized');
  }

  /**
   * Get all migrations from filesystem
   */
  private loadMigrationsFromDisk(): Migration[] {
    try {
      logger.debug('Loading migrations from', { path: this.migrationsPath });

      const files = readdirSync(this.migrationsPath)
        .filter((file) => file.endsWith('.sql'))
        .sort();

      logger.debug('Found migration files', { files });

      const migrations: Migration[] = [];

      for (const filename of files) {
        const match = filename.match(/^(\d+)[-_](.+)\.sql$/);
        if (!match) {
          logger.warn('Invalid migration filename format', { filename });
          continue;
        }

        const [, idStr, name] = match;

        if (!idStr || !name) {
          logger.warn('Invalid migration filename format', { filename });
          continue;
        }

        const id = Number.parseInt(idStr, 10);
        const filepath = join(this.migrationsPath, filename);

        logger.debug('Loading migration file', { id, name, filepath });

        const sql = readFileSync(filepath, 'utf-8');

        migrations.push({
          id,
          name,
          filename,
          sql: sql.trim(),
        });

        logger.debug('Loaded migration', { id, name, sqlLength: sql.length });
      }

      logger.debug('Loaded migrations from disk', { count: migrations.length });
      return migrations;
    } catch (error) {
      logger.error('Failed to load migrations from disk', { error, path: this.migrationsPath });
      throw error;
    }
  }

  /**
   * Get applied migrations from database
   */
  private getAppliedMigrations(): Migration[] {
    const stmt = this.db.prepare(`
      SELECT id, name, filename, sql, applied_at
      FROM migrations
      ORDER BY id ASC
    `);

    return stmt.all().map((row: any) => ({
      id: row.id,
      name: row.name,
      filename: row.filename,
      sql: row.sql,
      applied_at: new Date(row.applied_at),
    }));
  }

  /**
   * Get pending migrations
   */
  getPendingMigrations(): Migration[] {
    this.initializeMigrationsTable();

    const diskMigrations = this.loadMigrationsFromDisk();
    const appliedMigrations = this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map((m) => m.id));

    return diskMigrations.filter((migration) => !appliedIds.has(migration.id));
  }

  /**
   * Parse SQL into individual statements, respecting block boundaries
   */
  private parseSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let currentStatement = '';
    let inBlock = false;
    let blockKeyword = '';

    const lines = sql.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('--')) {
        if (currentStatement) {
          currentStatement += `\n${line}`;
        }
        continue;
      }

      currentStatement += (currentStatement ? '\n' : '') + line;

      // Check for block start keywords
      const upperLine = trimmedLine.toUpperCase();
      if (!inBlock) {
        if (
          upperLine.includes('CREATE TRIGGER') ||
          upperLine.includes('CREATE FUNCTION') ||
          upperLine.includes('CREATE PROCEDURE')
        ) {
          inBlock = true;
          blockKeyword = 'BEGIN';
        } else if (upperLine.includes('BEGIN')) {
          inBlock = true;
          blockKeyword = 'BEGIN';
        }
      }

      // Check for block end
      if (inBlock && upperLine.includes('END')) {
        // Check if this END matches our block type
        if (blockKeyword === 'BEGIN') {
          inBlock = false;
          blockKeyword = '';
        }
      }

      // Check for statement end
      if (trimmedLine.endsWith(';') && !inBlock) {
        const statement = currentStatement.trim();
        if (statement && !statement.startsWith('--')) {
          statements.push(statement);
        }
        currentStatement = '';
      }
    }

    // Add any remaining statement
    if (currentStatement.trim()) {
      const statement = currentStatement.trim();
      if (statement && !statement.startsWith('--')) {
        statements.push(statement);
      }
    }

    return statements;
  }

  /**
   * Apply a single migration
   */
  private applyMigration(migration: Migration): MigrationResult {
    const startTime = Date.now();

    try {
      // Run migration in a transaction
      const transaction = this.db.transaction(() => {
        // Parse SQL into proper statements
        const statements = this.parseSqlStatements(migration.sql);

        logger.debug('Parsed migration statements', {
          migrationId: migration.id,
          statementCount: statements.length,
        });

        for (let i = 0; i < statements.length; i++) {
          const sql = statements[i];

          if (!sql) continue;

          try {
            this.db.exec(sql);
            logger.debug(`Statement ${i + 1} executed successfully`, {
              migrationId: migration.id,
              preview: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
            });
          } catch (statementError) {
            logger.error(`Statement ${i + 1} failed`, {
              migrationId: migration.id,
              sql: sql,
              error: statementError,
            });
            throw statementError;
          }
        }

        // Record migration as applied
        const insertMigration = this.db.prepare(`
          INSERT INTO migrations (id, name, filename, sql)
          VALUES (?, ?, ?, ?)
        `);

        insertMigration.run(migration.id, migration.name, migration.filename, migration.sql);
      });

      transaction();

      const duration = Date.now() - startTime;
      logger.info('Migration applied successfully', {
        id: migration.id,
        name: migration.name,
        duration: `${duration}ms`,
      });

      return {
        migration,
        success: true,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Migration failed', {
        id: migration.id,
        name: migration.name,
        error: errorMessage,
        duration: `${duration}ms`,
      });

      return {
        migration,
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<MigrationResult[]> {
    const pendingMigrations = this.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations found');
      return [];
    }

    logger.info('Running migrations', { count: pendingMigrations.length });

    const results: MigrationResult[] = [];

    for (const migration of pendingMigrations) {
      const result = this.applyMigration(migration);
      results.push(result);

      if (!result.success) {
        logger.error('Migration failed, stopping migration process', {
          failed: migration.name,
          error: result.error,
        });
        break;
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logger.info('Migration process completed', {
      successful,
      failed,
      total: results.length,
    });

    return results;
  }

  /**
   * Get migration status
   */
  getStatus(): {
    appliedMigrations: Migration[];
    pendingMigrations: Migration[];
    totalMigrations: number;
  } {
    this.initializeMigrationsTable();

    const appliedMigrations = this.getAppliedMigrations();
    const pendingMigrations = this.getPendingMigrations();

    return {
      appliedMigrations,
      pendingMigrations,
      totalMigrations: appliedMigrations.length + pendingMigrations.length,
    };
  }

  /**
   * Reset migrations (dangerous - removes all data)
   */
  async reset(): Promise<void> {
    logger.warn('Resetting all migrations - this will drop all data!');

    // Get all table names except migrations
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name != 'migrations'")
      .all()
      .map((row: any) => row.name);

    // Drop all tables
    for (const tableName of tables) {
      this.db.exec(`DROP TABLE IF EXISTS ${tableName}`);
      logger.debug('Dropped table', { tableName });
    }

    // Clear migrations record
    this.db.exec('DELETE FROM migrations');

    logger.warn('Database reset completed');
  }

  /**
   * Rollback to a specific migration (if supported)
   */
  async rollback(_targetId: number): Promise<void> {
    logger.warn(
      'Migration rollback is not implemented - SQLite does not support schema rollbacks easily',
    );
    throw new Error(
      'Migration rollback is not supported. Consider using database backup/restore instead.',
    );
  }
}

export default MigrationManager;
