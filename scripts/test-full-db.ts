#!/usr/bin/env tsx

/**
 * Test database classes with absolute imports
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { MigrationManager } from '../src/database/migrations/manager.js';

// Import logger directly
const logger = {
  debug: (msg: string, meta?: any) => console.log(`[DEBUG] ${msg}`, meta || ''),
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
  warn: (msg: string, meta?: any) => console.log(`[WARN] ${msg}`, meta || ''),
  error: (msg: string, meta?: any) => console.log(`[ERROR] ${msg}`, meta || ''),
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
  
  console.log('Applying migrations...');
  
  try {
    // Use our migration manager to run all migrations
    const results = await migrationManager.migrate();
    
    console.log(`Applied ${results.length} migrations`);
    for (const result of results) {
      console.log(`- ${result.migration.filename}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
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
    console.log('Creating database connection...');
    const db = createDatabase();
    
    console.log('Running migrations...');
    await runMigrations(db);
    
    console.log('Testing job insertion...');
    const insertJob = db.prepare(`
      INSERT INTO jobs (title, company, location, url, source, scraped_at, confidence_score, has_details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = insertJob.run(
      'Software Engineer',
      'Test Company',
      'Remote',
      'https://example.com/job/1',
      'test',
      new Date().toISOString(),
      1.0,
      1  // boolean true as integer for SQLite
    );
    
    console.log('Job inserted:', result);
    
    console.log('Testing job query...');
    const jobs = db.prepare('SELECT * FROM jobs').all();
    console.log('Jobs found:', jobs.length);
    
    db.close();
    console.log('Database test completed successfully!');
    
  } catch (error) {
    console.error('Database test failed:', error);
    process.exit(1);
  }
}

main();
