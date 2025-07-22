#!/usr/bin/env tsx

/**
 * Simple database test
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

try {
  // Ensure data directory exists
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Create database
  const dbPath = join(dataDir, 'test.db');
  const db = new Database(dbPath);

  // Test basic operation
  db.exec('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)');

  const stmt = db.prepare('INSERT INTO test (name) VALUES (?)');
  const _result = stmt.run('Test Entry');

  const selectStmt = db.prepare('SELECT * FROM test');
  const _rows = selectStmt.all();

  db.close();
} catch (error) {
  console.error('Database test failed:', error);
  process.exit(1);
}
