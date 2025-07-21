import { transformRawToJob } from '@/parsers/schemas/job.schema.js';
import type { JobListing, JobSearchCriteria, ScrapeResult, ScraperConfig } from '@/types/index.js';
import { createTimer, logger } from '@/utils/logger.js';
import { HybridScraper } from '../hybrid-scraper.js';
import type { JobSelectors } from '../playwright-scraper.js';

/**
 * Indeed.com scraper implementation
 */
export class IndeedScraper extends HybridScraper {
  private readonly baseUrl = 'https://www.indeed.com';

  constructor(config: ScraperConfig) {
    super({
      ...config,
      preferStatic: true, // Indeed works well with static scraping
      fallbackToDynamic: true,
    });
  }

  /**
   * Build Indeed search URL
   */
  private buildSearchUrl(criteria: JobSearchCriteria): string {
    const params = new URLSearchParams();

    // Keywords
    if (criteria.keywords.length > 0) {
      params.set('q', criteria.keywords.join(' '));
    }

    // Location
    if (criteria.location) {
      params.set('l', criteria.location);
    }

    // Remote jobs
    if (criteria.remote) {
      params.set('remotejob', '032b3046-06a3-4876-8dfd-474eb5e7ed11');
    }

    // Date posted
    if (criteria.datePosted) {
      const dateMap = {
        today: '1',
        week: '7',
        month: '30',
      };
      if (dateMap[criteria.datePosted]) {
        params.set('fromage', dateMap[criteria.datePosted]);
      }
    }

    // Employment type
    if (criteria.employmentTypes && criteria.employmentTypes.length > 0) {
      const typeMap = {
        'full-time': 'fulltime',
        'part-time': 'parttime',
        contract: 'contract',
        temporary: 'temporary',
        internship: 'internship',
      };

      const indeedTypes = criteria.employmentTypes.map((type) => typeMap[type]).filter(Boolean);

      if (indeedTypes.length > 0) {
        params.set('jt', indeedTypes.join(','));
      }
    }

    // Salary
    if (criteria.salaryMin) {
      params.set('salary', criteria.salaryMin.toString());
    }

    // Sort by date
    params.set('sort', 'date');

    // Results per page
    params.set('limit', '50');

    return `${this.baseUrl}/jobs?${params.toString()}`;
  }

  /**
   * Get Indeed job selectors
   */
  private getSelectors(): JobSelectors {
    return {
      jobContainer: '[data-jk], .slider_container .slider_item, .job_seen_beacon',
      title: '[data-testid="job-title"] a, .jobTitle a, h2.jobTitle a',
      company: '[data-testid="company-name"], .companyName, span.companyName',
      location: '[data-testid="job-location"], .companyLocation, .locationsContainer',
      link: '[data-testid="job-title"] a, .jobTitle a, h2.jobTitle a',
      description: '.job-snippet, .summary',
      salary: '.salary-snippet, .salaryText',
      postedDate: '.date, .dateContainer',
      employmentType: '.jobTypeLabel',
    };
  }

  /**
   * Extract additional Indeed-specific data
   */
  private enhanceJobData(job: Partial<JobListing>): Partial<JobListing> {
    // Extract job ID from URL if available
    if (job.url) {
      const jkMatch = job.url.match(/jk=([a-f0-9]+)/);
      if (jkMatch) {
        job.id = `indeed_${jkMatch[1]}`;
      }
    }

    // Determine if remote based on location
    if (job.location) {
      const isRemote = /remote|work from home|wfh/i.test(job.location);
      job.remote = isRemote;
    }

    // Parse employment type from Indeed's format
    if (job.metadata?.employmentTypeText) {
      const typeText = job.metadata.employmentTypeText.toLowerCase();
      if (typeText.includes('full')) job.employmentType = 'full-time';
      else if (typeText.includes('part')) job.employmentType = 'part-time';
      else if (typeText.includes('contract')) job.employmentType = 'contract';
      else if (typeText.includes('temporary')) job.employmentType = 'temporary';
      else if (typeText.includes('intern')) job.employmentType = 'internship';
    }

    return job;
  }

  /**
   * Scrape jobs from Indeed
   */
  async scrape(searchTerms: string[], maxResults = 50): Promise<ScrapeResult> {
    const timer = createTimer();
    this.emit('scraping:start');

    try {
      const criteria: JobSearchCriteria = {
        keywords: searchTerms,
        maxResults,
      };

      const searchUrl = this.buildSearchUrl(criteria);
      logger.info({ url: searchUrl }, 'Starting Indeed job search');

      const selectors = this.getSelectors();
      const allJobs: Partial<JobListing>[] = [];
      let currentUrl = searchUrl;
      let page = 0;
      const maxPages = Math.ceil(maxResults / 50);

      while (allJobs.length < maxResults && page < maxPages) {
        try {
          logger.debug({ page: page + 1, url: currentUrl }, 'Scraping Indeed page');

          const jobs = await this.scrapeJobs(currentUrl, selectors, maxResults - allJobs.length);

          if (jobs.length === 0) {
            logger.info({ page: page + 1 }, 'No more jobs found, stopping pagination');
            break;
          }

          // Enhance jobs with Indeed-specific data
          const enhancedJobs = jobs.map((job) => this.enhanceJobData(job));
          allJobs.push(...enhancedJobs);

          // Get next page URL
          if (page < maxPages - 1 && allJobs.length < maxResults) {
            const nextPageStart = (page + 1) * 50;
            const url = new URL(currentUrl);
            url.searchParams.set('start', nextPageStart.toString());
            currentUrl = url.toString();
          }

          page++;

          // Rate limiting between pages
          await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));
        } catch (error) {
          logger.error(
            {
              page: page + 1,
              url: currentUrl,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            'Error scraping Indeed page',
          );
          break;
        }
      }

      // Transform raw data to proper job listings
      const jobListings: JobListing[] = allJobs
        .slice(0, maxResults)
        .map((job) => {
          try {
            const source = {
              site: 'indeed.com',
              originalUrl: job.source?.originalUrl || searchUrl,
              scrapedAt: new Date(),
            };

            return transformRawToJob(
              {
                title: job.title,
                company: job.company,
                location: job.location,
                description: job.description,
                url: job.url,
                salaryText: job.metadata?.salaryText as string,
                employmentTypeText: job.metadata?.employmentTypeText as string,
                postedDateText: job.metadata?.postedDateText as string,
              },
              source,
            ) as JobListing;
          } catch (error) {
            logger.warn(
              { job, error: error instanceof Error ? error.message : 'Unknown error' },
              'Failed to transform job data',
            );
            return null;
          }
        })
        .filter((job): job is JobListing => job !== null);

      this.emit('scraping:complete', {
        jobsFound: jobListings.length,
        totalScraped: allJobs.length,
        successRate: this.getMetrics().cheerio.successRate,
        duration: timer.elapsed(),
        errors: 0,
      });

      logger.info(
        {
          jobsFound: jobListings.length,
          pagesScraped: page,
          duration: timer.elapsed(),
        },
        'Indeed scraping completed',
      );

      return {
        jobs: jobListings,
        metadata: {
          totalFound: jobListings.length,
          totalScraped: allJobs.length,
          successRate: this.getMetrics().cheerio.successRate,
          duration: timer.elapsed(),
          errors: [],
          sources: ['indeed.com'],
        },
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Indeed scraping failed',
      );
      throw error;
    }
  }

  /**
   * Search jobs with specific criteria
   */
  async searchWithCriteria(criteria: JobSearchCriteria): Promise<ScrapeResult> {
    return this.scrape(criteria.keywords, criteria.maxResults);
  }

  /**
   * Get job details from Indeed job URL
   */
  async getJobDetails(jobUrl: string): Promise<Partial<JobListing> | null> {
    try {
      logger.debug({ url: jobUrl }, 'Fetching Indeed job details');

      const selectors: JobSelectors = {
        jobContainer: '.jobsearch-ViewJobLayout, .jobsearch-JobComponent',
        title: '[data-testid="job-title"], .jobsearch-JobInfoHeader-title',
        company: '[data-testid="inlineHeader-companyName"], .jobsearch-InlineCompanyRating',
        location: '[data-testid="job-location"], .jobsearch-JobMetadataHeader-iconLabel',
        link: '',
        description: '.jobsearch-jobDescriptionText, #jobDescriptionText',
        salary: '.icl-u-xs-mr--xs .attribute_snippet',
        employmentType: '.jobsearch-JobMetadataHeader .attribute_snippet',
      };

      const jobs = await this.scrapeJobs(jobUrl, selectors, 1);
      return jobs.length > 0 ? this.enhanceJobData(jobs[0]) : null;
    } catch (error) {
      logger.error(
        { url: jobUrl, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to get Indeed job details',
      );
      return null;
    }
  }
}
