import { Command } from 'commander';
import { CheerioScraper } from '@/scrapers/cheerio-scraper.js';
import { jobDatabase } from '@/database/job-database.js';
import { jobDeduplicator } from '@/utils/job-deduplicator.js';
import { reportGenerator } from '@/generators/report-generator.js';
import { logger } from '@/utils/logger.js';
import ora from 'ora';
import chalk from 'chalk';
import type { JobSearchCriteria, ReportOptions } from '@/types/index.js';

const program = new Command();

program
  .name('job-dorker')
  .description('AI-powered job scraper using Google Dorks')
  .version('1.0.0');

program
  .command('search')
  .description('Search for jobs using Google Dorks')
  .option('-k, --keywords <keywords...>', 'Job keywords to search for', [])
  .option('-l, --location <location>', 'Job location')
  .option('-r, --remote', 'Search for remote jobs only')
  .option('-s, --salary-min <amount>', 'Minimum salary', (val) => parseInt(val))
  .option('-S, --salary-max <amount>', 'Maximum salary', (val) => parseInt(val))
  .option('-t, --employment-type <types...>', 'Employment types', [])
  .option('-m, --max-results <number>', 'Maximum number of results', (val) => parseInt(val), 50)
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <format>', 'Output format (csv, json, pdf)', 'json')
  .option('--no-dedupe', 'Skip deduplication')
  .option('--save-to-db', 'Save results to database')
  .option('--analytics', 'Include analytics in report')
  .action(async (options) => {
    try {
      const spinner = ora('Initializing job search...').start();

      // Validate inputs
      if (!options.keywords || options.keywords.length === 0) {
        spinner.fail('Please provide at least one keyword to search for');
        process.exit(1);
      }

      // Build search criteria
      const criteria: JobSearchCriteria = {
        keywords: options.keywords,
        location: options.location,
        remote: options.remote,
        salaryMin: options.salaryMin,
        salaryMax: options.salaryMax,
        employmentTypes: options.employmentType.length > 0 ? options.employmentType : undefined,
        maxResults: options.maxResults,
      };

      spinner.text = 'Setting up scraper...';

      // Initialize scraper with configuration
      const scraperConfig = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        delay: 2000, // 2 second delay between requests
        retries: 3,
        timeout: 30000, // 30 second timeout
        respectRobotsTxt: true,
        rateLimit: {
          requestsPerSecond: 1,
          burst: 5,
        },
      };

      const scraper = new CheerioScraper(scraperConfig);

      spinner.text = `Searching for jobs with keywords: ${criteria.keywords.join(', ')}...`;

      // Perform the search
      const searchResult = await scraper.scrape(criteria.keywords, criteria.maxResults);

      if (searchResult.jobs.length === 0) {
        spinner.fail('No jobs found for the given criteria');
        return;
      }

      spinner.text = `Found ${searchResult.jobs.length} jobs, processing...`;

      let finalJobs = searchResult.jobs;

      // Deduplication (unless disabled)
      if (options.dedupe !== false) {
        spinner.text = 'Removing duplicates...';
        const deduplicationResult = jobDeduplicator.findDuplicates(searchResult.jobs);
        finalJobs = deduplicationResult.unique;
        
        if (deduplicationResult.duplicates.length > 0) {
          logger.info(`Removed ${deduplicationResult.duplicates.length} duplicate jobs`);
        }
      }

      // Save to database if requested
      if (options.saveToDb) {
        spinner.text = 'Saving jobs to database...';
        const savedCount = jobDatabase.saveJobs(finalJobs);
        logger.info(`Saved ${savedCount} jobs to database`);
      }

      // Generate report
      spinner.text = 'Generating report...';

      const reportOptions: ReportOptions = {
        format: options.format as 'csv' | 'json' | 'pdf',
        outputPath: options.output,
        analytics: options.analytics,
      };

      await reportGenerator.generateReport(finalJobs, reportOptions);

      // Display summary
      spinner.succeed('Job search completed successfully!');

      console.log('\n' + chalk.bold.green('📊 Search Summary:'));
      console.log(chalk.blue(`├─ Keywords: ${criteria.keywords.join(', ')}`));
      if (criteria.location) console.log(chalk.blue(`├─ Location: ${criteria.location}`));
      if (criteria.remote) console.log(chalk.blue(`├─ Remote: Yes`));
      console.log(chalk.blue(`├─ Total found: ${searchResult.jobs.length}`));
      console.log(chalk.blue(`├─ After deduplication: ${finalJobs.length}`));
      console.log(chalk.blue(`├─ Success rate: ${searchResult.metadata.successRate.toFixed(1)}%`));
      console.log(chalk.blue(`├─ Duration: ${(searchResult.metadata.duration / 1000).toFixed(1)}s`));
      console.log(chalk.blue(`└─ Sources: ${searchResult.metadata.sources.join(', ')}`));

      // Show top companies and locations
      if (finalJobs.length > 0) {
        const companies = new Map<string, number>();
        const locations = new Map<string, number>();
        
        finalJobs.forEach(job => {
          companies.set(job.company, (companies.get(job.company) || 0) + 1);
          locations.set(job.location, (locations.get(job.location) || 0) + 1);
        });

        const topCompanies = Array.from(companies.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        const topLocations = Array.from(locations.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        console.log('\n' + chalk.bold.yellow('🏢 Top Companies:'));
        topCompanies.forEach(([company, count], i) => {
          console.log(chalk.yellow(`${i + 1}. ${company} (${count} jobs)`));
        });

        console.log('\n' + chalk.bold.cyan('📍 Top Locations:'));
        topLocations.forEach(([location, count], i) => {
          console.log(chalk.cyan(`${i + 1}. ${location} (${count} jobs)`));
        });
      }

      if (options.output) {
        console.log('\n' + chalk.bold.green(`📄 Report saved to: ${options.output}`));
      }

    } catch (error) {
      logger.error({ error }, 'Job search failed');
      console.error(chalk.red(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show database statistics')
  .action(async () => {
    try {
      const stats = jobDatabase.getStats();
      
      console.log(chalk.bold.blue('\n📊 Database Statistics:'));
      console.log(chalk.blue(`├─ Total jobs: ${stats.totalJobs.toLocaleString()}`));
      console.log(chalk.blue(`├─ Unique companies: ${stats.uniqueCompanies.toLocaleString()}`));
      console.log(chalk.blue(`├─ Remote jobs: ${stats.remoteJobs.toLocaleString()}`));
      console.log(chalk.blue(`└─ Average salary: ${stats.avgSalary ? `$${Math.round(stats.avgSalary).toLocaleString()}` : 'N/A'}`));

      if (stats.topCompanies.length > 0) {
        console.log(chalk.bold.yellow('\n🏢 Top Companies:'));
        stats.topCompanies.slice(0, 10).forEach((company, i) => {
          console.log(chalk.yellow(`${i + 1}. ${company.company} (${company.count} jobs)`));
        });
      }

      if (stats.topLocations.length > 0) {
        console.log(chalk.bold.cyan('\n📍 Top Locations:'));
        stats.topLocations.slice(0, 10).forEach((location, i) => {
          console.log(chalk.cyan(`${i + 1}. ${location.location} (${location.count} jobs)`));
        });
      }

    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program
  .command('export')
  .description('Export jobs from database')
  .option('-f, --format <format>', 'Export format (csv, json, pdf)', 'json')
  .option('-o, --output <path>', 'Output file path')
  .option('-l, --limit <number>', 'Limit number of jobs', (val) => parseInt(val))
  .option('--keywords <keywords...>', 'Filter by keywords')
  .option('--company <company>', 'Filter by company')
  .option('--location <location>', 'Filter by location')
  .option('--remote', 'Filter remote jobs only')
  .option('--analytics', 'Include analytics in report')
  .action(async (options) => {
    try {
      const spinner = ora('Fetching jobs from database...').start();

      const filters = {
        keywords: options.keywords,
        company: options.company,
        location: options.location,
        remote: options.remote,
        limit: options.limit || 1000,
      };

      const jobs = jobDatabase.searchJobs(filters);

      if (jobs.length === 0) {
        spinner.fail('No jobs found matching the criteria');
        return;
      }

      spinner.text = 'Generating export...';

      const reportOptions: ReportOptions = {
        format: options.format as 'csv' | 'json' | 'pdf',
        outputPath: options.output || `jobs-export-${new Date().toISOString().split('T')[0]}.${options.format}`,
        analytics: options.analytics,
      };

      await reportGenerator.generateReport(jobs, reportOptions);

      spinner.succeed(`Exported ${jobs.length} jobs to ${reportOptions.outputPath}`);

    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program.parse(process.argv);

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}