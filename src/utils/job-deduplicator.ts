import type { JobListing } from '@/types/index.js';
import { logger } from './logger.js';

/**
 * Job deduplication service for intelligent duplicate detection
 */
export class JobDeduplicator {
  /**
   * Find and mark duplicate jobs in a list
   */
  findDuplicates(jobs: JobListing[]): {
    unique: JobListing[];
    duplicates: Array<{
      job: JobListing;
      duplicateOf: JobListing;
      similarity: number;
      reason: string;
    }>;
  } {
    const unique: JobListing[] = [];
    const duplicates: Array<{
      job: JobListing;
      duplicateOf: JobListing;
      similarity: number;
      reason: string;
    }> = [];

    for (const job of jobs) {
      const existingJob = this.findSimilarJob(job, unique);
      
      if (existingJob) {
        const similarity = this.calculateSimilarity(job, existingJob.job);
        duplicates.push({
          job,
          duplicateOf: existingJob.job,
          similarity,
          reason: existingJob.reason,
        });
      } else {
        unique.push(job);
      }
    }

    logger.info({ 
      totalJobs: jobs.length, 
      uniqueJobs: unique.length, 
      duplicates: duplicates.length 
    }, 'Deduplication completed');

    return { unique, duplicates };
  }

  /**
   * Find similar job in a list
   */
  private findSimilarJob(job: JobListing, jobs: JobListing[]): {
    job: JobListing;
    reason: string;
  } | null {
    for (const existingJob of jobs) {
      // Exact URL match
      if (job.url === existingJob.url) {
        return { job: existingJob, reason: 'exact_url_match' };
      }

      // Exact title and company match
      if (this.normalizeText(job.title) === this.normalizeText(existingJob.title) &&
          this.normalizeText(job.company) === this.normalizeText(existingJob.company)) {
        return { job: existingJob, reason: 'exact_title_company_match' };
      }

      // High similarity in title, company, and location
      const titleSimilarity = this.calculateTextSimilarity(job.title, existingJob.title);
      const companySimilarity = this.calculateTextSimilarity(job.company, existingJob.company);
      const locationSimilarity = this.calculateTextSimilarity(job.location, existingJob.location);
      
      if (titleSimilarity > 0.85 && companySimilarity > 0.9 && locationSimilarity > 0.8) {
        return { job: existingJob, reason: 'high_similarity_match' };
      }

      // Same job ID (if using deterministic ID generation)
      if (job.id === existingJob.id) {
        return { job: existingJob, reason: 'same_job_id' };
      }
    }

    return null;
  }

  /**
   * Calculate overall similarity between two jobs
   */
  private calculateSimilarity(job1: JobListing, job2: JobListing): number {
    const weights = {
      title: 0.3,
      company: 0.25,
      location: 0.15,
      description: 0.2,
      url: 0.1,
    };

    const titleSim = this.calculateTextSimilarity(job1.title, job2.title);
    const companySim = this.calculateTextSimilarity(job1.company, job2.company);
    const locationSim = this.calculateTextSimilarity(job1.location, job2.location);
    const descriptionSim = this.calculateTextSimilarity(
      job1.description.substring(0, 500), // Compare first 500 chars
      job2.description.substring(0, 500)
    );
    const urlSim = job1.url === job2.url ? 1 : this.calculateUrlSimilarity(job1.url, job2.url);

    return (
      titleSim * weights.title +
      companySim * weights.company +
      locationSim * weights.location +
      descriptionSim * weights.description +
      urlSim * weights.url
    );
  }

  /**
   * Calculate text similarity using Jaccard coefficient
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1;
    if (!text1 || !text2) return 0;

    const set1 = new Set(this.tokenize(this.normalizeText(text1)));
    const set2 = new Set(this.tokenize(this.normalizeText(text2)));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate URL similarity
   */
  private calculateUrlSimilarity(url1: string, url2: string): number {
    if (url1 === url2) return 1;

    try {
      const domain1 = new URL(url1).hostname;
      const domain2 = new URL(url2).hostname;
      
      // Same domain gets higher similarity
      if (domain1 === domain2) {
        const path1 = new URL(url1).pathname;
        const path2 = new URL(url2).pathname;
        return this.calculateTextSimilarity(path1, path2) * 0.8 + 0.2;
      }
      
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace non-alphanumeric with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text.split(/\s+/).filter(word => word.length > 2);
  }

  /**
   * Remove duplicates from existing job database
   */
  async removeDuplicatesFromDatabase(
    jobs: JobListing[],
    existingJobsProvider: (job: JobListing) => Promise<JobListing[]>
  ): Promise<JobListing[]> {
    const uniqueJobs: JobListing[] = [];

    for (const job of jobs) {
      // Get existing jobs that might be similar
      const existingJobs = await existingJobsProvider(job);
      
      const isDuplicate = existingJobs.some(existingJob => {
        const similarity = this.calculateSimilarity(job, existingJob);
        return similarity > 0.8; // 80% similarity threshold
      });

      if (!isDuplicate) {
        uniqueJobs.push(job);
      } else {
        logger.debug({ jobId: job.id, title: job.title }, 'Job marked as duplicate');
      }
    }

    logger.info({ 
      originalCount: jobs.length, 
      uniqueCount: uniqueJobs.length,
      duplicatesRemoved: jobs.length - uniqueJobs.length
    }, 'Database deduplication completed');

    return uniqueJobs;
  }

  /**
   * Group similar jobs together
   */
  groupSimilarJobs(jobs: JobListing[], similarityThreshold = 0.7): Array<{
    group: JobListing[];
    representative: JobListing;
  }> {
    const groups: Array<{ group: JobListing[]; representative: JobListing }> = [];
    const processed = new Set<string>();

    for (const job of jobs) {
      if (processed.has(job.id)) continue;

      const similarJobs = jobs.filter(otherJob => {
        if (otherJob.id === job.id || processed.has(otherJob.id)) return false;
        return this.calculateSimilarity(job, otherJob) >= similarityThreshold;
      });

      const group = [job, ...similarJobs];
      
      // Mark all jobs in this group as processed
      group.forEach(j => processed.add(j.id));

      // Choose representative (highest confidence or most recent)
      const representative = group.reduce((best, current) => {
        if (current.metadata.confidence > best.metadata.confidence) return current;
        if (current.metadata.confidence === best.metadata.confidence) {
          return current.source.scrapedAt > best.source.scrapedAt ? current : best;
        }
        return best;
      });

      groups.push({ group, representative });
    }

    return groups;
  }

  /**
   * Merge duplicate job information
   */
  mergeDuplicateJobs(primary: JobListing, duplicates: JobListing[]): JobListing {
    const merged = { ...primary };

    // Merge tags
    const allTags = new Set([...primary.tags, ...duplicates.flatMap(d => d.tags)]);
    merged.tags = Array.from(allTags);

    // Merge requirements (take longest list)
    const longestRequirements = [primary, ...duplicates]
      .reduce((longest, current) => 
        current.requirements.length > longest.requirements.length ? current : longest
      ).requirements;
    merged.requirements = longestRequirements;

    // Merge benefits (take longest list)
    const longestBenefits = [primary, ...duplicates]
      .reduce((longest, current) => 
        current.benefits.length > longest.benefits.length ? current : longest
      ).benefits;
    merged.benefits = longestBenefits;

    // Use the highest confidence
    merged.metadata.confidence = Math.max(
      primary.metadata.confidence,
      ...duplicates.map(d => d.metadata.confidence)
    );

    // Use the most complete description
    const longestDescription = [primary, ...duplicates]
      .reduce((longest, current) => 
        current.description.length > longest.description.length ? current : longest
      ).description;
    merged.description = longestDescription;

    // Use salary information if available
    const duplicateWithSalary = duplicates.find(d => d.salary);
    if (!merged.salary && duplicateWithSalary?.salary) {
      merged.salary = duplicateWithSalary.salary;
    }

    return merged;
  }
}

// Export singleton instance
export const jobDeduplicator = new JobDeduplicator();