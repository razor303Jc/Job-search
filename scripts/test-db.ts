#!/usr/bin/env tsx

/**
 * Simple database test
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

try {
  console.log('Testing better-sqlite3 database creation...');
  
  // Ensure data directory exists
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    console.log('Created data directory:', dataDir);
  }

  // Create database
  const dbPath = join(dataDir, 'test.db');
  const db = new Database(dbPath);
  
  console.log('Database created successfully at:', dbPath);
  
  // Test basic operation
  db.exec('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)');
  console.log('Test table created');
  
  const stmt = db.prepare('INSERT INTO test (name) VALUES (?)');
  const result = stmt.run('Test Entry');
  console.log('Test record inserted:', result);
  
  const selectStmt = db.prepare('SELECT * FROM test');
  const rows = selectStmt.all();
  console.log('Test records:', rows);
  
  db.close();
  console.log('Database test completed successfully!');
  
} catch (error) {
  console.error('Database test failed:', error);
  process.exit(1);
}
