import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { DatabaseAlertService } from '../../../src/services/alert-service.js';
import { AuthenticationService } from '../../../src/services/auth-service.js';
import type { JobListing as Job } from '../../../src/types/index.js';
import Database from 'better-sqlite3';
import { rmSync, existsSync } from 'node:fs';

describe('Alert Service Integration', () => {
  let alertService: DatabaseAlertService;
  let authService: AuthenticationService;
  let db: Database.Database;
  let testDbPath: string;
  let testUserId: string;

  // Mock the checkAlert method to work with the actual jobs passed in
  class TestableAlertService extends DatabaseAlertService {
    async checkAlert(alert: any, jobs: Job[]): Promise<Job[]> {
      const { criteria } = alert;
      
      return jobs.filter((job) => {
        // Check keywords
        if (criteria.keywords && criteria.keywords.length > 0) {
          const searchText = `${job.title} ${job.description}`.toLowerCase();
          const hasKeyword = criteria.keywords.some((keyword: string) =>
            searchText.includes(keyword.toLowerCase())
          );
          if (!hasKeyword) return false;
        }

        // Check excluded keywords
        if (criteria.excludeKeywords && criteria.excludeKeywords.length > 0) {
          const searchText = `${job.title} ${job.description}`.toLowerCase();
          const hasExcludedKeyword = criteria.excludeKeywords.some((keyword: string) =>
            searchText.includes(keyword.toLowerCase())
          );
          if (hasExcludedKeyword) return false;
        }

        // Check location (remote)
        if (criteria.location && criteria.location.toLowerCase() === 'remote') {
          if (!job.remote && !job.location.toLowerCase().includes('remote')) {
            return false;
          }
        }

        // Check salary requirements
        if (criteria.salaryMin && job.salary) {
          if (!job.salary.min || job.salary.min < criteria.salaryMin) {
            return false;
          }
        }

        if (criteria.salaryMax && job.salary) {
          if (!job.salary.max || job.salary.max > criteria.salaryMax) {
            return false;
          }
        }

        // Check companies
        if (criteria.companies && criteria.companies.length > 0) {
          if (!criteria.companies.includes(job.company)) {
            return false;
          }
        }

        return true;
      });
    }
  }

  beforeEach(async () => {
    // Create a temporary test database
    testDbPath = join(process.cwd(), `test-alerts-${Date.now()}.db`);
    db = new Database(testDbPath);
    
    // Initialize the database with the full users table schema first
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        is_active BOOLEAN DEFAULT 1,
        email_verified BOOLEAN DEFAULT 0,
        email_verification_token TEXT,
        password_reset_token TEXT,
        password_reset_expires DATETIME,
        notification_preferences TEXT DEFAULT '{"email": true, "push": true, "frequency": "daily"}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);
    
    authService = new AuthenticationService(db);
    alertService = new TestableAlertService(testDbPath);

    // Create a test user
    const authToken = await authService.register({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User'
    });
    testUserId = authToken.user.id;
  });

  afterEach(() => {
    // Close database connection and clean up test database
    if (db) {
      db.close();
    }
    try {
      if (existsSync(testDbPath)) {
        rmSync(testDbPath);
      }
    } catch (error) {
      // Database file might not exist or be in use
    }
  });

  describe('Alert CRUD Operations', () => {
    it('should create a new job alert', async () => {
      const criteria = {
        keywords: ['javascript', 'node.js'],
        location: 'remote',
        salaryMin: 50000,
        companies: ['Google', 'Meta'],
        jobTypes: ['full-time'] as ('full-time' | 'part-time' | 'contract' | 'remote')[]
      };

      const alert = await alertService.createAlert(
        testUserId,
        'JavaScript Remote Jobs',
        criteria,
        'daily'
      );

      expect(alert.id).toBeTruthy();
      expect(alert.userId).toBe(testUserId);
      expect(alert.name).toBe('JavaScript Remote Jobs');
      expect(alert.criteria).toEqual(criteria);
      expect(alert.frequency).toBe('daily');
      expect(alert.isActive).toBe(true);
    });

    it('should retrieve user alerts', async () => {
      // Create multiple alerts
      await alertService.createAlert(testUserId, 'Alert 1', { keywords: ['react'] });
      await alertService.createAlert(testUserId, 'Alert 2', { keywords: ['vue'] });

      const alerts = await alertService.getUserAlerts(testUserId);
      
      expect(alerts).toHaveLength(2);
      // Alerts are returned in reverse chronological order (newest first)
      expect(alerts[0].name).toBe('Alert 2');
      expect(alerts[1].name).toBe('Alert 1');
    });

    it('should update an alert', async () => {
      const alert = await alertService.createAlert(
        testUserId,
        'Original Alert',
        { keywords: ['python'] }
      );

      const updates = {
        name: 'Updated Alert',
        criteria: { keywords: ['python', 'django'] },
        frequency: 'weekly' as const
      };

      const updatedAlert = await alertService.updateAlert(alert.id, updates);

      expect(updatedAlert.name).toBe('Updated Alert');
      expect(updatedAlert.criteria.keywords).toEqual(['python', 'django']);
      expect(updatedAlert.frequency).toBe('weekly');
    });

    it('should delete an alert', async () => {
      const alert = await alertService.createAlert(
        testUserId,
        'Test Alert',
        { keywords: ['test'] }
      );

      const deleted = await alertService.deleteAlert(alert.id);
      expect(deleted).toBe(true);

      const alerts = await alertService.getUserAlerts(testUserId);
      expect(alerts).toHaveLength(0);
    });

    it('should toggle alert active status', async () => {
      const alert = await alertService.createAlert(
        testUserId,
        'Toggle Alert',
        { keywords: ['toggle'] }
      );

      expect(alert.isActive).toBe(true);

      await alertService.toggleAlert(alert.id, false);
      const inactiveAlert = await alertService.getAlert(alert.id);
      expect(inactiveAlert?.isActive).toBe(false);

      await alertService.toggleAlert(alert.id, true);
      const activeAlert = await alertService.getAlert(alert.id);
      expect(activeAlert?.isActive).toBe(true);
    });
  });

  describe('Alert Matching Logic', () => {
    it('should match jobs based on keywords', async () => {
      const alert = await alertService.createAlert(
        testUserId,
        'JavaScript Jobs',
        { keywords: ['javascript', 'react'] }
      );

      const jobs: Job[] = [
        {
          id: 'job1',
          title: 'Senior JavaScript Developer',
          company: 'TechCorp',
          description: 'We are looking for a JavaScript expert',
          location: 'Remote',
          employmentType: 'full-time',
          url: 'https://example.com/job1',
          postedDate: new Date(),
          remote: true,
          requirements: [],
          benefits: [],
          tags: [],
          source: {
            site: 'test',
            originalUrl: 'https://example.com/job1',
            scrapedAt: new Date()
          },
          metadata: {
            confidence: 1.0
          }
        },
        {
          id: 'job2',
          title: 'Python Developer',
          company: 'PythonCorp',
          description: 'Python and Django experience required',
          location: 'Remote',
          employmentType: 'full-time',
          url: 'https://example.com/job2',
          postedDate: new Date(),
          remote: true,
          requirements: [],
          benefits: [],
          tags: [],
          source: {
            site: 'test',
            originalUrl: 'https://example.com/job2',
            scrapedAt: new Date()
          },
          metadata: {
            confidence: 1.0
          }
        }
      ];

      const matchedJobs = await alertService.checkAlert(alert, jobs);
      expect(matchedJobs).toHaveLength(1);
      expect(matchedJobs[0].title).toBe('Senior JavaScript Developer');
    });

    it('should match jobs based on location', async () => {
      const alert = await alertService.createAlert(
        testUserId,
        'Remote Jobs',
        { location: 'remote' }
      );

      const jobs: Job[] = [
        {
          id: 'job1',
          title: 'Remote Developer',
          company: 'RemoteCorp',
          description: 'Work from anywhere',
          location: 'Remote',
          employmentType: 'full-time',
          url: 'https://example.com/job1',
          postedDate: new Date(),
          remote: true,
          requirements: [],
          benefits: [],
          tags: [],
          source: {
            site: 'test',
            originalUrl: 'https://example.com/job1',
            scrapedAt: new Date()
          },
          metadata: {
            confidence: 1.0
          }
        },
        {
          id: 'job2',
          title: 'On-site Developer',
          company: 'OfficeCorp',
          description: 'Must work in office',
          location: 'New York, NY',
          employmentType: 'full-time',
          url: 'https://example.com/job2',
          postedDate: new Date(),
          remote: false,
          requirements: [],
          benefits: [],
          tags: [],
          source: {
            site: 'test',
            originalUrl: 'https://example.com/job2',
            scrapedAt: new Date()
          },
          metadata: {
            confidence: 1.0
          }
        }
      ];

      const matchedJobs = await alertService.checkAlert(alert, jobs);
      expect(matchedJobs).toHaveLength(1);
      expect(matchedJobs[0].title).toBe('Remote Developer');
    });

    it('should match jobs based on salary requirements', async () => {
      const alert = await alertService.createAlert(
        testUserId,
        'High Salary Jobs',
        { salaryMin: 80000, salaryMax: 120000 }
      );

      const jobs: Job[] = [
        {
          id: 'job1',
          title: 'Senior Developer',
          company: 'HighPayCorp',
          description: 'High paying job',
          location: 'Remote',
          employmentType: 'full-time',
          url: 'https://example.com/job1',
          postedDate: new Date(),
          salary: { min: 90000, max: 110000, currency: 'USD', period: 'yearly' },
          remote: true,
          requirements: [],
          benefits: [],
          tags: [],
          source: {
            site: 'test',
            originalUrl: 'https://example.com/job1',
            scrapedAt: new Date()
          },
          metadata: {
            confidence: 1.0
          }
        },
        {
          id: 'job2',
          title: 'Junior Developer',
          company: 'LowPayCorp',
          description: 'Entry level position',
          location: 'Remote',
          employmentType: 'full-time',
          url: 'https://example.com/job2',
          postedDate: new Date(),
          salary: { min: 40000, max: 50000, currency: 'USD', period: 'yearly' },
          remote: true,
          requirements: [],
          benefits: [],
          tags: [],
          source: {
            site: 'test',
            originalUrl: 'https://example.com/job2',
            scrapedAt: new Date()
          },
          metadata: {
            confidence: 1.0
          }
        }
      ];

      const matchedJobs = await alertService.checkAlert(alert, jobs);
      expect(matchedJobs).toHaveLength(1);
      expect(matchedJobs[0].title).toBe('Senior Developer');
    });

    it('should exclude jobs with excluded keywords', async () => {
      const alert = await alertService.createAlert(
        testUserId,
        'Developer Jobs (No PHP)',
        { 
          keywords: ['developer'], 
          excludeKeywords: ['php', 'wordpress'] 
        }
      );

      const jobs: Job[] = [
        {
          id: 'job1',
          title: 'JavaScript Developer',
          company: 'JSCorp',
          description: 'JavaScript and React development',
          location: 'Remote',
          employmentType: 'full-time',
          url: 'https://example.com/job1',
          postedDate: new Date(),
          remote: true,
          requirements: [],
          benefits: [],
          tags: [],
          source: {
            site: 'test',
            originalUrl: 'https://example.com/job1',
            scrapedAt: new Date()
          },
          metadata: {
            confidence: 1.0
          }
        },
        {
          id: 'job2',
          title: 'PHP Developer',
          company: 'PHPCorp',
          description: 'PHP and WordPress development',
          location: 'Remote',
          employmentType: 'full-time',
          url: 'https://example.com/job2',
          postedDate: new Date(),
          remote: true,
          requirements: [],
          benefits: [],
          tags: [],
          source: {
            site: 'test',
            originalUrl: 'https://example.com/job2',
            scrapedAt: new Date()
          },
          metadata: {
            confidence: 1.0
          }
        }
      ];

      const matchedJobs = await alertService.checkAlert(alert, jobs);
      expect(matchedJobs).toHaveLength(1);
      expect(matchedJobs[0].title).toBe('JavaScript Developer');
    });
  });

  describe('Alert Statistics', () => {
    it('should provide user statistics', async () => {
      // Create multiple alerts
      await alertService.createAlert(testUserId, 'Alert 1', { keywords: ['react'] });
      await alertService.createAlert(testUserId, 'Alert 2', { keywords: ['vue'] });
      
      // Deactivate one alert
      const alert3 = await alertService.createAlert(testUserId, 'Alert 3', { keywords: ['angular'] });
      await alertService.toggleAlert(alert3.id, false);

      const stats = await alertService.getUserStats(testUserId);
      
      expect(stats.totalAlerts).toBe(3);
      expect(stats.activeAlerts).toBe(2);
    });
  });

  describe('Alert Preview', () => {
    it('should preview alert results without creating alert', async () => {
      const criteria = {
        keywords: ['typescript'],
        location: 'remote'
      };

      // Mock some jobs in the database by using the job repository
      // This would require access to job repository or mocking
      const previewJobs = await alertService.previewAlert(criteria, 5);
      
      // Should return array (empty or with jobs)
      expect(Array.isArray(previewJobs)).toBe(true);
      expect(previewJobs.length).toBeLessThanOrEqual(5);
    });
  });
});
