#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '@/utils/logger.js';
import chalk from 'chalk';
import { Command } from 'commander';

// Get package.json for version info
const __dirname = dirname(fileURLToPath(import.meta.url));
const packagePath = join(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

const program = new Command();

program
  .name('job-dorker')
  .description('🧠 Advanced Job Scraping and Data Extraction Tool')
  .version(packageJson.version);

program
  .command('search')
  .description('Search for jobs using Google Dorks')
  .option('-k, --keywords <keywords...>', 'Job keywords to search for')
  .option('-l, --location <location>', 'Job location')
  .option('-r, --remote', 'Include remote jobs only')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <format>', 'Report format (csv, json, pdf)', 'json')
  .option('-m, --max-results <number>', 'Maximum number of results', '100')
  .option('-v, --verbose', 'Verbose logging')
  .action(async (options) => {
    try {
      logger.info(chalk.blue('🔍 Starting job search...'));
      logger.info({ options }, 'Search parameters');

      // TODO: Implement job search
      logger.info(chalk.green('✅ Job search completed'));
    } catch (error) {
      logger.error({ err: error }, chalk.red('❌ Job search failed'));
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Manage configuration')
  .option('--show', 'Show current configuration')
  .option('--reset', 'Reset to default configuration')
  .action(async (options) => {
    try {
      if (options.show) {
        logger.info('📋 Current configuration:');
        // TODO: Show configuration
      }

      if (options.reset) {
        logger.info('🔄 Resetting configuration...');
        // TODO: Reset configuration
      }
    } catch (error) {
      logger.error({ err: error }, chalk.red('❌ Configuration command failed'));
      process.exit(1);
    }
  });

// Parse CLI arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
