import { describe, it, expect, beforeEach } from 'vitest';
import { IndeedScraper } from '@/scrapers/sites/indeed.scraper.js';
import type { ScraperConfig } from '@/config/schemas.js';
import type { SiteConfig } from '@/config/sites.js';

describe('IndeedScraper', () => {
  let scraper: IndeedScraper;
  let mockScraperConfig: ScraperConfig;
  let mockSiteConfig: SiteConfig;

  beforeEach(() => {
    mockScraperConfig = {
      userAgent: 'test-agent',
      delay: 100,
      retries: 2,
      timeout: 5000,
      respectRobotsTxt: false,
      rateLimit: {
        requestsPerSecond: 1,
        burst: 2,
      },
    };

    mockSiteConfig = {
      id: 'indeed',
      name: 'Indeed',
      baseUrl: 'https://www.indeed.com',
      enabled: true,
      scraping: {
        type: 'static' as const,
        respectRobotsTxt: false,
        rateLimit: {
          requestsPerMinute: 30,
          burstLimit: 5,
        },
        retries: 2,
        timeout: 5000,
      },
      selectors: {
        jobCard: '[data-jk]',
        title: '.jobTitle a span',
        company: '.companyName',
        location: '.companyLocation',
        jobLink: '.jobTitle a',
        description: '.summary',
        salary: '.salaryText',
        postedDate: '.date',
      },
      search: {
        searchUrl: '/jobs',
        queryParams: {
          keywords: 'q',
          location: 'l',
        },
      },
      processing: {
        salaryRegex: [/\$[\d,]+/],
        dateFormats: ['M/D/YYYY'],
      },
      features: {
        hasJobAlerts: true,
        hasSalaryData: true,
        hasCompanyReviews: false,
        requiresLogin: false,
        hasApplyButton: true,
        supportsBulkExport: false,
      },
    };
  });

  it('should create an instance', () => {
    scraper = new IndeedScraper(mockScraperConfig, mockSiteConfig);
    expect(scraper).toBeInstanceOf(IndeedScraper);
  });

  it('should build Indeed search URL with keywords', () => {
    scraper = new IndeedScraper(mockScraperConfig, mockSiteConfig);
    
    const params = { keywords: 'software engineer', location: 'New York' };
    const url = (scraper as any).buildSearchUrl(params);
    
    expect(url).toContain('https://www.indeed.com/jobs');
    expect(url).toContain('q=software%20engineer');
    expect(url).toContain('l=New%20York');
  });

  it('should map employment types correctly', () => {
    scraper = new IndeedScraper(mockScraperConfig, mockSiteConfig);
    
    const params = { keywords: 'developer', employment_type: 'full-time' };
    const url = (scraper as any).buildSearchUrl(params);
    
    expect(url).toContain('jt=fulltime');
  });

  it('should handle remote job parameter', () => {
    scraper = new IndeedScraper(mockScraperConfig, mockSiteConfig);
    
    const params = { keywords: 'developer', remote: 'true' };
    const url = (scraper as any).buildSearchUrl(params);
    
    expect(url).toContain('remotejob=1');
  });

  it('should parse job elements from Indeed HTML', () => {
    scraper = new IndeedScraper(mockScraperConfig, mockSiteConfig);
    
    // Mock Indeed HTML structure
    const mockHtml = `
      <div data-jk="12345">
        <h2 class="jobTitle">
          <a href="/viewjob?jk=12345">
            <span title="Software Engineer">Software Engineer</span>
          </a>
        </h2>
        <span class="companyName">Tech Corp</span>
        <div class="companyLocation">San Francisco, CA</div>
        <div class="job-snippet">Develop amazing software products...</div>
        <span class="salaryText">$120,000 - $150,000</span>
        <span class="date">3 days ago</span>
      </div>
    `;

    const jobs = (scraper as any).parsePage(mockHtml, 'https://indeed.com/jobs?q=test');
    
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: 'indeed_12345',
      title: 'Software Engineer',
      company: 'Tech Corp',
      location: 'San Francisco, CA',
      description: 'Develop amazing software products...',
      salary: '$120,000 - $150,000',
      postedDate: '3 days ago',
      source: 'indeed',
      url: 'https://www.indeed.com/viewjob?jk=12345',
    });
  });

  it('should handle missing job data gracefully', () => {
    scraper = new IndeedScraper(mockScraperConfig, mockSiteConfig);
    
    // Mock Indeed HTML with minimal data
    const mockHtml = `
      <div data-jk="67890">
        <h2 class="jobTitle">
          <a href="/viewjob?jk=67890">
            <span title="Basic Job">Basic Job</span>
          </a>
        </h2>
        <span class="companyName">Unknown Company</span>
        <div class="companyLocation">Remote</div>
      </div>
    `;

    const jobs = (scraper as any).parsePage(mockHtml, 'https://indeed.com/jobs?q=test');
    
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: 'indeed_67890',
      title: 'Basic Job',
      company: 'Unknown Company',
      location: 'Remote',
      source: 'indeed',
    });

    // Should not have salary or postedDate properties
    expect(jobs[0].salary).toBeUndefined();
    expect(jobs[0].postedDate).toBeUndefined();
  });

  it('should skip jobs without required fields', () => {
    scraper = new IndeedScraper(mockScraperConfig, mockSiteConfig);
    
    // Mock Indeed HTML without required title
    const mockHtml = `
      <div data-jk="invalid">
        <span class="companyName">Tech Corp</span>
        <div class="companyLocation">San Francisco, CA</div>
      </div>
    `;

    const jobs = (scraper as any).parsePage(mockHtml, 'https://indeed.com/jobs?q=test');
    
    expect(jobs).toHaveLength(0);
  });

  it('should detect sponsored jobs', () => {
    scraper = new IndeedScraper(mockScraperConfig, mockSiteConfig);
    
    // Mock Indeed HTML with sponsored label
    const mockHtml = `
      <div data-jk="sponsored123">
        <h2 class="jobTitle">
          <a href="/viewjob?jk=sponsored123">
            <span title="Sponsored Engineer">Sponsored Engineer</span>
          </a>
        </h2>
        <span class="companyName">Sponsor Corp</span>
        <div class="companyLocation">New York, NY</div>
        <div class="ppsLabel">Sponsored</div>
      </div>
    `;

    const jobs = (scraper as any).parsePage(mockHtml, 'https://indeed.com/jobs?q=test');
    
    expect(jobs).toHaveLength(1);
    expect(jobs[0].raw.isSponsored).toBe(true);
  });

  it('should calculate confidence scores', () => {
    scraper = new IndeedScraper(mockScraperConfig, mockSiteConfig);
    
    const mockHtml = `
      <div data-jk="confidence123">
        <h2 class="jobTitle">
          <a href="/viewjob?jk=confidence123">
            <span title="Senior Software Engineer">Senior Software Engineer</span>
          </a>
        </h2>
        <span class="companyName">Great Company Inc</span>
        <div class="companyLocation">Seattle, WA</div>
        <div class="job-snippet">Looking for experienced developer with strong skills in React and Node.js. Must have 5+ years experience with requirements gathering...</div>
      </div>
    `;

    const jobs = (scraper as any).parsePage(mockHtml, 'https://indeed.com/jobs?q=test');
    
    expect(jobs).toHaveLength(1);
    expect(jobs[0].metadata.confidence).toBe(0.8); // Has title and company
    expect(jobs[0].metadata.hasDetails).toBe(true); // Description > 50 chars
  });

  it('should handle empty results page', () => {
    scraper = new IndeedScraper(mockScraperConfig, mockSiteConfig);
    
    const mockHtml = '<div class="jobsearch-NoResult">No jobs found</div>';
    const jobs = (scraper as any).parsePage(mockHtml, 'https://indeed.com/jobs?q=test');
    
    expect(jobs).toHaveLength(0);
  });

  it('should clean title text by removing "new" prefix', () => {
    scraper = new IndeedScraper(mockScraperConfig, mockSiteConfig);
    
    const mockHtml = `
      <div data-jk="new123">
        <h2 class="jobTitle">
          <a href="/viewjob?jk=new123">
            <span title="new Software Engineer">new Software Engineer</span>
          </a>
        </h2>
        <span class="companyName">Tech Corp</span>
        <div class="companyLocation">San Francisco, CA</div>
      </div>
    `;

    const jobs = (scraper as any).parsePage(mockHtml, 'https://indeed.com/jobs?q=test');
    
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe('Software Engineer'); // "new" prefix removed
  });
});
