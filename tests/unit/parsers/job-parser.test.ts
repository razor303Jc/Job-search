import { describe, expect, it } from 'vitest';
import { DateParser, JobParser, SalaryParser } from '../../../src/parsers/job-parser.js';

describe('SalaryParser', () => {
  describe('parseSalary', () => {
    it('should parse salary ranges in USD', () => {
      const result = SalaryParser.parseSalary('$50,000 - $75,000 per year');
      expect(result).toEqual({
        min: 50000,
        max: 75000,
        currency: 'USD',
        period: 'yearly',
      });
    });

    it('should parse single salary amounts', () => {
      const result = SalaryParser.parseSalary('$60,000/year');
      expect(result).toEqual({
        min: 60000,
        max: 60000,
        currency: 'USD',
        period: 'yearly',
      });
    });

    it('should parse hourly rates', () => {
      const result = SalaryParser.parseSalary('$25-30/hour');
      expect(result).toEqual({
        min: 25,
        max: 30,
        currency: 'USD',
        period: 'hourly',
      });
    });

    it('should parse amounts with k suffix', () => {
      const result = SalaryParser.parseSalary('$60k/year');
      expect(result).toEqual({
        min: 60000,
        max: 60000,
        currency: 'USD',
        period: 'yearly',
      });
    });

    it('should handle different currencies', () => {
      const result = SalaryParser.parseSalary('£40,000 - £60,000');
      expect(result).toEqual({
        min: 40000,
        max: 60000,
        currency: 'GBP',
        period: 'yearly',
      });
    });

    it('should parse monthly salaries', () => {
      const result = SalaryParser.parseSalary('$5000-6000/month');
      expect(result).toEqual({
        min: 5000,
        max: 6000,
        currency: 'USD',
        period: 'monthly',
      });
    });

    it('should return null for invalid input', () => {
      expect(SalaryParser.parseSalary('')).toBeNull();
      expect(SalaryParser.parseSalary('no salary mentioned')).toBeNull();
      expect(SalaryParser.parseSalary('competitive salary')).toBeNull();
    });

    it('should handle Euro currency', () => {
      const result = SalaryParser.parseSalary('€45,000/year');
      expect(result).toEqual({
        min: 45000,
        max: 45000,
        currency: 'EUR',
        period: 'yearly',
      });
    });
  });
});

describe('DateParser', () => {
  describe('parseDate', () => {
    it('should parse relative dates - days ago', () => {
      const result = DateParser.parseDate('Posted 2 days ago');
      expect(result).toBeInstanceOf(Date);

      const now = new Date();
      const expected = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const diff = Math.abs((result?.getTime() || 0) - expected.getTime());
      expect(diff).toBeLessThan(1000); // Within 1 second
    });

    it('should parse relative dates - weeks ago', () => {
      const result = DateParser.parseDate('3 weeks ago');
      expect(result).toBeInstanceOf(Date);

      const now = new Date();
      const expected = new Date(now.getTime() - 3 * 7 * 24 * 60 * 60 * 1000);
      const diff = Math.abs((result?.getTime() || 0) - expected.getTime());
      expect(diff).toBeLessThan(1000);
    });

    it('should parse relative dates - months ago', () => {
      const result = DateParser.parseDate('1 month ago');
      expect(result).toBeInstanceOf(Date);

      const now = new Date();
      const expected = new Date(now);
      expected.setMonth(expected.getMonth() - 1);

      // Allow for month-boundary differences
      const diff = Math.abs((result?.getTime() || 0) - expected.getTime());
      expect(diff).toBeLessThan(24 * 60 * 60 * 1000 * 2); // Within 2 days
    });

    it('should parse absolute dates', () => {
      const result = DateParser.parseDate('2024-01-15');
      expect(result).toEqual(new Date('2024-01-15'));
    });

    it('should return null for invalid input', () => {
      expect(DateParser.parseDate('')).toBeNull();
      expect(DateParser.parseDate('invalid date')).toBeNull();
    });

    it('should handle various formats', () => {
      expect(DateParser.parseDate('January 15, 2024')).toBeInstanceOf(Date);
      expect(DateParser.parseDate('15 Jan 2024')).toBeInstanceOf(Date);
    });
  });
});

describe('JobParser', () => {
  const mockSource = {
    site: 'test-site',
    originalUrl: 'https://example.com/job/123',
  };

  describe('parseJob', () => {
    it('should parse a complete job successfully', () => {
      const rawData = {
        title: 'Senior Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        description: 'Build amazing software products with cutting-edge technology.',
        url: 'https://example.com/job/123',
        salary: '$120,000 - $150,000 per year',
        employmentType: 'full-time',
        postedDate: '2 days ago',
        requirements: ['5+ years experience', 'JavaScript expertise'],
        benefits: ['Health insurance', '401k'],
        tags: ['remote-friendly', 'tech'],
      };

      const result = JobParser.parseJob(rawData, mockSource);

      expect(result).toBeDefined();
      expect(result?.title).toBe('Senior Software Engineer');
      expect(result?.company).toBe('Tech Corp');
      expect(result?.location).toBe('San Francisco, CA');
      expect(result?.url).toBe('https://example.com/job/123');
      expect(result?.employmentType).toBe('full-time');
      expect(result?.remote).toBe(false);
      expect(result?.requirements).toEqual(['5+ years experience', 'JavaScript expertise']);
      expect(result?.benefits).toEqual(['Health insurance', '401k']);
      expect(result?.tags).toEqual(['remote-friendly', 'tech']);
      expect(result?.source.site).toBe('test-site');
      expect(result?.source.originalUrl).toBe('https://example.com/job/123');

      // Check salary parsing
      expect(result?.salary).toBeDefined();
      expect(result?.salary?.min).toBe(120000);
      expect(result?.salary?.max).toBe(150000);
      expect(result?.salary?.currency).toBe('USD');

      // Check posted date parsing
      expect(result?.postedDate).toBeInstanceOf(Date);
    });

    it('should handle minimal job data', () => {
      const rawData = {
        title: 'Developer',
        company: 'Small Co',
        location: 'Remote',
        description: 'Code things.',
        url: 'https://example.com/job/456',
      };

      const result = JobParser.parseJob(rawData, mockSource);

      expect(result).toBeDefined();
      expect(result?.title).toBe('Developer');
      expect(result?.company).toBe('Small Co');
      expect(result?.location).toBe('Remote');
      expect(result?.description).toBe('Code things.');
      expect(result?.url).toBe('https://example.com/job/456');
      expect(result?.employmentType).toBe('full-time'); // Default
      expect(result?.remote).toBe(true); // Detected from location
      expect(result?.requirements).toEqual([]);
      expect(result?.benefits).toEqual([]);
      expect(result?.tags).toEqual([]);
      expect(result?.salary).toBeUndefined();
      expect(result?.postedDate).toBeUndefined();
    });

    it('should return null for missing required fields', () => {
      const incompleteData = {
        title: 'Developer',
        company: 'Tech Corp',
        // Missing location, description, url
      };

      const result = JobParser.parseJob(incompleteData, mockSource);
      expect(result).toBeNull();
    });

    it('should detect remote work from description', () => {
      const rawData = {
        title: 'Remote Developer',
        company: 'Remote Co',
        location: 'New York, NY',
        description: 'Work from home opportunity with flexible schedule.',
        url: 'https://example.com/job/789',
      };

      const result = JobParser.parseJob(rawData, mockSource);
      expect(result?.remote).toBe(true);
    });

    it('should detect employment type from description', () => {
      const rawData = {
        title: 'Part-time Developer',
        company: 'Flex Co',
        location: 'Austin, TX',
        description: 'Part-time position, 20 hours per week.',
        url: 'https://example.com/job/999',
      };

      const result = JobParser.parseJob(rawData, mockSource);
      expect(result?.employmentType).toBe('part-time');
    });

    it('should handle string arrays and parse requirements', () => {
      const rawData = {
        title: 'Developer',
        company: 'Tech Corp',
        location: 'Seattle, WA',
        description: 'Build software.',
        url: 'https://example.com/job/111',
        requirements: 'JavaScript, TypeScript; React; Node.js',
        benefits: 'Health insurance, 401k, Flexible PTO',
      };

      const result = JobParser.parseJob(rawData, mockSource);
      expect(result?.requirements).toEqual(['JavaScript', 'TypeScript', 'React', 'Node.js']);
      expect(result?.benefits).toEqual(['Health insurance', '401k', 'Flexible PTO']);
    });

    it('should generate appropriate job IDs', () => {
      // Test URL with ID
      const rawDataWithUrlId = {
        title: 'Developer',
        company: 'Tech Corp',
        location: 'Portland, OR',
        description: 'Build apps.',
        url: 'https://example.com/job/12345',
      };

      const result1 = JobParser.parseJob(rawDataWithUrlId, mockSource);
      expect(result1?.id).toBe('12345');

      // Test without URL ID (should generate hash)
      const rawDataWithoutUrlId = {
        title: 'Developer',
        company: 'Tech Corp',
        location: 'Portland, OR',
        description: 'Build apps.',
        url: 'https://example.com/jobs/developer-position',
      };

      const result2 = JobParser.parseJob(rawDataWithoutUrlId, mockSource);
      expect(result2?.id).toBeDefined();
      expect(result2?.id.length).toBeGreaterThan(10);
    });

    it('should calculate confidence scores', () => {
      // Job with lots of data should have higher confidence
      const richData = {
        title: 'Senior Developer',
        company: 'Big Tech',
        location: 'San Francisco, CA',
        description: 'A'.repeat(600), // Long description
        url: 'https://example.com/job/rich',
        salary: '$100,000 per year',
        postedDate: '1 day ago',
        requirements: ['JavaScript', 'React'],
        benefits: ['Health', '401k'],
      };

      const richResult = JobParser.parseJob(richData, mockSource);

      // Minimal job should have lower confidence
      const minimalData = {
        title: 'Dev',
        company: 'Small Co',
        location: 'Remote',
        description: 'Code.',
        url: 'https://example.com/job/minimal',
      };

      const minimalResult = JobParser.parseJob(minimalData, mockSource);

      expect(richResult?.metadata.confidence).toBeGreaterThan(
        minimalResult?.metadata.confidence || 0,
      );
    });

    it('should handle contract employment type detection', () => {
      const rawData = {
        title: 'Contract Developer',
        company: 'Consulting Firm',
        location: 'Chicago, IL',
        description: 'Contract position for 6 months with potential extension.',
        url: 'https://example.com/job/contract',
      };

      const result = JobParser.parseJob(rawData, mockSource);
      expect(result?.employmentType).toBe('contract');
    });

    it('should handle freelance employment type detection', () => {
      const rawData = {
        title: 'Freelance Web Developer',
        company: 'Agency',
        location: 'Los Angeles, CA',
        description: 'Freelance opportunity for experienced developer.',
        url: 'https://example.com/job/freelance',
      };

      const result = JobParser.parseJob(rawData, mockSource);
      expect(result?.employmentType).toBe('freelance');
    });
  });
});
