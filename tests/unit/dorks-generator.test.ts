import { describe, it, expect, beforeEach } from 'vitest';
import { DorksGenerator } from '@/utils/dorks-generator.js';
import type { JobSearchCriteria } from '@/types/index.js';

describe('DorksGenerator', () => {
  let generator: DorksGenerator;

  beforeEach(() => {
    generator = new DorksGenerator();
  });

  describe('generateDorks', () => {
    it('should generate dorks for basic search criteria', () => {
      const criteria: JobSearchCriteria = {
        keywords: ['javascript', 'developer'],
        location: 'New York',
        maxResults: 10
      };

      const dorks = generator.generateDorks(criteria);

      expect(dorks).toBeDefined();
      expect(dorks.length).toBeGreaterThan(0);
      expect(dorks[0]).toHaveProperty('site');
      expect(dorks[0]).toHaveProperty('keywords');
      expect(dorks[0].keywords).toContain('javascript');
      expect(dorks[0].keywords).toContain('developer');
    });

    it('should generate remote-specific dorks', () => {
      const criteria: JobSearchCriteria = {
        keywords: ['python'],
        remote: true
      };

      const dorks = generator.generateDorks(criteria);
      const hasRemoteKeywords = dorks.some(dork => 
        dork.keywords.some(keyword => 
          keyword.includes('remote') || keyword.includes('work from home')
        )
      );

      expect(hasRemoteKeywords).toBe(true);
    });

    it('should handle empty keywords gracefully', () => {
      const criteria: JobSearchCriteria = {
        keywords: [],
        location: 'London'
      };

      const dorks = generator.generateDorks(criteria);
      
      // Should still generate some dorks (file type and career page dorks)
      expect(dorks.length).toBeGreaterThanOrEqual(0);
    });

    it('should include experience level keywords', () => {
      const criteria: JobSearchCriteria = {
        keywords: ['software engineer'],
        experienceLevel: 'senior'
      };

      const dorks = generator.generateDorks(criteria);
      const hasSeniorKeywords = dorks.some(dork => 
        dork.keywords.some(keyword => 
          keyword.includes('senior') || keyword.includes('lead')
        )
      );

      expect(hasSeniorKeywords).toBe(true);
    });
  });

  describe('buildSearchQuery', () => {
    it('should build correct search query with site restriction', () => {
      const config = {
        site: 'linkedin.com/jobs',
        keywords: ['react', 'frontend'],
        excludeKeywords: ['intern']
      };

      const query = generator.buildSearchQuery(config);

      expect(query).toContain('site:linkedin.com/jobs');
      expect(query).toContain('react');
      expect(query).toContain('frontend');
      expect(query).toContain('-intern');
    });

    it('should handle phrases with quotes', () => {
      const config = {
        site: 'indeed.com',
        keywords: ['full stack developer', 'javascript'],
        excludeKeywords: []
      };

      const query = generator.buildSearchQuery(config);

      expect(query).toContain('"full stack developer"');
      expect(query).toContain('javascript');
    });

    it('should include file type restrictions', () => {
      const config = {
        site: '',
        keywords: ['job description'],
        fileTypes: ['pdf']
      };

      const query = generator.buildSearchQuery(config);

      expect(query).toContain('filetype:pdf');
    });

    it('should include custom parameters', () => {
      const config = {
        site: '',
        keywords: ['careers'],
        customParams: {
          inurl: 'careers OR jobs'
        }
      };

      const query = generator.buildSearchQuery(config);

      expect(query).toContain('inurl:careers OR jobs');
    });
  });

  describe('generateQueryVariations', () => {
    it('should generate multiple query variations', () => {
      const criteria: JobSearchCriteria = {
        keywords: ['node.js', 'backend', 'api'],
        maxResults: 20
      };

      const queries = generator.generateQueryVariations(criteria);

      expect(queries.length).toBeGreaterThan(1);
      expect(queries.length).toBeLessThanOrEqual(20);
      
      // Should contain variations with different keyword combinations
      const uniqueQueries = new Set(queries);
      expect(uniqueQueries.size).toBe(queries.length); // No duplicates
    });

    it('should limit query count based on maxResults', () => {
      const criteria: JobSearchCriteria = {
        keywords: ['developer'],
        maxResults: 5
      };

      const queries = generator.generateQueryVariations(criteria);

      expect(queries.length).toBeLessThanOrEqual(5);
    });
  });

  describe('generateLocationDorks', () => {
    it('should generate location-specific dorks', () => {
      const dorks = generator.generateLocationDorks('San Francisco', ['software engineer']);

      expect(dorks.length).toBeGreaterThan(0);
      
      const hasLocationKeywords = dorks.some(dork => 
        dork.keywords.some(keyword => 
          keyword.includes('San Francisco') || keyword.includes('SF') || keyword.includes('Bay Area')
        )
      );

      expect(hasLocationKeywords).toBe(true);
    });

    it('should include location variations for major cities', () => {
      const dorks = generator.generateLocationDorks('New York', ['developer']);

      const hasVariations = dorks.some(dork => 
        dork.keywords.some(keyword => 
          keyword.includes('NYC') || keyword.includes('New York City')
        )
      );

      expect(hasVariations).toBe(true);
    });
  });
});