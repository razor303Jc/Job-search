#!/usr/bin/env node

import { logger } from '@/utils/logger.js';

/**
 * Main entry point for Job Dorker
 */
async function main() {
  try {
    logger.info('🚀 Job Dorker starting up...');

    // TODO: Initialize application
    logger.info('✅ Job Dorker initialized successfully');

    // Graceful shutdown
    process.on('SIGINT', () => {
      logger.info('📴 Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('📴 Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to start Job Dorker');
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error({ err: error }, '💥 Unhandled error in main');
    process.exit(1);
  });
}
