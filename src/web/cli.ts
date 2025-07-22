#!/usr/bin/env node

/**
 * Job Dorker Web Server CLI
 * Starts the web interface for job searching and management
 */

import { logger } from '@/utils/logger.js';
import { Command } from 'commander';
import { JobDorkerServer } from './server.js';

const program = new Command();

program.name('job-dorker-web').description('Job Dorker Web Interface').version('1.0.0');

program
  .command('start')
  .description('Start the web server')
  .option('-h, --host <host>', 'Host to bind to', '0.0.0.0')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('--log-level <level>', 'Log level (error, warn, info, debug, trace)', 'info')
  .action(async (options) => {
    const server = new JobDorkerServer({
      host: options.host,
      port: Number.parseInt(options.port, 10),
      logLevel: options.logLevel,
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    try {
      await server.start();
    } catch (error) {
      logger.error('Failed to start web server', { error });
      process.exit(1);
    }
  });

program.parse();
