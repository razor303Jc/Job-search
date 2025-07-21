/**
 * LinkedIn Jobs scraper
 * Handles LinkedIn-specific job search and data extraction
 * Note: LinkedIn has strict rate limiting and anti-bot measures
 */

import { logger } from '@/utils/logger.js';
import * as cheerio from 'cheerio';
import type { JobListing } from '../base-scraper.js';
import { CheerioScraper } from '../cheerio-scraper.js';

export class LinkedInScraper extends CheerioScraper {
  /**
   * Build LinkedIn search URL with parameters
   */
  protected buildSearchUrl(params: Record<string, string>): string {
    const baseUrl = this.siteConfig.baseUrl || 'https://www.linkedin.com';
    const searchUrl = new URL('/jobs/search', baseUrl);

    // Map parameters to LinkedIn's query format
    const queryParams: Record<string, string> = {};

    if (params.keywords || params.q) {
      const keyword = params.keywords || params.q;
      if (keyword) queryParams.keywords = keyword;
    }

    if (params.location || params.l) {
      const loc = params.location || params.l;
      if (loc) queryParams.location = loc;
    }

    if (params.distance) {
      queryParams.distance = params.distance; // 10, 25, 50, 100 km
    }

    if (params.employment_type) {
      queryParams.f_JT = this.mapEmploymentType(params.employment_type);
    }

    if (params.experience_level) {
      queryParams.f_E = this.mapExperienceLevel(params.experience_level);
    }

    if (params.company_size) {
      queryParams.f_C = params.company_size; // 1, 2, 3, 4, 5, 6
    }

    if (params.remote) {
      queryParams.f_WT = params.remote === 'true' ? '2' : '1'; // 1=on-site, 2=remote, 3=hybrid
    }

    if (params.sort) {
      queryParams.sortBy = params.sort; // DD (date), R (relevance)
    }

    if (params.date_posted) {
      queryParams.f_TPR = this.mapDatePosted(params.date_posted);
    }

    // Add query parameters
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) {
        searchUrl.searchParams.set(key, value);
      }
    });

    logger.debug({ searchUrl: searchUrl.toString(), params }, 'Built LinkedIn search URL');
    return searchUrl.toString();
  }

  /**
   * Map employment type to LinkedIn's format
   */
  private mapEmploymentType(type: string): string {
    const typeMap: Record<string, string> = {
      'full-time': 'F',
      'part-time': 'P',
      contract: 'C',
      temporary: 'T',
      volunteer: 'V',
      internship: 'I',
      other: 'O',
    };

    return typeMap[type.toLowerCase()] || type;
  }

  /**
   * Map experience level to LinkedIn's format
   */
  private mapExperienceLevel(level: string): string {
    const levelMap: Record<string, string> = {
      internship: '1',
      'entry-level': '2',
      associate: '3',
      'mid-senior': '4',
      director: '5',
      executive: '6',
    };

    return levelMap[level.toLowerCase()] || level;
  }

  /**
   * Map date posted to LinkedIn's format
   */
  private mapDatePosted(date: string): string {
    const dateMap: Record<string, string> = {
      'past-24-hours': 'r86400',
      'past-week': 'r604800',
      'past-month': 'r2592000',
    };

    return dateMap[date.toLowerCase()] || date;
  }

  /**
   * Parse LinkedIn job search results page
   */
  protected override parsePage(html: string, pageUrl: string): JobListing[] {
    const $ = cheerio.load(html);
    const jobs: JobListing[] = [];

    // LinkedIn uses various selectors - try multiple patterns
    const jobSelectors = [
      '.jobs-search__results-list li',
      '[data-entity-urn*="jobPosting"]',
      '.job-search-card',
      '.jobs-search-results__list-item',
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
      logger.warn({ pageUrl }, 'No job elements found on LinkedIn page');
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
          'Failed to parse LinkedIn job element',
        );
      }
    });

    logger.info({ jobCount: jobs.length, pageUrl }, 'Parsed LinkedIn jobs');
    return jobs;
  }

  /**
   * Parse individual job element from LinkedIn
   */
  private parseJobElement($element: cheerio.Cheerio<any>, pageUrl: string): JobListing | null {
    try {
      // Extract job ID from data attributes or URL
      const jobId =
        $element.attr('data-entity-urn')?.split(':').pop() ||
        $element
          .find('a[data-control-name="job_search_job_result_title"]')
          .attr('href')
          ?.match(/\/view\/(\d+)/)?.[1] ||
        $element
          .find('.job-search-card__title-link')
          .attr('href')
          ?.match(/\/view\/(\d+)/)?.[1] ||
        '';

      if (!jobId) {
        logger.debug('No job ID found, skipping element');
        return null;
      }

      // Extract title and link
      const titleSelectors = [
        '.job-search-card__title-link',
        'a[data-control-name="job_search_job_result_title"]',
        '.jobs-search-results__list-item-title',
        'h3 a',
        '.job-search-card__title',
      ];

      let title = '';
      let jobUrl = '';

      for (const selector of titleSelectors) {
        const titleElement = $element.find(selector).first();
        if (titleElement.length > 0) {
          title = titleElement.text().trim();
          jobUrl = titleElement.attr('href') || '';
          break;
        }
      }

      if (!title) {
        logger.debug({ jobId }, 'No title found for job');
        return null;
      }

      // Build absolute URL
      if (jobUrl && !jobUrl.startsWith('http')) {
        jobUrl = new URL(jobUrl, 'https://www.linkedin.com').toString();
      }

      // Extract company name
      const companySelectors = [
        '.job-search-card__subtitle-link',
        'a[data-control-name="job_search_job_result_company_name"]',
        '.jobs-search-results__list-item-subtitle',
        'h4 a',
        '.job-search-card__subtitle',
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
        '.job-search-card__location',
        '[data-test-id="job-location"]',
        '.jobs-search-results__list-item-location',
        '.job-result-card__location',
      ];

      let location = '';
      for (const selector of locationSelectors) {
        const locationElement = $element.find(selector).first();
        if (locationElement.length > 0) {
          location = locationElement.text().trim();
          break;
        }
      }

      // Extract salary (LinkedIn sometimes shows salary)
      const salarySelectors = [
        '.job-search-card__salary-info',
        '.jobs-unified-top-card__salary',
        '.job-result-card__salary-info',
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
        '.job-search-card__snippet',
        '.jobs-search-results__list-item-description',
        '.job-result-card__snippet',
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
        '.job-search-card__listdate',
        '.jobs-search-results__list-item-date',
        'time[datetime]',
        '.job-result-card__listdate',
      ];

      let postedDate = '';
      for (const selector of dateSelectors) {
        const dateElement = $element.find(selector).first();
        if (dateElement.length > 0) {
          postedDate = dateElement.attr('datetime') || dateElement.text().trim();
          break;
        }
      }

      // Extract employment type
      const employmentTypeSelectors = [
        '.job-search-card__job-type',
        '.jobs-search-results__list-item-job-type',
        '.job-result-card__job-type',
      ];

      let employmentType = '';
      for (const selector of employmentTypeSelectors) {
        const typeElement = $element.find(selector).first();
        if (typeElement.length > 0) {
          employmentType = typeElement.text().trim();
          break;
        }
      }

      // Check for promoted/sponsored jobs
      const isPromoted =
        $element.find('.job-search-card__easy-apply-label, [data-test-promoted]').length > 0;

      const job: JobListing = {
        id: `linkedin_${jobId}`,
        title: title.replace(/^new\s+/i, '').trim(), // Remove "new" prefix if present
        company: company || 'Unknown Company',
        location: location || 'Location not specified',
        description,
        url: jobUrl || pageUrl,
        source: 'linkedin',
        raw: {
          html: $element.html(),
          jobId,
          isPromoted,
          employmentType,
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

      logger.debug({ jobId, title, company }, 'Parsed LinkedIn job');
      return job;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error parsing LinkedIn job element',
      );
      return null;
    }
  }
}
