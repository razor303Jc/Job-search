#!/usr/bin/env tsx

/**
 * Migration script - sets up database schema
 */

import { initializeDatabase } from '../src/database/index.ts';
import { logger } from '../src/utils/logger.ts';

async function main() {
  try {
    logger.info('Starting database migration...');
    
    const db = await initializeDatabase();
    
    // Get database info
    const info = db.connection.getInfo();
    const stats = db.getStats();
    
    logger.info('Database migration completed successfully', {
      filename: info.filename,
      readonly: info.readonly,
      memory: info.memory,
      pageCount: stats.pageCount,
      pageSize: stats.pageSize,
      walMode: stats.walMode,
    });

    // Test basic functionality
    const jobStats = await db.jobs.getStats();
    logger.info('Job statistics', jobStats);

    db.close();
    
    logger.info('Migration script completed');
  } catch (error) {
    logger.error('Migration failed', { 
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error 
    });
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
