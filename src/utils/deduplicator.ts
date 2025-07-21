import type { JobListing } from '@/types/index.js';
import { logger } from '@/utils/logger.js';

/**
 * Configuration for job deduplication
 */
export interface DeduplicationConfig {
  titleSimilarityThreshold: number; // 0.8 = 80% similarity
  companySimilarityThreshold: number;
  locationSimilarityThreshold: number;
  urlExactMatch: boolean;
  considerSalary: boolean;
  considerDescription: boolean;
  descriptionSimilarityThreshold: number;
}

/**
 * Default configuration for job deduplication
 */
export const DEFAULT_DEDUP_CONFIG: DeduplicationConfig = {
  titleSimilarityThreshold: 0.85,
  companySimilarityThreshold: 0.9,
  locationSimilarityThreshold: 0.85,
  urlExactMatch: true,
  considerSalary: false,
  considerDescription: false,
  descriptionSimilarityThreshold: 0.7,
};

/**
 * Job deduplication utility using fuzzy matching and various heuristics
 */
export class JobDeduplicator {
  private config: DeduplicationConfig;

  constructor(config: Partial<DeduplicationConfig> = {}) {
    this.config = { ...DEFAULT_DEDUP_CONFIG, ...config };
  }

  /**
   * Remove duplicate jobs from a list
   */
  deduplicate(jobs: JobListing[]): {
    unique: JobListing[];
    duplicates: Array<{ original: JobListing; duplicate: JobListing; similarity: number }>;
  } {
    const unique: JobListing[] = [];
    const duplicates: Array<{ original: JobListing; duplicate: JobListing; similarity: number }> =
      [];

    logger.info({ totalJobs: jobs.length }, 'Starting job deduplication');

    for (const job of jobs) {
      let isDuplicate = false;
      let bestMatch: { job: JobListing; similarity: number } | null = null;

      for (const existingJob of unique) {
        const similarity = this.calculateSimilarity(job, existingJob);

        if (similarity > 0.8) {
          // High confidence threshold
          isDuplicate = true;
          bestMatch = { job: existingJob, similarity };
          break;
        }

        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { job: existingJob, similarity };
        }
      }

      if (isDuplicate && bestMatch) {
        duplicates.push({
          original: bestMatch.job,
          duplicate: job,
          similarity: bestMatch.similarity,
        });

        // Merge metadata from duplicate into original
        this.mergeJobData(bestMatch.job, job);
      } else {
        unique.push(job);
      }
    }

    logger.info(
      {
        originalCount: jobs.length,
        uniqueCount: unique.length,
        duplicatesCount: duplicates.length,
      },
      'Job deduplication completed',
    );

    return { unique, duplicates };
  }

  /**
   * Calculate similarity between two jobs
   */
  private calculateSimilarity(job1: JobListing, job2: JobListing): number {
    const scores: number[] = [];

    // Exact URL match (highest priority)
    if (this.config.urlExactMatch && job1.url && job2.url) {
      if (this.normalizeUrl(job1.url) === this.normalizeUrl(job2.url)) {
        return 1.0; // Perfect match
      }
    }

    // Title similarity
    const titleSim = this.calculateStringSimilarity(
      this.normalizeTitle(job1.title),
      this.normalizeTitle(job2.title),
    );
    if (titleSim >= this.config.titleSimilarityThreshold) {
      scores.push(titleSim * 0.4); // 40% weight
    }

    // Company similarity
    const companySim = this.calculateStringSimilarity(
      this.normalizeCompany(job1.company),
      this.normalizeCompany(job2.company),
    );
    if (companySim >= this.config.companySimilarityThreshold) {
      scores.push(companySim * 0.3); // 30% weight
    }

    // Location similarity
    const locationSim = this.calculateStringSimilarity(
      this.normalizeLocation(job1.location),
      this.normalizeLocation(job2.location),
    );
    if (locationSim >= this.config.locationSimilarityThreshold) {
      scores.push(locationSim * 0.2); // 20% weight
    }

    // Description similarity (if enabled)
    if (this.config.considerDescription && job1.description && job2.description) {
      const descSim = this.calculateStringSimilarity(
        this.normalizeDescription(job1.description),
        this.normalizeDescription(job2.description),
      );
      if (descSim >= this.config.descriptionSimilarityThreshold) {
        scores.push(descSim * 0.1); // 10% weight
      }
    }

    // Must have at least title + company similarity
    if (scores.length < 2) {
      return 0;
    }

    return scores.reduce((sum, score) => sum + score, 0);
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0;

    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    const maxLength = Math.max(str1.length, str2.length);
    const distance = matrix[str2.length][str1.length];

    return (maxLength - distance) / maxLength;
  }

  /**
   * Normalize job title for comparison
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\b(jr|sr|senior|junior|lead|principal)\b/g, '') // Remove seniority indicators
      .replace(/\b(i|ii|iii|iv|v)\b/g, '') // Remove roman numerals
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Normalize company name for comparison
   */
  private normalizeCompany(company: string): string {
    return company
      .toLowerCase()
      .replace(/\b(inc|llc|ltd|corp|corporation|company|co|llp)\b\.?/g, '') // Remove legal entities
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize location for comparison
   */
  private normalizeLocation(location: string): string {
    return location
      .toLowerCase()
      .replace(/\b(remote|hybrid|on-site|onsite)\b/g, '') // Remove work type
      .replace(/\b(usa|us|united states)\b/g, 'united states') // Normalize country
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize description for comparison
   */
  private normalizeDescription(description: string): string {
    return description
      .toLowerCase()
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500); // Only compare first 500 characters
  }

  /**
   * Normalize URL for comparison
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove tracking parameters
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'source'];

      for (const param of paramsToRemove) {
        parsed.searchParams.delete(param);
      }

      return parsed.toString();
    } catch {
      return url.toLowerCase();
    }
  }

  /**
   * Merge data from duplicate job into original
   */
  private mergeJobData(original: JobListing, duplicate: JobListing): void {
    // Update confidence score
    if (original.metadata.confidence < duplicate.metadata.confidence) {
      original.metadata.confidence = duplicate.metadata.confidence;
    }

    // Merge sources
    if (!original.metadata.rawData) {
      original.metadata.rawData = {};
    }

    const sources = (original.metadata.rawData.sources as string[]) || [original.source.site];
    if (!sources.includes(duplicate.source.site)) {
      sources.push(duplicate.source.site);
      original.metadata.rawData.sources = sources;
    }

    // Keep the most complete data
    if (!original.description && duplicate.description) {
      original.description = duplicate.description;
    }

    if (!original.salary && duplicate.salary) {
      original.salary = duplicate.salary;
    }

    if (original.requirements.length === 0 && duplicate.requirements.length > 0) {
      original.requirements = duplicate.requirements;
    }

    if (original.benefits.length === 0 && duplicate.benefits.length > 0) {
      original.benefits = duplicate.benefits;
    }

    // Merge tags
    const allTags = [...original.tags, ...duplicate.tags];
    original.tags = [...new Set(allTags)];

    // Use the most recent posted date
    if (
      duplicate.postedDate &&
      (!original.postedDate || duplicate.postedDate > original.postedDate)
    ) {
      original.postedDate = duplicate.postedDate;
    }
  }

  /**
   * Generate hash for quick duplicate detection
   */
  generateJobHash(job: JobListing): string {
    const normalized = {
      title: this.normalizeTitle(job.title),
      company: this.normalizeCompany(job.company),
      location: this.normalizeLocation(job.location),
    };

    const hashString = `${normalized.title}|${normalized.company}|${normalized.location}`;

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < hashString.length; i++) {
      const char = hashString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Fast deduplication using hashes (for large datasets)
   */
  fastDeduplicate(jobs: JobListing[]): JobListing[] {
    const seen = new Set<string>();
    const unique: JobListing[] = [];

    for (const job of jobs) {
      const hash = this.generateJobHash(job);

      if (!seen.has(hash)) {
        seen.add(hash);
        unique.push(job);
      }
    }

    logger.info(
      {
        originalCount: jobs.length,
        uniqueCount: unique.length,
        duplicatesRemoved: jobs.length - unique.length,
      },
      'Fast deduplication completed',
    );

    return unique;
  }
}
