import { describe, expect, it } from 'vitest';
import { JobValidator } from '@/parsers/schemas/job.schema.js';
import type { JobListing, RawJobData } from '@/parsers/schemas/job.schema.js';

describe('Job Schema Validation', () => {
  const mockSource = {
    site: 'example.com',
    originalUrl: 'https://example.com/job/1',
    scrapedAt: new Date(),
  };

  const validJobListing: JobListing = {
    id: 'test-123',
    title: 'Software Engineer',
    company: 'Tech Corp',
    location: 'San Francisco, CA',
    description: 'We are looking for a talented software engineer...',
    url: 'https://example.com/job/1',
    salary: {
      min: 80000,
      max: 120000,
      currency: 'USD',
      period: 'yearly',
    },
    employmentType: 'full-time',
    remote: false,
    postedDate: new Date('2024-01-15'),
    requirements: ['JavaScript', 'React', '3+ years experience'],
    benefits: ['Health insurance', 'Stock options'],
    tags: ['frontend', 'javascript', 'react'],
    source: mockSource,
    metadata: {
      confidence: 0.95,
      rawData: { html: '<div>raw html</div>' },
    },
  };

  describe('JobValidator.validateJob', () => {
    it('should validate a complete valid job listing', () => {
      const result = JobValidator.validateJob(validJobListing);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('test-123');
        expect(result.data.title).toBe('Software Engineer');
        expect(result.data.salary?.min).toBe(80000);
      }
    });

    it('should reject job with missing required fields', () => {
      const invalidJob = {
        id: 'test-123',
        // Missing title, company, location, description, etc.
      };

      const result = JobValidator.validateJob(invalidJob);
      expect(result.success).toBe(false);
    });

    it('should reject job with invalid salary range', () => {
      const invalidJob = {
        ...validJobListing,
        salary: {
          min: 120000, // Higher than max
          max: 80000,
          currency: 'USD',
          period: 'yearly',
        },
      };

      const result = JobValidator.validateJob(invalidJob);
      expect(result.success).toBe(false);
    });

    it('should reject job with invalid employment type', () => {
      const invalidJob = {
        ...validJobListing,
        employmentType: 'invalid-type' as any,
      };

      const result = JobValidator.validateJob(invalidJob);
      expect(result.success).toBe(false);
    });

    it('should reject job with invalid URL', () => {
      const invalidJob = {
        ...validJobListing,
        url: 'not-a-valid-url',
      };

      const result = JobValidator.validateJob(invalidJob);
      expect(result.success).toBe(false);
    });

    it('should accept job without optional fields', () => {
      const minimalJob = {
        id: 'test-minimal',
        title: 'Developer',
        company: 'Company',
        location: 'Location',
        description: 'Description',
        url: 'https://example.com/job/minimal',
        employmentType: 'full-time' as const,
        remote: false,
        requirements: [],
        benefits: [],
        tags: [],
        source: mockSource,
        metadata: {
          confidence: 0.8,
        },
      };

      const result = JobValidator.validateJob(minimalJob);
      expect(result.success).toBe(true);
    });
  });

  describe('JobValidator.validateRawJobData', () => {
    it('should validate raw job data', () => {
      const rawData: RawJobData = {
        title: 'Frontend Developer',
        company: 'Tech Start-up',
        location: 'Remote',
        description: 'Join our team...',
        url: 'https://example.com/job/frontend',
        salaryText: '$70k - $90k per year',
        employmentTypeText: 'Full-time',
        postedDateText: '2 days ago',
        requirementsText: 'React, TypeScript, 2+ years',
        benefitsText: 'Health, Dental, Vision',
        tagsText: 'frontend, react, remote',
        rawHtml: '<div class="job">...</div>',
      };

      const result = JobValidator.validateRawJobData(rawData);
      expect(result.success).toBe(true);
    });

    it('should accept raw data with all fields optional', () => {
      const result = JobValidator.validateRawJobData({});
      expect(result.success).toBe(true);
    });
  });

  describe('JobValidator.transformRawToJob', () => {
    it('should transform complete raw data to job listing', () => {
      const rawData: RawJobData = {
        title: 'Backend Developer',
        company: 'Data Corp',
        location: 'New York, NY',
        description: 'We need a skilled backend developer...',
        url: 'https://example.com/job/backend',
        salaryText: '$80,000 - $110,000 per year',
        employmentTypeText: 'Full-time',
        postedDateText: 'yesterday',
        requirementsText: 'Python, Django, PostgreSQL',
        benefitsText: '401k, Health insurance',
        tagsText: 'backend, python, django',
      };

      const transformed = JobValidator.transformRawToJob(rawData, mockSource);

      expect(transformed.title).toBe('Backend Developer');
      expect(transformed.company).toBe('Data Corp');
      expect(transformed.location).toBe('New York, NY');
      expect(transformed.salary?.min).toBe(80000);
      expect(transformed.salary?.max).toBe(110000);
      expect(transformed.employmentType).toBe('full-time');
      expect(transformed.requirements).toEqual(['Python', 'Django', 'PostgreSQL']);
      expect(transformed.benefits).toEqual(['401k', 'Health insurance']);
      expect(transformed.tags).toEqual(['backend', 'python', 'django']);
    });

    it('should handle missing raw data gracefully', () => {
      const rawData: RawJobData = {}; // Empty raw data

      const transformed = JobValidator.transformRawToJob(rawData, mockSource);

      expect(transformed.title).toBe('Unknown Title');
      expect(transformed.company).toBe('Unknown Company');
      expect(transformed.location).toBe('Unknown Location');
      expect(transformed.description).toBe('');
      expect(transformed.requirements).toEqual([]);
      expect(transformed.benefits).toEqual([]);
      expect(transformed.tags).toEqual([]);
    });

    it('should generate unique job IDs', () => {
      const rawData1: RawJobData = {
        title: 'Developer',
        company: 'Company A',
        url: 'https://example.com/job/1',
      };

      const rawData2: RawJobData = {
        title: 'Developer',
        company: 'Company B',
        url: 'https://example.com/job/2',
      };

      const transformed1 = JobValidator.transformRawToJob(rawData1, mockSource);
      const transformed2 = JobValidator.transformRawToJob(rawData2, mockSource);

      expect(transformed1.id).toBeDefined();
      expect(transformed2.id).toBeDefined();
      expect(transformed1.id).not.toBe(transformed2.id);
    });

    it('should calculate confidence scores', () => {
      const completeRawData: RawJobData = {
        title: 'Full Stack Developer',
        company: 'Tech Solutions',
        location: 'Seattle, WA',
        description: 'We are seeking...',
        url: 'https://example.com/job/fullstack',
        salaryText: '$90k - $130k',
        employmentTypeText: 'Full-time',
        postedDateText: '1 week ago',
      };

      const incompleteRawData: RawJobData = {
        title: 'Developer',
      };

      const completeTransformed = JobValidator.transformRawToJob(completeRawData, mockSource);
      const incompleteTransformed = JobValidator.transformRawToJob(incompleteRawData, mockSource);

      expect(completeTransformed.metadata?.confidence).toBeGreaterThan(
        incompleteTransformed.metadata?.confidence || 0
      );
    });
  });

  describe('Salary Parsing', () => {
    it('should parse various salary formats', () => {
      const testCases = [
        {
          input: { salaryText: '$50,000 - $80,000 per year' },
          expected: { min: 50000, max: 80000, currency: 'USD', period: 'yearly' },
        },
        {
          input: { salaryText: '$50k - $80k' },
          expected: { min: 50000, max: 80000, currency: 'USD', period: 'yearly' },
        },
        {
          input: { salaryText: '£40,000 - £60,000' },
          expected: { min: 40000, max: 60000, currency: 'GBP', period: 'yearly' },
        },
        {
          input: { salaryText: '€45,000 - €65,000' },
          expected: { min: 45000, max: 65000, currency: 'EUR', period: 'yearly' },
        },
        {
          input: { salaryText: '$25 - $35 per hour' },
          expected: { min: 25, max: 35, currency: 'USD', period: 'hourly' },
        },
      ];

      for (const testCase of testCases) {
        const transformed = JobValidator.transformRawToJob(testCase.input, mockSource);
        expect(transformed.salary).toEqual(testCase.expected);
      }
    });

    it('should handle invalid salary text', () => {
      const rawData = { salaryText: 'Competitive salary' };
      const transformed = JobValidator.transformRawToJob(rawData, mockSource);
      expect(transformed.salary).toBeUndefined();
    });
  });

  describe('Employment Type Parsing', () => {
    it('should parse employment types correctly', () => {
      const testCases = [
        { input: 'Full-time', expected: 'full-time' },
        { input: 'Part-time position', expected: 'part-time' },
        { input: 'Contract work', expected: 'contract' },
        { input: 'Temporary assignment', expected: 'temporary' },
        { input: 'Internship program', expected: 'internship' },
        { input: 'Freelance opportunity', expected: 'freelance' },
        { input: 'Unknown', expected: 'full-time' }, // Default
      ];

      for (const testCase of testCases) {
        const rawData = { employmentTypeText: testCase.input };
        const transformed = JobValidator.transformRawToJob(rawData, mockSource);
        expect(transformed.employmentType).toBe(testCase.expected);
      }
    });
  });

  describe('Remote Job Detection', () => {
    it('should detect remote jobs from location', () => {
      const testCases = [
        { location: 'Remote', expected: true },
        { location: 'Work from home', expected: true },
        { location: 'San Francisco (Remote)', expected: true },
        { location: 'New York', expected: false },
      ];

      for (const testCase of testCases) {
        const rawData = { location: testCase.location };
        const transformed = JobValidator.transformRawToJob(rawData, mockSource);
        expect(transformed.remote).toBe(testCase.expected);
      }
    });

    it('should detect remote jobs from description', () => {
      const testCases = [
        { description: 'This is a remote position', expected: true },
        { description: 'WFH friendly company', expected: true },
        { description: 'Distributed team', expected: true },
        { description: 'Office-based role', expected: false },
      ];

      for (const testCase of testCases) {
        const rawData = { description: testCase.description };
        const transformed = JobValidator.transformRawToJob(rawData, mockSource);
        expect(transformed.remote).toBe(testCase.expected);
      }
    });
  });

  describe('Date Parsing', () => {
    it('should parse relative dates', () => {
      const testCases = [
        'today',
        'yesterday', 
        '2 days ago',
        '1 week ago',
        'just now',
      ];

      for (const dateText of testCases) {
        const rawData = { postedDateText: dateText };
        const transformed = JobValidator.transformRawToJob(rawData, mockSource);
        expect(transformed.postedDate).toBeInstanceOf(Date);
      }
    });

    it('should parse absolute dates', () => {
      const rawData = { postedDateText: '2024-01-15' };
      const transformed = JobValidator.transformRawToJob(rawData, mockSource);
      expect(transformed.postedDate).toBeInstanceOf(Date);
    });

    it('should handle invalid date text', () => {
      const rawData = { postedDateText: 'invalid date' };
      const transformed = JobValidator.transformRawToJob(rawData, mockSource);
      expect(transformed.postedDate).toBeUndefined();
    });
  });

  describe('List Parsing', () => {
    it('should parse comma-separated lists', () => {
      const testCases = [
        {
          input: 'JavaScript, React, Node.js',
          expected: ['JavaScript', 'React', 'Node.js'],
        },
        {
          input: 'Health insurance, 401k, Stock options',
          expected: ['Health insurance', '401k', 'Stock options'],
        },
        {
          input: 'frontend, backend, fullstack',
          expected: ['frontend', 'backend', 'fullstack'],
        },
      ];

      for (const testCase of testCases) {
        const rawData = { 
          requirementsText: testCase.input,
          benefitsText: testCase.input,
          tagsText: testCase.input,
        };
        const transformed = JobValidator.transformRawToJob(rawData, mockSource);
        
        expect(transformed.requirements).toEqual(testCase.expected);
        expect(transformed.benefits).toEqual(testCase.expected);
        expect(transformed.tags).toEqual(testCase.expected);
      }
    });

    it('should parse newline-separated lists', () => {
      const input = 'JavaScript\nReact\nNode.js';
      const expected = ['JavaScript', 'React', 'Node.js'];
      
      const rawData = { requirementsText: input };
      const transformed = JobValidator.transformRawToJob(rawData, mockSource);
      
      expect(transformed.requirements).toEqual(expected);
    });

    it('should handle empty or invalid list text', () => {
      const rawData = { requirementsText: '' };
      const transformed = JobValidator.transformRawToJob(rawData, mockSource);
      expect(transformed.requirements).toEqual([]);
    });
  });
});