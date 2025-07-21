import { logger } from '@/utils/logger.js';
import * as cheerio from 'cheerio';
import type { JobListing } from '../base-scraper.js';
import { CheerioScraper } from '../cheerio-scraper.js';

export class IndeedScraper extends CheerioScraper {
  /**
   * Build Indeed search URL with parameters
   */
  protected buildSearchUrl(params: Record<string, string>): string {
    const baseUrl = this.siteConfig.baseUrl || 'https://www.indeed.com';
    const searchUrl = new URL('/jobs', baseUrl);

    // Map parameters to Indeed's query format
    const queryParams: Record<string, string> = {};

    if (params.keywords || params.q) {
      const keyword = params.keywords || params.q;
      if (keyword) queryParams.q = keyword;
    }

    if (params.location || params.l) {
      const loc = params.location || params.l;
      if (loc) queryParams.l = loc;
    }

    if (params.radius) {
      queryParams.radius = params.radius;
    }

    if (params.employment_type) {
      queryParams.jt = this.mapEmploymentType(params.employment_type);
    }

    if (params.salary) {
      queryParams.salary = params.salary;
    }

    if (params.remote) {
      queryParams.remotejob = params.remote === 'true' ? '1' : '0';
    }

    if (params.sort) {
      queryParams.sort = params.sort; // date, relevance
    }

    // Add query parameters
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) {
        searchUrl.searchParams.set(key, value);
      }
    });

    logger.debug({ searchUrl: searchUrl.toString(), params }, 'Built Indeed search URL');
    return searchUrl.toString();
  }

  /**
   * Map employment type to Indeed's format
   */
  private mapEmploymentType(type: string): string {
    const typeMap: Record<string, string> = {
      'full-time': 'fulltime',
      'part-time': 'parttime',
      contract: 'contract',
      temporary: 'temporary',
      internship: 'internship',
    };

    return typeMap[type.toLowerCase()] || type;
  }

  /**
   * Parse Indeed job search results page
   */
  protected override parsePage(html: string, pageUrl: string): JobListing[] {
    const $ = cheerio.load(html);
    const jobs: JobListing[] = [];

    // Indeed uses various selectors - try multiple patterns
    const jobSelectors = [
      '[data-jk]', // Primary job container
      '.job_seen_beacon',
      '.jobsearch-result',
      '.slider_container .slider_item',
    ];

    let jobElements: cheerio.Cheerio<any> | null = null;

    for (const selector of jobSelectors) {
      jobElements = $(selector);
      if (jobElements.length > 0) {
        logger.debug({ selector, count: jobElements.length }, 'Found jobs using selector');
        break;
      }
    }

    if (!jobElements || jobElements.length === 0) {
      logger.warn({ pageUrl }, 'No job elements found on Indeed page');
      return jobs;
    }

    jobElements.each((index, element) => {
      try {
        const job = this.parseJobElement($(element), pageUrl);
        if (job) {
          jobs.push(job);
        }
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error), index },
          'Failed to parse Indeed job element',
        );
      }
    });

    logger.info({ jobCount: jobs.length, pageUrl }, 'Parsed Indeed jobs');
    return jobs;
  }

  /**
   * Parse individual job element from Indeed
   */
  private parseJobElement($element: cheerio.Cheerio<any>, pageUrl: string): JobListing | null {
    try {
      // Extract job ID
      const jobId =
        $element.attr('data-jk') ||
        $element.find('[data-jk]').attr('data-jk') ||
        $element.find('a[id^="job_"]').attr('id')?.replace('job_', '') ||
        '';

      if (!jobId) {
        logger.debug('No job ID found, skipping element');
        return null;
      }

      // Extract title and link
      const titleSelectors = [
        'h2.jobTitle a[data-jk] span[title]',
        'h2.jobTitle a span[title]',
        '.jobTitle a span',
        'h2 a span',
        '.jobTitle span',
      ];

      let title = '';
      let jobUrl = '';

      for (const selector of titleSelectors) {
        const titleElement = $element.find(selector).first();
        if (titleElement.length > 0) {
          title = titleElement.attr('title') || titleElement.text().trim();
          jobUrl = titleElement.closest('a').attr('href') || '';
          break;
        }
      }

      if (!title) {
        logger.debug({ jobId }, 'No title found for job');
        return null;
      }

      // Build absolute URL
      if (jobUrl && !jobUrl.startsWith('http')) {
        jobUrl = new URL(jobUrl, 'https://www.indeed.com').toString();
      }

      // Extract company name
      const companySelectors = [
        '[data-testid="company-name"]',
        '.companyName a',
        '.companyName span',
        'span.companyName',
        '[data-testid="company-name"] a',
      ];

      let company = '';
      for (const selector of companySelectors) {
        const companyElement = $element.find(selector).first();
        if (companyElement.length > 0) {
          company = companyElement.text().trim();
          break;
        }
      }

      // Extract location
      const locationSelectors = [
        '[data-testid="job-location"]',
        '.companyLocation',
        '.locationsContainer',
        'div[data-testid="job-location"]',
      ];

      let location = '';
      for (const selector of locationSelectors) {
        const locationElement = $element.find(selector).first();
        if (locationElement.length > 0) {
          location = locationElement.text().trim();
          break;
        }
      }

      // Extract salary
      const salarySelectors = [
        '[data-testid="attribute_snippet_testid"]',
        '.salary-snippet',
        '.salaryText',
        '.estimated-salary',
      ];

      let salary = '';
      for (const selector of salarySelectors) {
        const salaryElement = $element.find(selector).first();
        if (salaryElement.length > 0) {
          const salaryText = salaryElement.text().trim();
          if (salaryText.includes('$') || salaryText.includes('€') || salaryText.includes('£')) {
            salary = salaryText;
            break;
          }
        }
      }

      // Extract job snippet/description
      const descriptionSelectors = [
        '[data-testid="job-snippet"]',
        '.job-snippet',
        '.summary',
        'div.job-snippet',
      ];

      let description = '';
      for (const selector of descriptionSelectors) {
        const descElement = $element.find(selector).first();
        if (descElement.length > 0) {
          description = descElement.text().trim();
          break;
        }
      }

      // Extract posted date
      const dateSelectors = [
        '[data-testid="myJobsStateDate"]',
        '.date',
        'span.date',
        '.posted-date',
      ];

      let postedDate = '';
      for (const selector of dateSelectors) {
        const dateElement = $element.find(selector).first();
        if (dateElement.length > 0) {
          postedDate = dateElement.text().trim();
          break;
        }
      }

      // Check for sponsored/promoted jobs
      const isSponsored =
        $element.find('.ppsLabel, .sponsoredJob, [data-testid="sponsored-label"]').length > 0;

      const job: JobListing = {
        id: `indeed_${jobId}`,
        title: title.replace(/^new\s+/i, '').trim(), // Remove "new" prefix
        company: company || 'Unknown Company',
        location: location || 'Location not specified',
        description,
        url: jobUrl || pageUrl,
        source: 'indeed',
        raw: {
          html: $element.html(),
          jobId,
          isSponsored,
          pageUrl,
        },
        metadata: {
          scrapedAt: new Date(),
          confidence: title && company ? 0.8 : 0.5,
          hasDetails: Boolean(description && description.length > 50),
        },
      };

      // Add optional fields only if they have values
      if (salary) {
        job.salary = salary;
      }
      if (postedDate) {
        job.postedDate = postedDate;
      }

      logger.debug({ jobId, title, company }, 'Parsed Indeed job');
      return job;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error parsing Indeed job element',
      );
      return null;
    }
  }
}
