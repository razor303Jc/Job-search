import * as cheerio from 'cheerio';
import { BaseScraper } from './base-scraper.js';
import type { JobListing, ScrapeResult, ScraperConfig } from '@/types/index.js';
import { logger } from '@/utils/logger.js';
import { dorksGenerator } from '@/utils/dorks-generator.js';

/**
 * Cheerio-based scraper for static HTML content
 * Ideal for traditional job boards and simple HTML pages
 */
export class CheerioScraper extends BaseScraper {
  constructor(config: ScraperConfig) {
    super(config);
  }

  /**
   * Scrape jobs using search terms
   */
  async scrape(searchTerms: string[], maxResults = 50): Promise<ScrapeResult> {
    this.emit('scraping:start');
    const startTime = Date.now();
    const jobs: JobListing[] = [];
    const errors: any[] = [];

    try {
      // Generate search queries using Google Dorks
      const searchCriteria = {
        keywords: searchTerms,
        maxResults,
      };
      
      const queries = dorksGenerator.generateQueryVariations(searchCriteria);
      logger.info({ queriesCount: queries.length }, 'Generated search queries');

      // Scrape each query
      for (const query of queries.slice(0, 10)) { // Limit queries to avoid rate limiting
        try {
          const searchUrl = this.buildGoogleSearchUrl(query);
          logger.debug({ query, searchUrl }, 'Scraping Google search results');
          
          const searchResults = await this.scrapeGoogleResults(searchUrl);
          
          // Extract job listings from search results
          for (const result of searchResults.slice(0, Math.ceil(maxResults / queries.length))) {
            try {
              const jobListing = await this.scrapeJobPage(result.url, result.source);
              if (jobListing) {
                jobs.push(jobListing);
                
                // Stop if we've reached the max results
                if (jobs.length >= maxResults) {
                  break;
                }
              }
            } catch (error) {
              errors.push({
                type: 'parsing',
                message: error instanceof Error ? error.message : 'Unknown error',
                url: result.url,
                timestamp: new Date(),
              });
              logger.warn({ url: result.url, error }, 'Failed to scrape job page');
            }
          }
          
          if (jobs.length >= maxResults) {
            break;
          }
        } catch (error) {
          errors.push({
            type: 'network',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          });
          logger.warn({ query, error }, 'Failed to scrape search results');
        }
      }

      const duration = Date.now() - startTime;
      const result: ScrapeResult = {
        jobs,
        metadata: {
          totalFound: jobs.length,
          totalScraped: jobs.length,
          successRate: jobs.length > 0 ? 100 : 0,
          duration,
          errors,
          sources: [...new Set(jobs.map(job => job.source.site))],
        },
      };

      this.emit('scraping:complete', result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: ScrapeResult = {
        jobs,
        metadata: {
          totalFound: 0,
          totalScraped: 0,
          successRate: 0,
          duration,
          errors: [
            {
              type: 'unknown',
              message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date(),
            },
          ],
          sources: [],
        },
      };

      this.emit('scraping:complete', result);
      return result;
    }
  }

  /**
   * Build Google search URL with query parameters
   */
  private buildGoogleSearchUrl(query: string): string {
    const baseUrl = 'https://www.google.com/search';
    const params = new URLSearchParams({
      q: query,
      num: '10', // Number of results per page
      hl: 'en', // Language
      safe: 'off', // Safe search
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Scrape Google search results to get job listing URLs
   */
  private async scrapeGoogleResults(searchUrl: string): Promise<Array<{ url: string; title: string; source: string }>> {
    const response = await this.makeRequestWithRetry(searchUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const results: Array<{ url: string; title: string; source: string }> = [];

    // Extract search result links
    $('div[data-ved] h3').each((_, element) => {
      const $element = $(element);
      const $link = $element.parent('a');
      
      if ($link.length > 0) {
        const href = $link.attr('href');
        const title = $element.text().trim();
        
        if (href && title && this.isJobRelatedUrl(href)) {
          const url = this.cleanGoogleUrl(href);
          const source = this.extractDomainName(url);
          
          results.push({ url, title, source });
        }
      }
    });

    logger.debug({ resultsCount: results.length }, 'Extracted search results');
    return results;
  }

  /**
   * Scrape individual job page
   */
  private async scrapeJobPage(url: string, sourceSite: string): Promise<JobListing | null> {
    try {
      const response = await this.makeRequestWithRetry(url);
      const html = await response.text();
      const $ = cheerio.load(html);

      // Use site-specific parsers
      switch (true) {
        case url.includes('linkedin.com'):
          return this.parseLinkedInJob($, url);
        case url.includes('indeed.com'):
          return this.parseIndeedJob($, url);
        case url.includes('glassdoor.com'):
          return this.parseGlassdoorJob($, url);
        default:
          return this.parseGenericJob($, url, sourceSite);
      }
    } catch (error) {
      logger.warn({ url, error }, 'Failed to scrape job page');
      return null;
    }
  }

  /**
   * Parse LinkedIn job page
   */
  private parseLinkedInJob($: cheerio.CheerioAPI, url: string): JobListing | null {
    try {
      const title = $('h1').first().text().trim();
      const company = $('a[data-tracking-control-name="public_jobs_topcard-org-name"]').text().trim() ||
                     $('.topcard__org-name-link').text().trim();
      const location = $('.topcard__flavor--bullet').first().text().trim();
      const description = $('.description__text').text().trim() ||
                         $('[data-section="description"]').text().trim();

      if (!title || !company) {
        return null;
      }

      const salaryText = $('.compensation__salary').text().trim();
      const typeText = $('.description__job-criteria-text').eq(1).text().trim();
      const parsedSalary = this.parseSalary(salaryText);

      const jobListing: JobListing = {
        id: this.generateJobId(title, company, url),
        title,
        company,
        location,
        description,
        url,
        employmentType: this.parseEmploymentType(typeText),
        remote: this.isRemoteJob(location, description),
        requirements: this.extractRequirements(description),
        benefits: this.extractBenefits(description),
        tags: this.extractTags(title, description),
        source: {
          site: 'LinkedIn',
          originalUrl: url,
          scrapedAt: new Date(),
        },
        metadata: {
          confidence: 0.8,
        },
      };

      if (parsedSalary) {
        jobListing.salary = parsedSalary;
      }

      return jobListing;
    } catch (error) {
      logger.warn({ url, error }, 'Failed to parse LinkedIn job');
      return null;
    }
  }

  /**
   * Parse Indeed job page
   */
  private parseIndeedJob($: cheerio.CheerioAPI, url: string): JobListing | null {
    try {
      const title = $('h1[data-testid="jobsearch-JobInfoHeader-title"]').text().trim() ||
                    $('.jobsearch-JobInfoHeader-title').text().trim();
      const company = $('a[data-testid="inlineHeader-companyName"]').text().trim() ||
                     $('.jobsearch-InlineCompanyRating').first().text().trim();
      const location = $('[data-testid="job-location"]').text().trim() ||
                      $('.jobsearch-JobInfoHeader-subtitle').last().text().trim();
      const description = $('#jobDescriptionText').text().trim() ||
                         $('.jobsearch-jobDescriptionText').text().trim();

      if (!title || !company) {
        return null;
      }

      const salaryText = $('.jobsearch-JobMetadataHeader-item').filter((_, el) => 
        $(el).text().includes('$') || $(el).text().includes('£') || $(el).text().includes('€')
      ).text().trim();

      const typeText = $('.jobsearch-JobMetadataHeader-item').filter((_, el) => 
        $(el).text().includes('Full-time') || $(el).text().includes('Part-time') || $(el).text().includes('Contract')
      ).text().trim();

      const parsedSalary = this.parseSalary(salaryText);

      const jobListing: JobListing = {
        id: this.generateJobId(title, company, url),
        title,
        company,
        location,
        description,
        url,
        employmentType: this.parseEmploymentType(typeText),
        remote: this.isRemoteJob(location, description),
        requirements: this.extractRequirements(description),
        benefits: this.extractBenefits(description),
        tags: this.extractTags(title, description),
        source: {
          site: 'Indeed',
          originalUrl: url,
          scrapedAt: new Date(),
        },
        metadata: {
          confidence: 0.8,
        },
      };

      if (parsedSalary) {
        jobListing.salary = parsedSalary;
      }

      return jobListing;
    } catch (error) {
      logger.warn({ url, error }, 'Failed to parse Indeed job');
      return null;
    }
  }

  /**
   * Parse Glassdoor job page
   */
  private parseGlassdoorJob($: cheerio.CheerioAPI, url: string): JobListing | null {
    try {
      const title = $('[data-test="job-title"]').text().trim() ||
                    $('.jobTitle').text().trim();
      const company = $('[data-test="employer-name"]').text().trim() ||
                     $('.employerName').text().trim();
      const location = $('[data-test="job-location"]').text().trim() ||
                      $('.location').text().trim();
      const description = $('[data-test="jobDescriptionContent"]').text().trim() ||
                         $('.jobDescription').text().trim();

      if (!title || !company) {
        return null;
      }

      const salaryText = $('[data-test="detailSalary"]').text().trim();
      const typeText = $('.jobType').text().trim();
      const parsedSalary = this.parseSalary(salaryText);

      const jobListing: JobListing = {
        id: this.generateJobId(title, company, url),
        title,
        company,
        location,
        description,
        url,
        employmentType: this.parseEmploymentType(typeText),
        remote: this.isRemoteJob(location, description),
        requirements: this.extractRequirements(description),
        benefits: this.extractBenefits(description),
        tags: this.extractTags(title, description),
        source: {
          site: 'Glassdoor',
          originalUrl: url,
          scrapedAt: new Date(),
        },
        metadata: {
          confidence: 0.8,
        },
      };

      if (parsedSalary) {
        jobListing.salary = parsedSalary;
      }

      return jobListing;
    } catch (error) {
      logger.warn({ url, error }, 'Failed to parse Glassdoor job');
      return null;
    }
  }

  /**
   * Generic job parser for unknown sites
   */
  private parseGenericJob($: cheerio.CheerioAPI, url: string, sourceSite: string): JobListing | null {
    try {
      // Try common selectors for job information
      const title = $('h1').first().text().trim() ||
                    $('[class*="title"], [class*="job-title"], [id*="title"]').first().text().trim();
      
      const company = $('[class*="company"], [class*="employer"], [id*="company"]').first().text().trim();
      
      const location = $('[class*="location"], [class*="address"], [id*="location"]').first().text().trim();
      
      const description = $('[class*="description"], [class*="job-description"], [id*="description"]').first().text().trim() ||
                         $('main').text().trim();

      if (!title) {
        return null;
      }

      return {
        id: this.generateJobId(title, company || sourceSite, url),
        title,
        company: company || sourceSite,
        location: location || 'Not specified',
        description: description || '',
        url,
        employmentType: 'full-time',
        remote: this.isRemoteJob(location, description),
        requirements: this.extractRequirements(description),
        benefits: this.extractBenefits(description),
        tags: this.extractTags(title, description),
        source: {
          site: sourceSite,
          originalUrl: url,
          scrapedAt: new Date(),
        },
        metadata: {
          confidence: 0.5, // Lower confidence for generic parsing
        },
      };
    } catch (error) {
      logger.warn({ url, error }, 'Failed to parse generic job');
      return null;
    }
  }

  /**
   * Extract requirements from job description
   */
  private extractRequirements(description: string): string[] {
    const requirements: string[] = [];
    const lines = description.split('\n');
    
    let inRequirementsSection = false;
    for (const line of lines) {
      const trimmedLine = line.trim().toLowerCase();
      
      // Detect requirements section
      if (trimmedLine.includes('requirement') || trimmedLine.includes('qualification') || 
          trimmedLine.includes('must have') || trimmedLine.includes('skills')) {
        inRequirementsSection = true;
        continue;
      }
      
      // Stop at benefits or other sections
      if (trimmedLine.includes('benefit') || trimmedLine.includes('offer') || 
          trimmedLine.includes('about us')) {
        inRequirementsSection = false;
      }
      
      // Extract bullet points or numbered items
      if (inRequirementsSection && (line.trim().startsWith('•') || line.trim().startsWith('-') || 
          line.trim().match(/^\d+\./))) {
        requirements.push(line.trim().replace(/^[•\-\d\.]+\s*/, ''));
      }
    }
    
    return requirements.slice(0, 10); // Limit to 10 requirements
  }

  /**
   * Extract benefits from job description
   */
  private extractBenefits(description: string): string[] {
    const benefits: string[] = [];
    const lines = description.split('\n');
    
    let inBenefitsSection = false;
    for (const line of lines) {
      const trimmedLine = line.trim().toLowerCase();
      
      // Detect benefits section
      if (trimmedLine.includes('benefit') || trimmedLine.includes('offer') || 
          trimmedLine.includes('perks') || trimmedLine.includes('compensation')) {
        inBenefitsSection = true;
        continue;
      }
      
      // Stop at other sections
      if (trimmedLine.includes('requirement') || trimmedLine.includes('about us') || 
          trimmedLine.includes('how to apply')) {
        inBenefitsSection = false;
      }
      
      // Extract bullet points or numbered items
      if (inBenefitsSection && (line.trim().startsWith('•') || line.trim().startsWith('-') || 
          line.trim().match(/^\d+\./))) {
        benefits.push(line.trim().replace(/^[•\-\d\.]+\s*/, ''));
      }
    }
    
    return benefits.slice(0, 10); // Limit to 10 benefits
  }

  /**
   * Extract relevant tags from title and description
   */
  private extractTags(title: string, description: string): string[] {
    const techKeywords = [
      'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue',
      'node.js', 'express', 'mongodb', 'postgresql', 'aws', 'docker', 'kubernetes',
      'git', 'agile', 'scrum', 'rest', 'api', 'microservices', 'devops',
    ];
    
    const text = `${title} ${description}`.toLowerCase();
    const tags = techKeywords.filter(keyword => text.includes(keyword));
    
    return tags.slice(0, 8); // Limit to 8 tags
  }

  /**
   * Check if URL is job-related
   */
  private isJobRelatedUrl(url: string): boolean {
    const jobKeywords = ['job', 'career', 'position', 'opening', 'vacancy', 'employment'];
    const lowerUrl = url.toLowerCase();
    
    return jobKeywords.some(keyword => lowerUrl.includes(keyword)) ||
           lowerUrl.includes('linkedin.com/jobs') ||
           lowerUrl.includes('indeed.com') ||
           lowerUrl.includes('glassdoor.com');
  }

  /**
   * Clean Google redirect URLs
   */
  private cleanGoogleUrl(url: string): string {
    if (url.startsWith('/url?')) {
      const urlParams = new URLSearchParams(url.substring(5));
      return urlParams.get('url') || url;
    }
    return url;
  }

  /**
   * Extract domain name from URL
   */
  private extractDomainName(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }
}