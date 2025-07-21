import { transformRawToJob } from '@/parsers/schemas/job.schema.js';
import type { JobListing, JobSearchCriteria, ScrapeResult, ScraperConfig } from '@/types/index.js';
import { createTimer, logger } from '@/utils/logger.js';
import { HybridScraper } from '../hybrid-scraper.js';
import type { JobSelectors } from '../playwright-scraper.js';

/**
 * LinkedIn Jobs scraper implementation
 * Note: LinkedIn requires careful handling due to anti-bot measures
 */
export class LinkedInScraper extends HybridScraper {
  private readonly baseUrl = 'https://www.linkedin.com';

  constructor(config: ScraperConfig) {
    super({
      ...config,
      preferStatic: false, // LinkedIn requires dynamic scraping
      fallbackToDynamic: true,
      jsDetectionTimeout: 5000,
    });
  }

  /**
   * Build LinkedIn jobs search URL
   */
  private buildSearchUrl(criteria: JobSearchCriteria): string {
    const params = new URLSearchParams();

    // Keywords
    if (criteria.keywords.length > 0) {
      params.set('keywords', criteria.keywords.join(' '));
    }

    // Location
    if (criteria.location) {
      params.set('location', criteria.location);
    }

    // Date posted
    if (criteria.datePosted) {
      const dateMap = {
        today: 'r86400',
        week: 'r604800',
        month: 'r2592000',
      };
      if (dateMap[criteria.datePosted]) {
        params.set('f_TPR', dateMap[criteria.datePosted]);
      }
    }

    // Employment type
    if (criteria.employmentTypes && criteria.employmentTypes.length > 0) {
      const typeMap = {
        'full-time': 'F',
        'part-time': 'P',
        contract: 'C',
        temporary: 'T',
        internship: 'I',
        freelance: 'O',
      };

      const linkedinTypes = criteria.employmentTypes.map((type) => typeMap[type]).filter(Boolean);

      if (linkedinTypes.length > 0) {
        params.set('f_JT', linkedinTypes.join(','));
      }
    }

    // Remote jobs
    if (criteria.remote) {
      params.set('f_WT', '2'); // Remote
    }

    // Experience level
    if (criteria.experienceLevel) {
      const levelMap = {
        entry: '1',
        mid: '2',
        senior: '3',
        executive: '4',
      };
      if (levelMap[criteria.experienceLevel]) {
        params.set('f_E', levelMap[criteria.experienceLevel]);
      }
    }

    // Sort by date
    params.set('sortBy', 'DD');

    return `${this.baseUrl}/jobs/search?${params.toString()}`;
  }

  /**
   * Get LinkedIn job selectors
   */
  private getSelectors(): JobSelectors {
    return {
      jobContainer: '.jobs-search__results-list li, .scaffold-layout__list-container li',
      title: '.base-search-card__title, .job-card-list__title',
      company: '.base-search-card__subtitle, .job-card-container__company-name',
      location: '.job-search-card__location, .job-card-container__metadata-item',
      link: '.base-card__full-link, .job-card-list__title-link',
      description: '.job-search-card__snippet, .job-card-container__job-insight',
      salary: '.job-search-card__salary-info',
      postedDate: '.job-search-card__listdate, .job-card-container__listed-time',
      employmentType: '.job-search-card__job-type',
    };
  }

  /**
   * Extract additional LinkedIn-specific data
   */
  private enhanceJobData(job: Partial<JobListing>): Partial<JobListing> {
    // Extract job ID from LinkedIn URL
    if (job.url) {
      const jobIdMatch = job.url.match(/jobs\/view\/(\d+)/);
      if (jobIdMatch) {
        job.id = `linkedin_${jobIdMatch[1]}`;
      }
    }

    // LinkedIn-specific remote detection
    if (job.location) {
      const isRemote = /remote|worldwide|global/i.test(job.location);
      job.remote = isRemote;
    }

    // Parse LinkedIn date format
    if (job.metadata?.postedDateText) {
      const dateText = job.metadata.postedDateText.toLowerCase();
      if (dateText.includes('hour')) {
        job.postedDate = new Date(Date.now() - 60 * 60 * 1000);
      } else if (dateText.includes('day')) {
        const days = Number.parseInt(dateText) || 1;
        job.postedDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      } else if (dateText.includes('week')) {
        const weeks = Number.parseInt(dateText) || 1;
        job.postedDate = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
      }
    }

    return job;
  }

  /**
   * Handle LinkedIn's authentication and rate limiting
   */
  private async handleLinkedInChallenges(): Promise<void> {
    // LinkedIn often requires more careful handling
    // Add random delays to appear more human-like
    const delay = 2000 + Math.random() * 3000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Scrape jobs from LinkedIn
   */
  async scrape(searchTerms: string[], maxResults = 50): Promise<ScrapeResult> {
    const timer = createTimer();
    this.emit('scraping:start');

    try {
      await this.handleLinkedInChallenges();

      const criteria: JobSearchCriteria = {
        keywords: searchTerms,
        maxResults,
      };

      const searchUrl = this.buildSearchUrl(criteria);
      logger.info({ url: searchUrl }, 'Starting LinkedIn job search');

      const selectors = this.getSelectors();
      const allJobs: Partial<JobListing>[] = [];
      let currentUrl = searchUrl;
      let page = 0;
      const maxPages = Math.ceil(maxResults / 25); // LinkedIn shows ~25 jobs per page

      while (allJobs.length < maxResults && page < maxPages) {
        try {
          logger.debug({ page: page + 1, url: currentUrl }, 'Scraping LinkedIn page');

          await this.handleLinkedInChallenges();

          const jobs = await this.scrapeJobs(currentUrl, selectors, maxResults - allJobs.length);

          if (jobs.length === 0) {
            logger.info({ page: page + 1 }, 'No more jobs found, stopping pagination');
            break;
          }

          // Enhance jobs with LinkedIn-specific data
          const enhancedJobs = jobs.map((job) => this.enhanceJobData(job));
          allJobs.push(...enhancedJobs);

          // Get next page URL (LinkedIn uses start parameter)
          if (page < maxPages - 1 && allJobs.length < maxResults) {
            const nextPageStart = (page + 1) * 25;
            const url = new URL(currentUrl);
            url.searchParams.set('start', nextPageStart.toString());
            currentUrl = url.toString();
          }

          page++;

          // Longer delays for LinkedIn to avoid being blocked
          await new Promise((resolve) => setTimeout(resolve, 3000 + Math.random() * 5000));
        } catch (error) {
          logger.error(
            {
              page: page + 1,
              url: currentUrl,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            'Error scraping LinkedIn page',
          );

          // If we hit a rate limit or block, wait longer and continue
          if (error instanceof Error && error.message.includes('429')) {
            logger.warn('LinkedIn rate limit detected, waiting before retry');
            await new Promise((resolve) => setTimeout(resolve, 30000));
            continue;
          }

          break;
        }
      }

      // Transform raw data to proper job listings
      const jobListings: JobListing[] = allJobs
        .slice(0, maxResults)
        .map((job) => {
          try {
            const source = {
              site: 'linkedin.com',
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
        successRate: this.getMetrics().playwright.successRate,
        duration: timer.elapsed(),
        errors: 0,
      });

      logger.info(
        {
          jobsFound: jobListings.length,
          pagesScraped: page,
          duration: timer.elapsed(),
        },
        'LinkedIn scraping completed',
      );

      return {
        jobs: jobListings,
        metadata: {
          totalFound: jobListings.length,
          totalScraped: allJobs.length,
          successRate: this.getMetrics().playwright.successRate,
          duration: timer.elapsed(),
          errors: [],
          sources: ['linkedin.com'],
        },
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'LinkedIn scraping failed',
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
   * Get job details from LinkedIn job URL
   */
  async getJobDetails(jobUrl: string): Promise<Partial<JobListing> | null> {
    try {
      logger.debug({ url: jobUrl }, 'Fetching LinkedIn job details');

      await this.handleLinkedInChallenges();

      const selectors: JobSelectors = {
        jobContainer: '.jobs-unified-top-card, .job-view-layout',
        title: '.jobs-unified-top-card__job-title, .job-view-layout__title',
        company: '.jobs-unified-top-card__company-name, .job-view-layout__company-name',
        location: '.jobs-unified-top-card__bullet, .job-view-layout__location',
        link: '',
        description: '.jobs-description-content__text, .job-view-layout__description',
        salary: '.jobs-unified-top-card__job-insight .jobs-unified-top-card__job-insight-text',
        employmentType: '.jobs-unified-top-card__job-insight--job-type',
      };

      const jobs = await this.scrapeJobs(jobUrl, selectors, 1);
      return jobs.length > 0 ? this.enhanceJobData(jobs[0]) : null;
    } catch (error) {
      logger.error(
        { url: jobUrl, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to get LinkedIn job details',
      );
      return null;
    }
  }
}
