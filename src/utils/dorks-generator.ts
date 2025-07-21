import type { JobSearchCriteria, GoogleDorkConfig } from '@/types/index.js';
import { logger } from './logger.js';

/**
 * Google Dorks Generator for intelligent job search queries
 * Generates targeted search queries for different job boards and sites
 */
export class DorksGenerator {
  private readonly jobSites = [
    'linkedin.com/jobs',
    'indeed.com',
    'glassdoor.com',
    'stackoverflow.com/jobs',
    'angel.co',
    'remote.co',
    'weworkremotely.com',
    'flexjobs.com',
    'upwork.com',
    'freelancer.com',
  ];

  /**
   * Generate Google Dork queries based on search criteria
   */
  generateDorks(criteria: JobSearchCriteria): GoogleDorkConfig[] {
    const dorks: GoogleDorkConfig[] = [];
    
    // Generate site-specific dorks
    for (const site of this.jobSites) {
      const config = this.generateSiteDork(site, criteria);
      if (config) {
        dorks.push(config);
      }
    }

    // Generate file-type specific searches for company career pages
    if (criteria.keywords.length > 0) {
      dorks.push(this.generateFileTypeDork(criteria));
      dorks.push(this.generateCareerPageDork(criteria));
    }

    logger.debug({ dorksCount: dorks.length, criteria }, 'Generated Google Dorks');
    return dorks;
  }

  /**
   * Generate a dork for a specific job site
   */
  private generateSiteDork(site: string, criteria: JobSearchCriteria): GoogleDorkConfig | null {
    if (criteria.keywords.length === 0) return null;

    const config: GoogleDorkConfig = {
      site,
      keywords: criteria.keywords,
      excludeKeywords: criteria.excludeKeywords || [],
    };

    // Add location-specific parameters
    if (criteria.location && !criteria.remote) {
      config.customParams = {
        location: criteria.location,
      };
    }

    // Add remote-specific keywords
    if (criteria.remote) {
      config.keywords.push('remote', 'work from home');
    }

    // Add salary-related keywords if specified
    if (criteria.salaryMin) {
      config.keywords.push(`salary:>${criteria.salaryMin}`);
    }

    // Add experience level keywords
    if (criteria.experienceLevel) {
      const levelKeywords = this.getExperienceLevelKeywords(criteria.experienceLevel);
      config.keywords.push(...levelKeywords);
    }

    return config;
  }

  /**
   * Generate dork for PDF job descriptions
   */
  private generateFileTypeDork(criteria: JobSearchCriteria): GoogleDorkConfig {
    return {
      site: '',
      keywords: [...criteria.keywords, 'job description', 'job posting'],
      excludeKeywords: criteria.excludeKeywords || [],
      fileTypes: ['pdf'],
    };
  }

  /**
   * Generate dork for company career pages
   */
  private generateCareerPageDork(criteria: JobSearchCriteria): GoogleDorkConfig {
    return {
      site: '',
      keywords: [...criteria.keywords, 'careers', 'jobs', 'opportunities'],
      excludeKeywords: [...(criteria.excludeKeywords || []), 'apply', 'application'],
      customParams: {
        inurl: 'careers OR jobs OR opportunities',
      },
    };
  }

  /**
   * Convert GoogleDorkConfig to actual search query string
   */
  buildSearchQuery(config: GoogleDorkConfig): string {
    const parts: string[] = [];

    // Add site restriction
    if (config.site) {
      parts.push(`site:${config.site}`);
    }

    // Add keywords with quotes for phrases
    const keywordTerms = config.keywords.map(keyword => {
      return keyword.includes(' ') ? `"${keyword}"` : keyword;
    });
    parts.push(keywordTerms.join(' '));

    // Add exclusions
    if (config.excludeKeywords && config.excludeKeywords.length > 0) {
      const exclusions = config.excludeKeywords.map(keyword => `-${keyword}`);
      parts.push(exclusions.join(' '));
    }

    // Add file type restrictions
    if (config.fileTypes && config.fileTypes.length > 0) {
      const fileTypes = config.fileTypes.map(type => `filetype:${type}`);
      parts.push(fileTypes.join(' OR '));
    }

    // Add custom parameters
    if (config.customParams) {
      for (const [key, value] of Object.entries(config.customParams)) {
        parts.push(`${key}:${value}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Generate multiple query variations for better coverage
   */
  generateQueryVariations(criteria: JobSearchCriteria): string[] {
    const dorks = this.generateDorks(criteria);
    const queries: string[] = [];

    // Generate primary queries
    for (const dork of dorks) {
      queries.push(this.buildSearchQuery(dork));
    }

    // Generate additional variations with different keyword combinations
    if (criteria.keywords.length > 1) {
      const variations = this.generateKeywordVariations(criteria.keywords);
      for (const keywords of variations) {
        const modifiedCriteria = { ...criteria, keywords };
        const modifiedDorks = this.generateDorks(modifiedCriteria);
        for (const dork of modifiedDorks.slice(0, 3)) { // Limit variations
          queries.push(this.buildSearchQuery(dork));
        }
      }
    }

    // Remove duplicates and limit total queries
    const uniqueQueries = [...new Set(queries)];
    return uniqueQueries.slice(0, criteria.maxResults ? Math.min(20, criteria.maxResults) : 20);
  }

  /**
   * Get keyword variations by combining terms
   */
  private generateKeywordVariations(keywords: string[]): string[][] {
    const variations: string[][] = [];
    
    // Single keywords
    for (const keyword of keywords) {
      variations.push([keyword]);
    }

    // Pairs of keywords
    for (let i = 0; i < keywords.length; i++) {
      for (let j = i + 1; j < keywords.length; j++) {
        const keyword1 = keywords[i];
        const keyword2 = keywords[j];
        if (keyword1 && keyword2) {
          variations.push([keyword1, keyword2]);
        }
      }
    }

    return variations.slice(0, 10); // Limit variations
  }

  /**
   * Get experience level specific keywords
   */
  private getExperienceLevelKeywords(level: JobSearchCriteria['experienceLevel']): string[] {
    const keywordMap = {
      entry: ['entry level', 'junior', 'graduate', 'intern', '0-2 years'],
      mid: ['mid level', 'intermediate', '2-5 years', 'experienced'],
      senior: ['senior', 'lead', '5+ years', 'expert'],
      executive: ['executive', 'director', 'VP', 'C-level', 'manager'],
    };

    return level ? keywordMap[level] || [] : [];
  }

  /**
   * Generate location-specific dorks
   */
  generateLocationDorks(location: string, keywords: string[]): GoogleDorkConfig[] {
    const locationVariations = this.getLocationVariations(location);
    const dorks: GoogleDorkConfig[] = [];

    for (const locationVar of locationVariations) {
      for (const site of this.jobSites.slice(0, 5)) { // Limit to top job sites
        dorks.push({
          site,
          keywords: [...keywords, locationVar],
          customParams: {
            location: locationVar,
          },
        });
      }
    }

    return dorks;
  }

  /**
   * Get variations of location names
   */
  private getLocationVariations(location: string): string[] {
    const variations = [location];
    
    // Add common abbreviations and variations
    const locationMappings: Record<string, string[]> = {
      'new york': ['NYC', 'New York City', 'Manhattan'],
      'san francisco': ['SF', 'Bay Area', 'Silicon Valley'],
      'los angeles': ['LA', 'Los Angeles County'],
      'london': ['London UK', 'Greater London'],
      'remote': ['work from home', 'WFH', 'distributed', 'anywhere'],
    };

    const normalizedLocation = location.toLowerCase();
    if (locationMappings[normalizedLocation]) {
      variations.push(...locationMappings[normalizedLocation]);
    }

    return variations;
  }
}

// Export singleton instance
export const dorksGenerator = new DorksGenerator();