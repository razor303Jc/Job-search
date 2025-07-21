/**
 * Glassdoor Jobs scraper
 * Handles Glassdoor-specific job search and data extraction
 * Note: Glassdoor requires careful handling due to strict anti-bot measures
 */

import { CheerioScraper } from '../cheerio-scraper.js';
import type { JobListing } from '../base-scraper.js';
import type { ScraperConfig } from '@/config/schemas.js';
import type { SiteConfig } from '@/config/sites.js';
import { logger } from '@/utils/logger.js';
import * as cheerio from 'cheerio';

export class GlassdoorScraper extends CheerioScraper {
  constructor(siteConfig: SiteConfig, scraperConfig: ScraperConfig) {
    super(siteConfig, scraperConfig);
  }

  /**
   * Build Glassdoor search URL with parameters
   */
  protected buildSearchUrl(params: Record<string, string>): string {
    const baseUrl = this.siteConfig.baseUrl || 'https://www.glassdoor.com';
    const searchUrl = new URL('/Job/jobs.htm', baseUrl);
    
    // Map parameters to Glassdoor's query format
    const queryParams: Record<string, string> = {};
    
    if (params.keywords || params.q) {
      const keyword = params.keywords || params.q;
      if (keyword) queryParams.sc = keyword; // 'sc' is Glassdoor's keyword parameter
    }
    
    if (params.location || params.l) {
      const loc = params.location || params.l;
      if (loc) queryParams.locT = 'C'; // City type location
      if (loc) queryParams.locId = loc; // Location parameter
    }
    
    if (params.employment_type) {
      queryParams.jobType = this.mapEmploymentType(params.employment_type);
    }
    
    if (params.experience_level) {
      queryParams.seniorityType = this.mapExperienceLevel(params.experience_level);
    }
    
    if (params.company_size) {
      queryParams.companySize = params.company_size;
    }
    
    if (params.remote) {
      if (params.remote === 'true') {
        queryParams.locT = 'N'; // National/Remote
        queryParams.locId = '11047'; // Remote location ID
      }
    }
    
    if (params.salary_min) {
      queryParams.minSalary = params.salary_min;
    }
    
    if (params.salary_max) {
      queryParams.maxSalary = params.salary_max;
    }
    
    if (params.sort) {
      queryParams.sortType = this.mapSortType(params.sort);
    }
    
    if (params.date_posted) {
      queryParams.fromAge = this.mapDatePosted(params.date_posted);
    }
    
    if (params.include_no_salary !== 'true') {
      queryParams.includeNoSalaryJobs = 'false';
    }
    
    // Add query parameters
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) {
        searchUrl.searchParams.set(key, value);
      }
    });
    
    logger.debug({ searchUrl: searchUrl.toString(), params }, 'Built Glassdoor search URL');
    return searchUrl.toString();
  }

  /**
   * Map employment type to Glassdoor's format
   */
  private mapEmploymentType(type: string): string {
    const typeMap: Record<string, string> = {
      'full-time': 'fulltime',
      'part-time': 'parttime',
      'contract': 'contract',
      'temporary': 'temporary',
      'internship': 'internship',
    };
    
    return typeMap[type.toLowerCase()] || type;
  }

  /**
   * Map experience level to Glassdoor's format
   */
  private mapExperienceLevel(level: string): string {
    const levelMap: Record<string, string> = {
      'entry-level': 'ENTRY_LEVEL',
      'mid-level': 'MID_LEVEL',
      'senior': 'SENIOR_LEVEL',
      'executive': 'EXECUTIVE',
      'internship': 'INTERNSHIP',
      'student': 'STUDENT',
    };
    
    return levelMap[level.toLowerCase()] || level;
  }

  /**
   * Map sort type to Glassdoor's format
   */
  private mapSortType(sort: string): string {
    const sortMap: Record<string, string> = {
      'relevance': 'relevance',
      'date': 'date',
      'salary': 'salary',
      'rating': 'rating',
    };
    
    return sortMap[sort.toLowerCase()] || 'relevance';
  }

  /**
   * Map date posted to Glassdoor's format
   */
  private mapDatePosted(date: string): string {
    const dateMap: Record<string, string> = {
      'past-24-hours': '1',
      'past-3-days': '3',
      'past-week': '7',
      'past-2-weeks': '14',
      'past-month': '30',
    };
    
    return dateMap[date.toLowerCase()] || date;
  }

  /**
   * Parse Glassdoor job search results page
   */
  protected override parsePage(html: string, pageUrl: string): JobListing[] {
    const $ = cheerio.load(html);
    const jobs: JobListing[] = [];

    // Glassdoor uses different selectors - try multiple patterns
    const jobSelectors = [
      'li[data-test="jobListing"]',
      '.jobsSearch-SerpJobCard',
      '.react-job-listing',
      '.jobContainer',
      '[data-test="job-listing"]',
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
      logger.warn({ pageUrl }, 'No job elements found on Glassdoor page');
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
          'Failed to parse Glassdoor job element'
        );
      }
    });

    logger.info({ jobCount: jobs.length, pageUrl }, 'Parsed Glassdoor jobs');
    return jobs;
  }

  /**
   * Parse individual job element from Glassdoor
   */
  private parseJobElement(
    $element: cheerio.Cheerio<any>,
    pageUrl: string
  ): JobListing | null {
    try {
      // Extract job ID from data attributes or URL
      const jobId = $element.attr('data-id') ||
                   $element.attr('data-job-id') ||
                   $element.find('a[data-test="job-title"]').attr('href')?.match(/jobListingId=(\d+)/)?.[1] ||
                   $element.find('.jobLink').attr('href')?.match(/jobListingId=(\d+)/)?.[1] ||
                   '';

      if (!jobId) {
        logger.debug('No job ID found, skipping element');
        return null;
      }

      // Extract title and link
      const titleSelectors = [
        'a[data-test="job-title"]',
        '.jobLink',
        '.jobTitle a',
        'h2 a',
        '[data-test="job-link"]',
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
        jobUrl = new URL(jobUrl, 'https://www.glassdoor.com').toString();
      }

      // Extract company name
      const companySelectors = [
        'span[data-test="employer-name"]',
        '.employerName',
        '.companyName a',
        'h3 a',
        '[data-test="employer-link"]',
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
        'div[data-test="job-location"]',
        '.jobLocation',
        '.loc',
        '[data-test="job-location-text"]',
        '.jobsSearch-JobInfoBar-jobLocation',
      ];
      
      let location = '';
      for (const selector of locationSelectors) {
        const locationElement = $element.find(selector).first();
        if (locationElement.length > 0) {
          location = locationElement.text().trim();
          break;
        }
      }

      // Extract salary information (Glassdoor often shows salary estimates)
      const salarySelectors = [
        'span[data-test="detailSalary"]',
        '.salaryText',
        '.jobsSearch-SerpJobCard-salaryEstimate',
        '.css-1h7lukg', // Dynamic class for salary
        '[data-test="salary-text"]',
      ];
      
      let salary = '';
      for (const selector of salarySelectors) {
        const salaryElement = $element.find(selector).first();
        if (salaryElement.length > 0) {
          const salaryText = salaryElement.text().trim();
          if (salaryText.includes('$') || salaryText.includes('€') || salaryText.includes('£') || 
              salaryText.toLowerCase().includes('est') || salaryText.toLowerCase().includes('salary')) {
            salary = salaryText;
            break;
          }
        }
      }

      // Extract job description snippet
      const descriptionSelectors = [
        '[data-test="job-description"]',
        '.jobDescription',
        '.jobsSearch-JobInfoBar-jobDescription',
        '.css-56kyx5', // Dynamic class for description
      ];
      
      let description = '';
      for (const selector of descriptionSelectors) {
        const descElement = $element.find(selector).first();
        if (descElement.length > 0) {
          description = descElement.text().trim();
          break;
        }
      }

      // Extract company rating
      const ratingSelectors = [
        'span[data-test="rating"]',
        '.companyRating',
        '.ratingNumber',
        '[data-test="employer-rating"]',
      ];
      
      let rating = '';
      for (const selector of ratingSelectors) {
        const ratingElement = $element.find(selector).first();
        if (ratingElement.length > 0) {
          const ratingText = ratingElement.text().trim();
          if (ratingText.match(/^\d+\.?\d*$/)) {
            rating = ratingText;
            break;
          }
        }
      }

      // Extract posted date
      const dateSelectors = [
        '[data-test="job-age"]',
        '.jobAge',
        '.postingDate',
        '.css-1h7lukg time',
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
        '[data-test="job-type"]',
        '.jobType',
        '.employmentType',
      ];
      
      let employmentType = '';
      for (const selector of employmentTypeSelectors) {
        const typeElement = $element.find(selector).first();
        if (typeElement.length > 0) {
          employmentType = typeElement.text().trim();
          break;
        }
      }

      // Check for easy apply option
      const hasEasyApply = $element.find('[data-test="easy-apply"], .easyApply').length > 0;

      // Check for sponsored jobs
      const isSponsored = $element.find('[data-test="sponsored"], .sponsoredJob').length > 0;

      const job: JobListing = {
        id: `glassdoor_${jobId}`,
        title: title.replace(/^new\s+/i, '').trim(), // Remove "new" prefix if present
        company: company || 'Unknown Company',
        location: location || 'Location not specified',
        description,
        url: jobUrl || pageUrl,
        source: 'glassdoor',
        raw: {
          html: $element.html(),
          jobId,
          rating,
          hasEasyApply,
          isSponsored,
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

      logger.debug({ jobId, title, company, rating }, 'Parsed Glassdoor job');
      return job;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error parsing Glassdoor job element'
      );
      return null;
    }
  }
}
