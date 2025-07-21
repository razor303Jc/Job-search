import { z } from 'zod';

/**
 * Salary information schema
 */
export const SalarySchema = z
  .object({
    min: z.number().positive().optional(),
    max: z.number().positive().optional(),
    currency: z.string().min(3).max(3).default('USD'),
    period: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'yearly']).default('yearly'),
  })
  .refine(
    (data) => {
      if (data.min && data.max) {
        return data.min <= data.max;
      }
      return true;
    },
    {
      message: 'Minimum salary must be less than or equal to maximum salary',
    },
  );

/**
 * Job source information schema
 */
export const JobSourceSchema = z.object({
  site: z.string().min(1),
  originalUrl: z.string().url(),
  scrapedAt: z.date().default(() => new Date()),
});

/**
 * Job metadata schema
 */
export const JobMetadataSchema = z.object({
  confidence: z.number().min(0).max(1).default(0.5),
  rawData: z.record(z.unknown()).optional(),
});

/**
 * Core job listing schema with validation
 */
export const JobListingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().min(1),
  description: z.string().min(1),
  url: z.string().url(),
  salary: SalarySchema.optional(),
  employmentType: z
    .enum(['full-time', 'part-time', 'contract', 'temporary', 'internship', 'freelance'])
    .default('full-time'),
  remote: z.boolean().default(false),
  postedDate: z.date().optional(),
  expiryDate: z.date().optional(),
  requirements: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  source: JobSourceSchema,
  metadata: JobMetadataSchema.default({}),
});

/**
 * Job search criteria schema
 */
export const JobSearchCriteriaSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  employmentTypes: z.array(JobListingSchema.shape.employmentType).optional(),
  excludeKeywords: z.array(z.string()).default([]),
  datePosted: z.enum(['today', 'week', 'month', 'any']).default('any'),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'executive']).optional(),
  maxResults: z.number().positive().max(1000).default(50),
});

/**
 * Scraping result schema
 */
export const ScrapingResultSchema = z.object({
  jobs: z.array(JobListingSchema),
  totalFound: z.number().nonnegative(),
  searchCriteria: JobSearchCriteriaSchema,
  timestamp: z.date().default(() => new Date()),
  source: z.string(),
  errors: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

// Type exports for use in other modules
export type JobListing = z.infer<typeof JobListingSchema>;
export type JobSearchCriteria = z.infer<typeof JobSearchCriteriaSchema>;
export type ScrapingResult = z.infer<typeof ScrapingResultSchema>;
export type JobSalary = z.infer<typeof SalarySchema>;
export type JobSource = z.infer<typeof JobSourceSchema>;
export type JobMetadata = z.infer<typeof JobMetadataSchema>;
