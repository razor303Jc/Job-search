#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '@/utils/logger.js';
import chalk from 'chalk';
import { Command } from 'commander';

// Get package.json for version info
const __dirname = dirname(fileURLToPath(import.meta.url));
const packagePath = join(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

interface RawJobData {
  id?: string;
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  url?: string;
  postedDate?: string | Date;
  source?: {
    scrapedAt?: string | Date;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface RawDataWithJobs {
  jobs?: RawJobData[];
  [key: string]: unknown;
}

/**
 * Parse job data from JSON and convert date strings to Date objects
 */
function parseJobData(rawData: unknown): any[] {
  const rawJobs = Array.isArray(rawData)
    ? (rawData as RawJobData[])
    : (rawData as RawDataWithJobs)?.jobs || [];

  return rawJobs.map((job: RawJobData) => ({
    ...job,
    postedDate: job.postedDate ? new Date(job.postedDate) : undefined,
    source: job.source
      ? {
          ...job.source,
          scrapedAt: job.source.scrapedAt ? new Date(job.source.scrapedAt) : new Date(),
        }
      : undefined,
  }));
}

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
  .command('report')
  .description('Generate reports from existing job data')
  .option('-i, --input <path>', 'Input JSON file with job data')
  .option('-o, --output <path>', 'Output file path (extension determines format)')
  .option('-f, --format <format>', 'Report format (csv, json, pdf)')
  .option('-t, --title <title>', 'Report title', 'Job Search Report')
  .option('--no-analytics', 'Exclude analytics section')
  .option('--no-charts', 'Exclude charts section')
  .option('--no-job-details', 'Exclude job details section')
  .option('--max-jobs <number>', 'Maximum number of jobs to include')
  .option('--include-description', 'Include job descriptions in PDF')
  .option('--include-requirements', 'Include job requirements in PDF')
  .option('--include-benefits', 'Include job benefits in PDF')
  .option('--author <author>', 'Report author name')
  .option('--subject <subject>', 'Report subject')
  .option('--keywords <keywords>', 'Report keywords')
  .action(async (options) => {
    try {
      logger.info(chalk.blue('📊 Generating report...'));

      // Validate input file
      if (!options.input) {
        throw new Error('Input file path is required (use -i or --input)');
      }

      const inputPath = resolve(options.input);

      // Determine output format and path
      let format = options.format;
      let outputPath = options.output;

      if (outputPath && !format) {
        // Infer format from output file extension
        const ext = outputPath.split('.').pop()?.toLowerCase();
        if (ext === 'pdf' || ext === 'csv' || ext === 'json') {
          format = ext;
        }
      }

      // Set default format if not specified
      if (!format) {
        format = 'pdf';
      }

      if (!outputPath) {
        // Generate default output path
        const timestamp = new Date().toISOString().slice(0, 10);
        outputPath = `job-report-${timestamp}.${format}`;
      }

      // Resolve the output path
      outputPath = resolve(outputPath);

      logger.info({ inputPath, outputPath, format }, 'Report generation parameters');

      // Import and use appropriate generator
      if (format === 'pdf') {
        const { PdfGenerator } = await import('../generators/pdf-generator.js');
        const { promises: fs } = await import('node:fs');

        // Load job data
        const jobData = JSON.parse(await fs.readFile(inputPath, 'utf-8'));
        const jobs = parseJobData(jobData);

        const pdfOptions = {
          outputPath,
          title: options.title,
          metadata: {
            author: options.author,
            subject: options.subject,
            keywords: options.keywords,
          },
          layout: {
            includeAnalytics: options.analytics !== false,
            includeCharts: options.charts !== false,
            includeJobDetails: options.jobDetails !== false,
          },
          filters: {
            ...(options.maxJobs && { maxJobs: Number.parseInt(options.maxJobs) }),
            includeDescription: options.includeDescription,
            includeRequirements: options.includeRequirements,
            includeBenefits: options.includeBenefits,
          },
        };
        await PdfGenerator.generateReport(jobs, pdfOptions);
      } else if (format === 'csv') {
        const { CsvGenerator } = await import('../generators/csv-generator.js');
        const { promises: fs } = await import('node:fs');

        const jobData = JSON.parse(await fs.readFile(inputPath, 'utf-8'));
        const jobs = parseJobData(jobData);

        await CsvGenerator.generateReport(jobs, { outputPath });
      } else if (format === 'json') {
        const { JsonGenerator } = await import('../generators/json-generator.js');
        const { promises: fs } = await import('node:fs');

        const jobData = JSON.parse(await fs.readFile(inputPath, 'utf-8'));
        const jobs = parseJobData(jobData);

        await JsonGenerator.generateReport(jobs, { outputPath });
      } else {
        throw new Error(`Unsupported format: ${format}. Use csv, json, or pdf`);
      }

      logger.info(chalk.green(`✅ Report generated: ${outputPath}`));
    } catch (error) {
      logger.error({ err: error }, chalk.red('❌ Report generation failed'));
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate generated report files')
  .argument('<file>', 'File path to validate')
  .action(async (filePath) => {
    try {
      logger.info(chalk.blue(`🔍 Validating file: ${filePath}`));

      const resolvedPath = resolve(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase();

      if (ext === 'pdf') {
        const { PdfGenerator } = await import('../generators/pdf-generator.js');
        const validation = await PdfGenerator.validatePdfFile(resolvedPath);

        if (validation.valid) {
          logger.info(chalk.green('✅ PDF file is valid'));
          logger.info(`📏 File size: ${validation.fileSize} bytes`);
        } else {
          logger.error(chalk.red('❌ PDF file validation failed:'));
          validation.errors.forEach((error) => logger.error(`   ${error}`));
          process.exit(1);
        }
      } else if (ext === 'csv') {
        const { CsvGenerator } = await import('../generators/csv-generator.js');
        const validation = await CsvGenerator.validateCsvFile(resolvedPath);

        if (validation.valid) {
          logger.info(chalk.green('✅ CSV file is valid'));
          logger.info(`📊 Records: ${validation.rowCount || 0}`);
        } else {
          logger.error(chalk.red('❌ CSV file validation failed:'));
          validation.errors.forEach((error) => logger.error(`   ${error}`));
          process.exit(1);
        }
      } else if (ext === 'json') {
        const { JsonGenerator } = await import('../generators/json-generator.js');
        const validation = await JsonGenerator.validateJsonFile(resolvedPath);

        if (validation.valid) {
          logger.info(chalk.green('✅ JSON file is valid'));
          logger.info(`📊 Jobs: ${validation.jobCount}`);
        } else {
          logger.error(chalk.red('❌ JSON file validation failed:'));
          validation.errors.forEach((error) => logger.error(`   ${error}`));
          process.exit(1);
        }
      } else {
        throw new Error(`Unsupported file type: ${ext}. Use .pdf, .csv, or .json files`);
      }
    } catch (error) {
      logger.error({ err: error }, chalk.red('❌ File validation failed'));
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

program
  .command('web')
  .description('Start enhanced web dashboard with real-time features')
  .option('-p, --port <port>', 'Server port', '3000')
  .option('-h, --host <host>', 'Server host', '0.0.0.0')
  .action(async (options) => {
    try {
      logger.info(chalk.blue('🚀 Starting enhanced web dashboard...'));

      const { EnhancedWebServer } = await import('../web/server-v2.js');
      const server = new EnhancedWebServer();

      await server.start(Number(options.port), options.host);

      logger.info(
        chalk.green(`✅ Enhanced web dashboard running at http://localhost:${options.port}`),
      );
      logger.info(chalk.cyan(`📡 WebSocket endpoint: ws://localhost:${options.port}/ws`));
      logger.info(chalk.yellow('Press Ctrl+C to stop'));

      // Graceful shutdown
      process.on('SIGINT', async () => {
        logger.info(chalk.blue('🛑 Shutting down...'));
        await server.close();
        process.exit(0);
      });
    } catch (error) {
      logger.error({ err: error }, chalk.red('❌ Failed to start web dashboard'));
      process.exit(1);
    }
  });

// Parse CLI arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
