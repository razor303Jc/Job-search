import {
  EXCLUDE_KEYWORDS,
  JOB_SITES,
  KEYWORD_GROUPS,
  PREDEFINED_DORKS,
  createCustomDork,
  generateDorkQuery,
  getAllDorks,
  getDorksForCategory,
  getRecommendedDorks,
} from '@/config/dorks.js';
import { describe, expect, it } from 'vitest';

describe('Google Dorks Configuration', () => {
  describe('Constants', () => {
    it('should have predefined job sites', () => {
      expect(JOB_SITES.LINKEDIN).toBe('linkedin.com/jobs');
      expect(JOB_SITES.INDEED).toBe('indeed.com');
      expect(JOB_SITES.GLASSDOOR).toBe('glassdoor.com');
      expect(JOB_SITES.REMOTEOK).toBe('remoteok.io');
    });

    it('should have keyword groups for different tech stacks', () => {
      expect(KEYWORD_GROUPS.FRONTEND).toContain('react');
      expect(KEYWORD_GROUPS.FRONTEND).toContain('vue');
      expect(KEYWORD_GROUPS.BACKEND).toContain('node.js');
      expect(KEYWORD_GROUPS.BACKEND).toContain('python');
      expect(KEYWORD_GROUPS.DEVOPS).toContain('kubernetes');
      expect(KEYWORD_GROUPS.DATA).toContain('machine learning');
    });

    it('should have exclude keywords', () => {
      expect(EXCLUDE_KEYWORDS).toContain('internship');
      expect(EXCLUDE_KEYWORDS).toContain('intern');
      expect(EXCLUDE_KEYWORDS).toContain('unpaid');
    });
  });

  describe('generateDorkQuery', () => {
    it('should generate basic dork query with site and keywords', () => {
      const config = {
        site: 'linkedin.com/jobs',
        keywords: ['software engineer'],
      };

      const query = generateDorkQuery(config);
      expect(query).toBe('site:linkedin.com/jobs "software engineer"');
    });

    it('should handle multiple keywords with OR operator', () => {
      const config = {
        site: 'indeed.com',
        keywords: ['developer', 'programmer'],
      };

      const query = generateDorkQuery(config);
      expect(query).toBe('site:indeed.com developer OR programmer');
    });

    it('should add exclusions with minus operator', () => {
      const config = {
        site: 'glassdoor.com',
        keywords: ['engineer'],
        excludeKeywords: ['intern', 'internship'],
      };

      const query = generateDorkQuery(config);
      expect(query).toBe('site:glassdoor.com engineer -"intern" -"internship"');
    });

    it('should handle file type restrictions', () => {
      const config = {
        site: 'example.com',
        keywords: ['job'],
        fileTypes: ['pdf', 'doc'],
      };

      const query = generateDorkQuery(config);
      expect(query).toBe('site:example.com job filetype:pdf OR filetype:doc');
    });

    it('should handle custom parameters', () => {
      const config = {
        site: 'example.com',
        keywords: ['developer'],
        customParams: {
          inurl: 'careers',
          intitle: 'software',
        },
      };

      const query = generateDorkQuery(config);
      expect(query).toBe('site:example.com developer inurl:careers intitle:software');
    });

    it('should handle phrases with spaces by adding quotes', () => {
      const config = {
        site: 'example.com',
        keywords: ['full stack developer', 'react'],
      };

      const query = generateDorkQuery(config);
      expect(query).toBe('site:example.com "full stack developer" OR react');
    });
  });

  describe('getDorksForCategory', () => {
    it('should return dorks for LinkedIn category', () => {
      const dorks = getDorksForCategory('linkedin');

      expect(dorks).toHaveLength(4);
      expect(dorks[0].site).toBe(JOB_SITES.LINKEDIN);
      expect(dorks[0].keywords).toContain('software engineer');
    });

    it('should return dorks for remote category', () => {
      const dorks = getDorksForCategory('remote');

      expect(dorks.length).toBeGreaterThan(0);
      expect(dorks.some((dork) => dork.site === JOB_SITES.REMOTEOK)).toBe(true);
      expect(dorks.some((dork) => dork.site === JOB_SITES.WEWORKREMOTELY)).toBe(true);
    });

    it('should return empty array for non-existent category', () => {
      const dorks = getDorksForCategory('nonexistent' as never);
      expect(dorks).toEqual([]);
    });
  });

  describe('getAllDorks', () => {
    it('should return all predefined dorks', () => {
      const allDorks = getAllDorks();

      expect(allDorks.length).toBeGreaterThan(0);

      // Should contain dorks from different categories
      const sites = allDorks.map((dork) => dork.site);
      expect(sites).toContain(JOB_SITES.LINKEDIN);
      expect(sites).toContain(JOB_SITES.INDEED);
      expect(sites).toContain(JOB_SITES.GLASSDOOR);
    });

    it('should have valid structure for all dorks', () => {
      const allDorks = getAllDorks();

      for (const dork of allDorks) {
        expect(dork.site).toBeDefined();
        expect(dork.keywords).toBeDefined();
        expect(Array.isArray(dork.keywords)).toBe(true);
        expect(dork.keywords.length).toBeGreaterThan(0);
      }
    });
  });

  describe('createCustomDork', () => {
    it('should create custom dorks for multiple sites', () => {
      const options = {
        sites: ['linkedin.com/jobs', 'indeed.com'],
        keywords: ['react developer'],
      };

      const dorks = createCustomDork(options);

      expect(dorks).toHaveLength(2);
      expect(dorks[0].site).toBe('linkedin.com/jobs');
      expect(dorks[1].site).toBe('indeed.com');
      expect(dorks[0].keywords).toContain('react developer');
    });

    it('should add location keyword when not remote', () => {
      const options = {
        sites: ['example.com'],
        keywords: ['developer'],
        location: 'San Francisco',
        remote: false,
      };

      const dorks = createCustomDork(options);

      expect(dorks[0].keywords).toContain('developer');
      expect(dorks[0].keywords).toContain('San Francisco');
      expect(dorks[0].keywords).not.toContain('remote');
    });

    it('should add remote keyword when remote is true', () => {
      const options = {
        sites: ['example.com'],
        keywords: ['developer'],
        remote: true,
      };

      const dorks = createCustomDork(options);

      expect(dorks[0].keywords).toContain('developer');
      expect(dorks[0].keywords).toContain('remote');
    });

    it('should add experience level to keywords', () => {
      const options = {
        sites: ['example.com'],
        keywords: ['developer'],
        experienceLevel: 'senior',
      };

      const dorks = createCustomDork(options);

      expect(dorks[0].keywords).toContain('developer');
      expect(dorks[0].keywords).toContain('senior');
    });

    it('should include exclude keywords', () => {
      const options = {
        sites: ['example.com'],
        keywords: ['developer'],
        excludeKeywords: ['bootcamp'],
      };

      const dorks = createCustomDork(options);

      expect(dorks[0].excludeKeywords).toContain('bootcamp');
      expect(dorks[0].excludeKeywords).toContain('internship'); // Default exclude
    });
  });

  describe('getRecommendedDorks', () => {
    it('should return recommended dorks for basic criteria', () => {
      const criteria = {
        keywords: ['javascript developer'],
      };

      const dorks = getRecommendedDorks(criteria);

      expect(dorks.length).toBeGreaterThan(0);
      expect(dorks[0].keywords).toContain('javascript developer');

      // Should use default sites
      const sites = dorks.map((dork) => dork.site);
      expect(sites).toContain(JOB_SITES.LINKEDIN);
      expect(sites).toContain(JOB_SITES.INDEED);
    });

    it('should handle remote job criteria', () => {
      const criteria = {
        keywords: ['react developer'],
        remote: true,
      };

      const dorks = getRecommendedDorks(criteria);

      expect(dorks.every((dork) => dork.keywords.includes('remote'))).toBe(true);
    });

    it('should handle location criteria', () => {
      const criteria = {
        keywords: ['python developer'],
        location: 'New York',
      };

      const dorks = getRecommendedDorks(criteria);

      expect(dorks.every((dork) => dork.keywords.includes('New York'))).toBe(true);
    });

    it('should handle custom sites', () => {
      const criteria = {
        keywords: ['go developer'],
        sites: ['stackoverflow.com/jobs', 'dice.com'],
      };

      const dorks = getRecommendedDorks(criteria);

      const sites = dorks.map((dork) => dork.site);
      expect(sites).toContain('stackoverflow.com/jobs');
      expect(sites).toContain('dice.com');
      expect(sites).not.toContain(JOB_SITES.LINKEDIN);
    });

    it('should handle experience level', () => {
      const criteria = {
        keywords: ['software engineer'],
        experienceLevel: 'senior',
      };

      const dorks = getRecommendedDorks(criteria);

      expect(dorks.every((dork) => dork.keywords.includes('senior'))).toBe(true);
    });
  });

  describe('Predefined Dorks Structure', () => {
    it('should have valid LinkedIn dorks', () => {
      const linkedinDorks = PREDEFINED_DORKS.linkedin;

      expect(linkedinDorks).toBeDefined();
      expect(linkedinDorks.length).toBeGreaterThan(0);

      for (const dork of linkedinDorks) {
        expect(dork.site).toBe(JOB_SITES.LINKEDIN);
        expect(dork.keywords.length).toBeGreaterThan(0);
        expect(dork.excludeKeywords).toBeDefined();
      }
    });

    it('should have valid remote work dorks', () => {
      const remoteDorks = PREDEFINED_DORKS.remote;

      expect(remoteDorks).toBeDefined();
      expect(remoteDorks.length).toBeGreaterThan(0);

      const sites = remoteDorks.map((dork) => dork.site);
      expect(sites).toContain(JOB_SITES.REMOTEOK);
      expect(sites).toContain(JOB_SITES.WEWORKREMOTELY);
    });

    it('should exclude internships in all predefined dorks', () => {
      const allDorks = getAllDorks();

      for (const dork of allDorks) {
        if (dork.excludeKeywords) {
          expect(dork.excludeKeywords.some((keyword) => keyword.includes('intern'))).toBe(true);
        }
      }
    });
  });
});
