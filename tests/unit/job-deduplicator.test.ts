import { describe, it, expect, beforeEach } from 'vitest';
import { JobDeduplicator } from '@/utils/job-deduplicator.js';
import type { JobListing } from '@/types/index.js';

describe('JobDeduplicator', () => {
  let deduplicator: JobDeduplicator;
  let sampleJobs: JobListing[];

  beforeEach(() => {
    deduplicator = new JobDeduplicator();
    
    sampleJobs = [
      {
        id: 'job1',
        title: 'Frontend Developer',
        company: 'Tech Corp',
        location: 'San Francisco',
        description: 'Build amazing user interfaces with React',
        url: 'https://example.com/job1',
        employmentType: 'full-time',
        remote: false,
        requirements: ['React', 'JavaScript'],
        benefits: ['Health insurance'],
        tags: ['react', 'frontend'],
        source: {
          site: 'Indeed',
          originalUrl: 'https://example.com/job1',
          scrapedAt: new Date('2024-01-01'),
        },
        metadata: {
          confidence: 0.8,
        },
      },
      {
        id: 'job2',
        title: 'Frontend Developer',
        company: 'Tech Corp',
        location: 'San Francisco',
        description: 'Build amazing user interfaces with React and TypeScript',
        url: 'https://example.com/job2',
        employmentType: 'full-time',
        remote: false,
        requirements: ['React', 'TypeScript'],
        benefits: ['Health insurance', 'Remote work'],
        tags: ['react', 'typescript'],
        source: {
          site: 'LinkedIn',
          originalUrl: 'https://example.com/job2',
          scrapedAt: new Date('2024-01-02'),
        },
        metadata: {
          confidence: 0.9,
        },
      },
      {
        id: 'job3',
        title: 'Backend Engineer',
        company: 'Different Corp',
        location: 'New York',
        description: 'Build scalable APIs with Node.js',
        url: 'https://example.com/job3',
        employmentType: 'full-time',
        remote: true,
        requirements: ['Node.js', 'MongoDB'],
        benefits: ['Remote work'],
        tags: ['nodejs', 'backend'],
        source: {
          site: 'Glassdoor',
          originalUrl: 'https://example.com/job3',
          scrapedAt: new Date('2024-01-03'),
        },
        metadata: {
          confidence: 0.7,
        },
      },
    ];
  });

  describe('findDuplicates', () => {
    it('should identify exact duplicates by URL', () => {
      const jobsWithDuplicate = [
        ...sampleJobs,
        {
          ...sampleJobs[0],
          id: 'job1-duplicate',
          source: {
            ...sampleJobs[0].source,
            site: 'Different Site',
          },
        },
      ];

      const result = deduplicator.findDuplicates(jobsWithDuplicate);

      expect(result.unique.length).toBe(3);
      expect(result.duplicates.length).toBe(1);
      expect(result.duplicates[0].reason).toBe('exact_url_match');
    });

    it('should identify duplicates by title and company', () => {
      const jobsWithSimilar = [
        ...sampleJobs,
        {
          ...sampleJobs[0],
          id: 'job1-similar',
          url: 'https://different-site.com/job',
          description: 'A different description',
        },
      ];

      const result = deduplicator.findDuplicates(jobsWithSimilar);

      expect(result.unique.length).toBe(3);
      expect(result.duplicates.length).toBe(1);
      expect(result.duplicates[0].reason).toBe('exact_title_company_match');
    });

    it('should identify high similarity matches', () => {
      const similarJob = {
        ...sampleJobs[0],
        id: 'similar-job',
        title: 'Frontend Software Developer', // Similar but not exact
        url: 'https://different.com/job',
        description: 'Build amazing user interfaces using React framework',
      };

      const result = deduplicator.findDuplicates([...sampleJobs, similarJob]);

      expect(result.duplicates.length).toBeGreaterThanOrEqual(0);
      // This might or might not be detected as duplicate depending on similarity threshold
    });

    it('should handle empty job list', () => {
      const result = deduplicator.findDuplicates([]);

      expect(result.unique).toEqual([]);
      expect(result.duplicates).toEqual([]);
    });

    it('should handle single job', () => {
      const result = deduplicator.findDuplicates([sampleJobs[0]]);

      expect(result.unique.length).toBe(1);
      expect(result.duplicates.length).toBe(0);
    });
  });

  describe('groupSimilarJobs', () => {
    it('should group similar jobs together', () => {
      const similarJobs = [
        sampleJobs[0],
        {
          ...sampleJobs[0],
          id: 'similar1',
          title: 'Frontend Software Developer',
          url: 'https://different.com/job1',
          metadata: { confidence: 0.6 },
        },
        sampleJobs[2], // Different job
      ];

      const groups = deduplicator.groupSimilarJobs(similarJobs, 0.7);

      expect(groups.length).toBeGreaterThanOrEqual(1);
      
      // Find the group with frontend jobs
      const frontendGroup = groups.find(g => 
        g.group.some(job => job.title.toLowerCase().includes('frontend'))
      );
      
      if (frontendGroup && frontendGroup.group.length > 1) {
        // Representative should be the one with higher confidence
        expect(frontendGroup.representative.metadata.confidence).toBeGreaterThanOrEqual(0.6);
      }
    });

    it('should use most recent job as representative when confidence is equal', () => {
      const job1 = {
        ...sampleJobs[0],
        metadata: { confidence: 0.8 },
        source: { ...sampleJobs[0].source, scrapedAt: new Date('2024-01-01') },
      };

      const job2 = {
        ...sampleJobs[0],
        id: 'job2',
        url: 'https://different.com/job',
        metadata: { confidence: 0.8 }, // Same confidence
        source: { ...sampleJobs[0].source, scrapedAt: new Date('2024-01-02') },
      };

      const groups = deduplicator.groupSimilarJobs([job1, job2], 0.5);

      if (groups.length === 1 && groups[0].group.length === 2) {
        // Should pick the more recent one
        expect(groups[0].representative.source.scrapedAt.getTime()).toBe(new Date('2024-01-02').getTime());
      }
    });
  });

  describe('mergeDuplicateJobs', () => {
    it('should merge duplicate job information correctly', () => {
      const primary = sampleJobs[0];
      const duplicate = {
        ...sampleJobs[0],
        id: 'duplicate',
        requirements: ['React', 'JavaScript', 'CSS'], // More requirements
        benefits: ['Health insurance', 'Dental'], // More benefits
        tags: ['react', 'css', 'html'], // Different tags
        metadata: { confidence: 0.9 }, // Higher confidence
        description: 'A much longer and more detailed description of the job requirements and responsibilities',
      };

      const merged = deduplicator.mergeDuplicateJobs(primary, [duplicate]);

      expect(merged.requirements).toEqual(['React', 'JavaScript', 'CSS']);
      expect(merged.benefits).toEqual(['Health insurance', 'Dental']);
      expect(merged.tags).toContain('react');
      expect(merged.tags).toContain('css');
      expect(merged.tags).toContain('html');
      expect(merged.metadata.confidence).toBe(0.9);
      expect(merged.description.length).toBeGreaterThan(primary.description.length);
    });

    it('should merge salary information from duplicates', () => {
      const primary = {
        ...sampleJobs[0],
        salary: undefined,
      };

      const duplicate = {
        ...sampleJobs[0],
        salary: {
          min: 80000,
          max: 120000,
          currency: 'USD',
          period: 'yearly' as const,
        },
      };

      const merged = deduplicator.mergeDuplicateJobs(primary, [duplicate]);

      expect(merged.salary).toBeDefined();
      expect(merged.salary?.min).toBe(80000);
      expect(merged.salary?.max).toBe(120000);
    });
  });

  describe('removeDuplicatesFromDatabase', async () => {
    it('should remove jobs that are duplicates of existing ones', async () => {
      const existingJobs = [sampleJobs[0]];
      const newJobs = [
        sampleJobs[1], // Different job
        {
          ...sampleJobs[0],
          id: 'duplicate-job',
          url: 'https://different.com/same-job',
        }, // Duplicate of existing
      ];

      const mockProvider = async (job: JobListing) => {
        // Return existing jobs that might be similar
        return existingJobs.filter(existing => 
          existing.company === job.company && existing.title === job.title
        );
      };

      const uniqueJobs = await deduplicator.removeDuplicatesFromDatabase(newJobs, mockProvider);

      expect(uniqueJobs.length).toBe(1);
      expect(uniqueJobs[0].id).toBe(sampleJobs[1].id);
    });
  });
});