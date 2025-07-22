#!/usr/bin/env tsx

/**
 * Test our improved migration system
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

// Import our migration manager class
class MigrationManager {
  private db: Database.Database;
  private migrationsPath: string;

  constructor(db: Database.Database, migrationsPath?: string) {
    this.db = db;
    this.migrationsPath = migrationsPath || join(process.cwd(), 'src', 'database', 'migrations');
  }

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
  }

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

  migrate(_filename: string, sql: string): void {
    this.initializeMigrationsTable();

    const statements = this.parseSqlStatements(sql);

    const transaction = this.db.transaction(() => {
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        if (!stmt) continue;
        try {
          this.db.exec(stmt);
        } catch (error) {
          console.error(`✗ Statement ${i + 1} failed:`, error);
          throw error;
        }
      }
    });

    transaction();
  }
}

async function main() {
  try {
    // Create data directory
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // Create database
    const dbPath = join(dataDir, 'test-migration.db');
    const db = new Database(dbPath);

    // Create migration manager
    const migrationManager = new MigrationManager(db);
    const migrationPath = join(
      process.cwd(),
      'src',
      'database',
      'migrations',
      '001_create_jobs_table.sql',
    );
    const sql = readFileSync(migrationPath, 'utf-8');
    migrationManager.migrate('001_create_jobs_table.sql', sql);
    const insertJob = db.prepare(`
      INSERT INTO jobs (title, company, location, url, source, scraped_at, confidence_score, has_details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const _result = insertJob.run(
      'Software Engineer',
      'Test Company',
      'Remote',
      'https://example.com/job/1',
      'test',
      new Date().toISOString(),
      1.0,
      1, // boolean true as integer for SQLite
    );
    const _jobs = db.prepare('SELECT * FROM jobs').all();
    const _ftsTest = db.prepare('SELECT * FROM jobs_fts').all();

    db.close();
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    process.exit(1);
  }
}

main();
