// Job Alert Integration Service - connecting alerts with job scraping and notifications
import type { Alert, AlertCriteria, AlertService } from '../../services/alert-service.js';
import { type EmailService, User } from '../../services/email-service.js';
import {
  type WebPushNotificationService,
  pushNotificationService,
} from '../services/push-notification-service.js';

interface JobMatch {
  job: Job;
  alert: Alert;
  matchScore: number;
  matchReasons: string[];
}

interface Job {
  id: string;
  title: string;
  company: string;
  location?: string;
  salary?: string;
  description: string;
  url: string;
  postedDate: Date;
  jobType?: string;
  experienceLevel?: string;
  skills?: string[];
  companyLogo?: string;
  isRemote?: boolean;
}

interface AlertTriggerResult {
  alert: Alert;
  jobsFound: Job[];
  jobMatches: JobMatch[];
  delivered: boolean;
  deliveryMethod: 'email' | 'push' | 'both';
  error?: string;
}

interface JobSource {
  name: string;
  scraper: JobScraper;
  enabled: boolean;
  lastScrapeTime?: Date;
}

interface JobScraper {
  scrapeJobs(criteria: AlertCriteria): Promise<Job[]>;
  getSourceName(): string;
  isAvailable(): boolean;
}

export class JobAlertIntegrationService {
  private alertService: AlertService;
  private emailService: EmailService;
  private pushService: WebPushNotificationService;
  private jobSources: Map<string, JobSource> = new Map();
  private isProcessing = false;

  constructor(
    alertService: AlertService,
    emailService: EmailService,
    pushService: WebPushNotificationService,
  ) {
    this.alertService = alertService;
    this.emailService = emailService;
    this.pushService = pushService;
    this.initializeJobSources();
  }

  private initializeJobSources(): void {
    // Initialize job scrapers for different sources
    this.jobSources.set('linkedin', {
      name: 'LinkedIn',
      scraper: new LinkedInScraper(),
      enabled: true,
    });

    this.jobSources.set('indeed', {
      name: 'Indeed',
      scraper: new IndeedScraper(),
      enabled: true,
    });

    this.jobSources.set('glassdoor', {
      name: 'Glassdoor',
      scraper: new GlassdoorScraper(),
      enabled: true,
    });

    this.jobSources.set('monster', {
      name: 'Monster',
      scraper: new MonsterScraper(),
      enabled: true,
    });

    this.jobSources.set('stackoverflow', {
      name: 'Stack Overflow Jobs',
      scraper: new StackOverflowScraper(),
      enabled: true,
    });
  }

  async processAllAlerts(): Promise<AlertTriggerResult[]> {
    if (this.isProcessing) {
      return [];
    }

    this.isProcessing = true;
    const results: AlertTriggerResult[] = [];

    try {
      const activeAlerts = await this.alertService.getActiveAlerts();

      for (const alert of activeAlerts) {
        try {
          const result = await this.processAlert(alert);
          results.push(result);

          if (result.jobsFound.length > 0) {
          }
        } catch (error) {
          console.error(`❌ Failed to process alert "${alert.name}":`, error);
          results.push({
            alert,
            jobsFound: [],
            jobMatches: [],
            delivered: false,
            deliveryMethod: 'email',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      return results;
    } finally {
      this.isProcessing = false;
    }
  }

  async processAlert(alert: Alert): Promise<AlertTriggerResult> {
    // Check if alert should be triggered based on frequency
    if (!this.shouldTriggerAlert(alert)) {
      return {
        alert,
        jobsFound: [],
        jobMatches: [],
        delivered: false,
        deliveryMethod: 'email',
      };
    }

    // Scrape jobs from all enabled sources
    const allJobs = await this.scrapeJobsForAlert(alert);

    // Filter out jobs we've already seen for this alert
    const newJobs = await this.filterNewJobs(alert, allJobs);

    if (newJobs.length === 0) {
      await this.alertService.updateLastTriggered(alert.id);
      return {
        alert,
        jobsFound: [],
        jobMatches: [],
        delivered: false,
        deliveryMethod: 'email',
      };
    }

    // Calculate match scores for jobs
    const jobMatches = this.calculateJobMatches(newJobs, alert);

    // Sort jobs by match score (highest first)
    const sortedMatches = jobMatches.sort((a, b) => b.matchScore - a.matchScore);
    const topJobs = sortedMatches.slice(0, 50); // Limit to top 50 jobs

    // Store jobs in database for future reference
    await this.storeJobsForAlert(
      alert,
      topJobs.map((match) => match.job),
    );

    // Send notifications
    const delivered = await this.sendAlertNotifications(alert, topJobs);

    // Update alert's last triggered time
    await this.alertService.updateLastTriggered(alert.id);

    // Record delivery in database
    await this.alertService.recordDelivery(alert.id, {
      jobsFound: topJobs.length,
      deliveredAt: new Date(),
      deliveryStatus: delivered ? 'delivered' : 'failed',
      deliveryMethod: alert.user.pushEnabled ? 'both' : 'email',
    });

    return {
      alert,
      jobsFound: topJobs.map((match) => match.job),
      jobMatches: topJobs,
      delivered,
      deliveryMethod: alert.user.pushEnabled ? 'both' : 'email',
    };
  }

  private shouldTriggerAlert(alert: Alert): boolean {
    if (!alert.lastTriggered) {
      return true; // First time triggering
    }

    const now = new Date();
    const lastTriggered = new Date(alert.lastTriggered);
    const timeDiff = now.getTime() - lastTriggered.getTime();

    switch (alert.frequency) {
      case 'immediate':
        return timeDiff >= 5 * 60 * 1000; // 5 minutes minimum
      case 'hourly':
        return timeDiff >= 60 * 60 * 1000; // 1 hour
      case 'daily':
        return timeDiff >= 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return timeDiff >= 7 * 24 * 60 * 60 * 1000; // 7 days
      default:
        return false;
    }
  }

  private async scrapeJobsForAlert(alert: Alert): Promise<Job[]> {
    const allJobs: Job[] = [];
    const scrapePromises: Promise<Job[]>[] = [];

    for (const [_sourceId, source] of this.jobSources) {
      if (!source.enabled || !source.scraper.isAvailable()) {
        continue;
      }

      const promise = source.scraper
        .scrapeJobs(alert.criteria)
        .then((jobs) => {
          source.lastScrapeTime = new Date();
          return jobs;
        })
        .catch((error) => {
          console.error(`❌ Failed to scrape from ${source.name}:`, error);
          return [];
        });

      scrapePromises.push(promise);
    }

    const results = await Promise.all(scrapePromises);
    results.forEach((jobs) => allJobs.push(...jobs));

    // Remove duplicates based on job URL or title + company
    const uniqueJobs = this.removeDuplicateJobs(allJobs);

    return uniqueJobs;
  }

  private removeDuplicateJobs(jobs: Job[]): Job[] {
    const seen = new Set<string>();
    return jobs.filter((job) => {
      const key = job.url || `${job.title.toLowerCase()}-${job.company.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private async filterNewJobs(_alert: Alert, jobs: Job[]): Promise<Job[]> {
    // In a real implementation, this would check against a database
    // For now, we'll use a simple time-based filter
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // Only jobs from last 7 days

    return jobs.filter((job) => {
      return job.postedDate >= cutoffDate;
    });
  }

  private calculateJobMatches(jobs: Job[], alert: Alert): JobMatch[] {
    return jobs.map((job) => {
      const { score, reasons } = this.calculateMatchScore(job, alert.criteria);
      return {
        job,
        alert,
        matchScore: score,
        matchReasons: reasons,
      };
    });
  }

  private calculateMatchScore(
    job: Job,
    criteria: AlertCriteria,
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const maxScore = 100;

    // Keyword matching (40% of total score)
    if (criteria.keywords && criteria.keywords.length > 0) {
      const keywordScore = this.calculateKeywordScore(job, criteria.keywords);
      score += keywordScore.score * 0.4;
      if (keywordScore.matches.length > 0) {
        reasons.push(`Keywords: ${keywordScore.matches.join(', ')}`);
      }
    } else {
      score += 40; // Full score if no keywords specified
    }

    // Location matching (15% of total score)
    if (criteria.location) {
      const locationScore = this.calculateLocationScore(job, criteria.location);
      score += locationScore.score * 0.15;
      if (locationScore.matched) {
        reasons.push(`Location: ${job.location}`);
      }
    } else {
      score += 15; // Full score if no location specified
    }

    // Salary matching (20% of total score)
    if (criteria.salaryMin || criteria.salaryMax) {
      const salaryScore = this.calculateSalaryScore(job, criteria.salaryMin, criteria.salaryMax);
      score += salaryScore.score * 0.2;
      if (salaryScore.matched) {
        reasons.push(`Salary: ${job.salary}`);
      }
    } else {
      score += 20; // Full score if no salary specified
    }

    // Company matching (10% of total score)
    if (criteria.companies && criteria.companies.length > 0) {
      const companyScore = this.calculateCompanyScore(job, criteria.companies);
      score += companyScore.score * 0.1;
      if (companyScore.matched) {
        reasons.push(`Company: ${job.company}`);
      }
    } else {
      score += 10; // Full score if no companies specified
    }

    // Job type matching (10% of total score)
    if (criteria.jobTypes && criteria.jobTypes.length > 0) {
      const jobTypeScore = this.calculateJobTypeScore(job, criteria.jobTypes);
      score += jobTypeScore.score * 0.1;
      if (jobTypeScore.matched) {
        reasons.push(`Job Type: ${job.jobType}`);
      }
    } else {
      score += 10; // Full score if no job types specified
    }

    // Experience level matching (5% of total score)
    if (criteria.experienceLevel && criteria.experienceLevel.length > 0) {
      const experienceScore = this.calculateExperienceScore(job, criteria.experienceLevel);
      score += experienceScore.score * 0.05;
      if (experienceScore.matched) {
        reasons.push(`Experience: ${job.experienceLevel}`);
      }
    } else {
      score += 5; // Full score if no experience level specified
    }

    // Apply penalties for excluded keywords
    if (criteria.excludeKeywords && criteria.excludeKeywords.length > 0) {
      const exclusionPenalty = this.calculateExclusionPenalty(job, criteria.excludeKeywords);
      score -= exclusionPenalty.penalty;
      if (exclusionPenalty.excluded.length > 0) {
        reasons.push(`Excluded: ${exclusionPenalty.excluded.join(', ')}`);
      }
    }

    return {
      score: Math.max(0, Math.min(maxScore, Math.round(score))),
      reasons,
    };
  }

  private calculateKeywordScore(
    job: Job,
    keywords: string[],
  ): { score: number; matches: string[] } {
    const jobText = `${job.title} ${job.description} ${job.skills?.join(' ') || ''}`.toLowerCase();
    const matches: string[] = [];

    for (const keyword of keywords) {
      if (jobText.includes(keyword.toLowerCase())) {
        matches.push(keyword);
      }
    }

    const score = (matches.length / keywords.length) * 100;
    return { score, matches };
  }

  private calculateLocationScore(
    job: Job,
    targetLocation: string,
  ): { score: number; matched: boolean } {
    if (!job.location) {
      return { score: 50, matched: false }; // Neutral score for unknown location
    }

    const jobLocation = job.location.toLowerCase();
    const target = targetLocation.toLowerCase();

    if (target.includes('remote') && (jobLocation.includes('remote') || job.isRemote)) {
      return { score: 100, matched: true };
    }

    if (jobLocation.includes(target) || target.includes(jobLocation)) {
      return { score: 100, matched: true };
    }

    return { score: 0, matched: false };
  }

  private calculateSalaryScore(
    job: Job,
    minSalary?: number,
    maxSalary?: number,
  ): { score: number; matched: boolean } {
    if (!job.salary) {
      return { score: 50, matched: false }; // Neutral score for unknown salary
    }

    // Extract salary numbers from salary string
    const salaryNumbers = job.salary.match(/\d+/g);
    if (!salaryNumbers) {
      return { score: 50, matched: false };
    }

    const jobSalary = Number.parseInt(salaryNumbers[0]) * (job.salary.includes('k') ? 1000 : 1);

    let score = 100;
    let matched = true;

    if (minSalary && jobSalary < minSalary) {
      score = Math.max(0, 100 - ((minSalary - jobSalary) / minSalary) * 100);
      matched = false;
    }

    if (maxSalary && jobSalary > maxSalary) {
      score = Math.max(0, 100 - ((jobSalary - maxSalary) / maxSalary) * 100);
      matched = false;
    }

    return { score, matched };
  }

  private calculateCompanyScore(
    job: Job,
    targetCompanies: string[],
  ): { score: number; matched: boolean } {
    const jobCompany = job.company.toLowerCase();

    for (const company of targetCompanies) {
      if (
        jobCompany.includes(company.toLowerCase()) ||
        company.toLowerCase().includes(jobCompany)
      ) {
        return { score: 100, matched: true };
      }
    }

    return { score: 0, matched: false };
  }

  private calculateJobTypeScore(
    job: Job,
    targetTypes: string[],
  ): { score: number; matched: boolean } {
    if (!job.jobType) {
      return { score: 50, matched: false }; // Neutral score for unknown job type
    }

    const jobType = job.jobType.toLowerCase();

    for (const type of targetTypes) {
      if (jobType.includes(type.toLowerCase()) || type.toLowerCase().includes(jobType)) {
        return { score: 100, matched: true };
      }
    }

    return { score: 0, matched: false };
  }

  private calculateExperienceScore(
    job: Job,
    targetLevels: string[],
  ): { score: number; matched: boolean } {
    if (!job.experienceLevel) {
      return { score: 50, matched: false }; // Neutral score for unknown experience level
    }

    const jobLevel = job.experienceLevel.toLowerCase();

    for (const level of targetLevels) {
      if (jobLevel.includes(level.toLowerCase()) || level.toLowerCase().includes(jobLevel)) {
        return { score: 100, matched: true };
      }
    }

    return { score: 0, matched: false };
  }

  private calculateExclusionPenalty(
    job: Job,
    excludeKeywords: string[],
  ): { penalty: number; excluded: string[] } {
    const jobText = `${job.title} ${job.description} ${job.company}`.toLowerCase();
    const excluded: string[] = [];

    for (const keyword of excludeKeywords) {
      if (jobText.includes(keyword.toLowerCase())) {
        excluded.push(keyword);
      }
    }

    // Heavy penalty for excluded keywords
    const penalty = excluded.length * 25;
    return { penalty, excluded };
  }

  private async storeJobsForAlert(_alert: Alert, _jobs: Job[]): Promise<void> {}

  private async sendAlertNotifications(alert: Alert, jobMatches: JobMatch[]): Promise<boolean> {
    const jobs = jobMatches.map((match) => match.job);
    let emailSent = false;
    let pushSent = false;

    try {
      // Send email notification
      await this.emailService.sendJobAlert(alert.user, alert.name, jobs, alert.frequency);
      emailSent = true;
    } catch (error) {
      console.error(`❌ Failed to send email for alert "${alert.name}":`, error);
    }

    try {
      // Send push notification if enabled
      if (alert.user.pushEnabled) {
        await this.pushService.sendJobAlertNotification(
          alert.user.id,
          jobs.length,
          alert.name,
          jobs.slice(0, 3), // Include top 3 jobs
        );
        pushSent = true;

        // Send high-match notifications for top jobs
        const highMatchJobs = jobMatches.filter((match) => match.matchScore >= 85);
        for (const match of highMatchJobs.slice(0, 3)) {
          await this.pushService.sendJobMatchNotification(
            alert.user.id,
            match.job,
            match.matchScore,
          );
        }
      }
    } catch (error) {
      console.error(`❌ Failed to send push notification for alert "${alert.name}":`, error);
    }

    return emailSent || pushSent;
  }

  // Digest notifications
  async sendDailyDigests(): Promise<void> {
    const users = await this.alertService.getAllUsers();

    for (const user of users) {
      try {
        const dailyStats = await this.alertService.getUserDailyStats(user.id);

        if (dailyStats.totalJobs > 0) {
          // Send email digest
          await this.emailService.sendJobSummary(user, dailyStats.alerts, 'daily');

          // Send push digest
          if (user.pushEnabled) {
            await this.pushService.sendDigestNotification(
              user.id,
              'daily',
              dailyStats.totalJobs,
              dailyStats.alerts,
            );
          }
        }
      } catch (error) {
        console.error(`Failed to send daily digest for user ${user.email}:`, error);
      }
    }
  }

  async sendWeeklyDigests(): Promise<void> {
    const users = await this.alertService.getAllUsers();

    for (const user of users) {
      try {
        const weeklyStats = await this.alertService.getUserWeeklyStats(user.id);

        if (weeklyStats.totalJobs > 0) {
          // Send email digest
          await this.emailService.sendJobSummary(user, weeklyStats.alerts, 'weekly');

          // Send push digest
          if (user.pushEnabled) {
            await this.pushService.sendDigestNotification(
              user.id,
              'weekly',
              weeklyStats.totalJobs,
              weeklyStats.alerts,
            );
          }
        }
      } catch (error) {
        console.error(`Failed to send weekly digest for user ${user.email}:`, error);
      }
    }
  }

  // Test method for immediate alert processing
  async triggerAlertTest(alertId: string): Promise<AlertTriggerResult> {
    const alert = await this.alertService.getAlert(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }
    return await this.processAlert(alert);
  }

  // Get processing status
  getProcessingStatus(): { isProcessing: boolean; lastRun?: Date } {
    return {
      isProcessing: this.isProcessing,
      lastRun: undefined, // Would be stored in database
    };
  }
}

// Placeholder job scraper implementations
class LinkedInScraper implements JobScraper {
  async scrapeJobs(_criteria: AlertCriteria): Promise<Job[]> {
    // Placeholder implementation
    return [];
  }

  getSourceName(): string {
    return 'LinkedIn';
  }

  isAvailable(): boolean {
    return true;
  }
}

class IndeedScraper implements JobScraper {
  async scrapeJobs(_criteria: AlertCriteria): Promise<Job[]> {
    // Placeholder implementation
    return [];
  }

  getSourceName(): string {
    return 'Indeed';
  }

  isAvailable(): boolean {
    return true;
  }
}

class GlassdoorScraper implements JobScraper {
  async scrapeJobs(_criteria: AlertCriteria): Promise<Job[]> {
    // Placeholder implementation
    return [];
  }

  getSourceName(): string {
    return 'Glassdoor';
  }

  isAvailable(): boolean {
    return true;
  }
}

class MonsterScraper implements JobScraper {
  async scrapeJobs(_criteria: AlertCriteria): Promise<Job[]> {
    // Placeholder implementation
    return [];
  }

  getSourceName(): string {
    return 'Monster';
  }

  isAvailable(): boolean {
    return true;
  }
}

class StackOverflowScraper implements JobScraper {
  async scrapeJobs(_criteria: AlertCriteria): Promise<Job[]> {
    // Placeholder implementation
    return [];
  }

  getSourceName(): string {
    return 'Stack Overflow Jobs';
  }

  isAvailable(): boolean {
    return true;
  }
}

export { JobAlertIntegrationService, type Job, type JobMatch, type AlertTriggerResult };
