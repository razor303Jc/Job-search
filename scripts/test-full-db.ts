#!/usr/bin/env tsx

/**
 * Test database classes with absolute imports
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { MigrationManager } from '../src/database/migrations/manager.js';

// Simple logger for testing
const _logger = {
  debug: (_msg: string, _meta?: unknown) => undefined,
  info: (_msg: string, _meta?: unknown) => undefined,
  warn: (_msg: string, _meta?: unknown) => undefined,
  error: (_msg: string, _meta?: unknown) => undefined,
};

// Simple database connection
function createDatabase() {
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = join(dataDir, 'job-dorker.db');
  return new Database(dbPath);
}

// Simple migration runner
async function runMigrations(db: Database.Database) {
  const migrationManager = new MigrationManager(db);

  try {
    // Use our migration manager to run all migrations
    const results = await migrationManager.migrate();
    for (const result of results) {
      if (!result.success && result.error) {
        console.error(`  Error: ${result.error}`);
      }
    }
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

async function main() {
  try {
    const db = createDatabase();
    await runMigrations(db);
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

    db.close();
  } catch (error) {
    console.error('Database test failed:', error);
    process.exit(1);
  }
}

main();
