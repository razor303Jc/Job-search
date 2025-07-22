#!/usr/bin/env tsx

/**
 * Test database classes with absolute imports
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

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
function runMigrations(db: Database.Database) {
  const migrationsPath = join(process.cwd(), 'src', 'database', 'migrations');
  
  // Create migrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      filename TEXT NOT NULL,
      sql TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(id, name)
    )
  `);

  // Get migration files
  const files = ['001_create_jobs_table_simple.sql'];
  
  for (const filename of files) {
    try {
      const filepath = join(migrationsPath, filename);
      const sql = readFileSync(filepath, 'utf-8');
      
      const match = filename.match(/^(\d+)[-_](.+)\.sql$/);
      if (!match) continue;
      
      const [, idStr, name] = match;
      const id = parseInt(idStr, 10);
      
      // Check if already applied
      const check = db.prepare('SELECT id FROM migrations WHERE id = ?').get(id);
      if (check) {
        console.log(`Migration ${id} already applied, skipping`);
        continue;
      }
      
      console.log(`Applying migration ${id}: ${name}`);
      
      // Run migration in transaction
      const transaction = db.transaction(() => {
        // Split SQL and execute
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        console.log(`Found ${statements.length} statements in migration ${id}`);
        
        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          console.log(`Executing statement ${i + 1}:`, stmt.substring(0, 100) + '...');
          try {
            db.exec(stmt);
            console.log(`Statement ${i + 1} executed successfully`);
          } catch (error) {
            console.error(`Statement ${i + 1} failed:`, error);
            console.error(`Full statement:`, stmt);
            throw error;
          }
        }
        
        // Record migration
        db.prepare('INSERT INTO migrations (id, name, filename, sql) VALUES (?, ?, ?, ?)')
          .run(id, name, filename, sql);
      });
      
      transaction();
      console.log(`Migration ${id} applied successfully`);
      
    } catch (error) {
      console.error(`Failed to apply migration ${filename}:`, error);
      throw error;
    }
  }
}

async function main() {
  try {
    console.log('Creating database connection...');
    const db = createDatabase();
    
    console.log('Running migrations...');
    runMigrations(db);
    
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
      true
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
