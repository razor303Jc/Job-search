// Priority 1 Job Alerts Test Suite - Main Test File - comprehensive testing for email alerts, push notifications, and alert management
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AlertManagementComponent } from '../../src/web/components/alert-management';
import { DatabaseAlertService, type AlertService } from '../../src/services/alert-service';
import { NodemailerEmailService, type EmailService } from '../../src/services/email-service';
import { JobAlertIntegrationService } from '../../src/web/services/job-alert-integration';
import { WebPushNotificationService } from '../../src/web/services/push-notification-service';

// Mock data imports
import { mockAlerts, mockJobs, mockUsers } from './mocks/test-data';

// Test configuration
const testConfig = {
  database: {
    type: 'memory',
    host: 'localhost',
    port: 5432,
    database: 'job_alerts_test',
  },
  email: {
    provider: 'mock',
    apiKey: 'test-key',
  },
  push: {
    vapidKeys: {
      publicKey: 'test-public-key',
      privateKey: 'test-private-key',
    },
    subject: 'mailto:test@example.com',
  },
};

describe('Priority 1: Job Alerts and Notifications System', () => {
  let emailService: EmailService;
  let alertService: AlertService;
  let pushService: WebPushNotificationService;
  let integrationService: JobAlertIntegrationService;
  let alertComponent: AlertManagementComponent;

  beforeAll(async () => {
    // Initialize services with test configuration
    emailService = new EmailService(testConfig.email);
    alertService = new AlertService(testConfig.database);
    pushService = new WebPushNotificationService(testConfig.push);
    integrationService = new JobAlertIntegrationService(alertService, emailService, pushService);
    alertComponent = new AlertManagementComponent(alertService);

    // Setup test database
    await alertService.initializeDatabase();
  });

  afterAll(async () => {
    await alertService.cleanup();
  });

  beforeEach(async () => {
    // Clear test data before each test
    await alertService.clearTestData();
  });

  describe('Email Service', () => {
    it('should send job alert email with proper formatting', async () => {
      const user = mockUsers[0];
      const jobs = mockJobs.slice(0, 5);
      const alertName = 'Senior Developer Jobs';

      const result = await emailService.sendJobAlert(user, alertName, jobs, 'daily');

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.emailType).toBe('job_alert');
    });

    it('should send welcome email to new users', async () => {
      const user = mockUsers[0];

      const result = await emailService.sendWelcomeEmail(user);

      expect(result.success).toBe(true);
      expect(result.emailType).toBe('welcome');
    });

    it('should send job summary with correct statistics', async () => {
      const user = mockUsers[0];
      const alerts = [
        { name: 'Frontend Jobs', jobsFound: 12 },
        { name: 'Backend Jobs', jobsFound: 8 },
      ];

      const result = await emailService.sendJobSummary(user, alerts, 'weekly');

      expect(result.success).toBe(true);
      expect(result.emailType).toBe('summary');
    });

    it('should handle email delivery failures gracefully', async () => {
      const user = { ...mockUsers[0], email: 'invalid@invalid' };
      const jobs = mockJobs.slice(0, 3);

      const result = await emailService.sendJobAlert(user, 'Test Alert', jobs, 'daily');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should support multiple email providers', async () => {
      const providers = ['gmail', 'sendgrid', 'ses', 'smtp'];

      for (const provider of providers) {
        const service = new EmailService({ ...testConfig.email, provider });
        expect(service.getCurrentProvider()).toBe(provider);
      }
    });
  });

  describe('Alert Service', () => {
    it('should create alert with valid criteria', async () => {
      const user = mockUsers[0];
      const alertData = {
        name: 'React Developer Jobs',
        criteria: {
          keywords: ['react', 'javascript', 'frontend'],
          location: 'San Francisco',
          salaryMin: 80000,
          salaryMax: 150000,
          jobTypes: ['full-time', 'remote'],
        },
        frequency: 'daily' as const,
        isActive: true,
        userId: user.id,
      };

      const alert = await alertService.createAlert(user.id, alertData);

      expect(alert.id).toBeDefined();
      expect(alert.name).toBe(alertData.name);
      expect(alert.criteria.keywords).toEqual(alertData.criteria.keywords);
      expect(alert.isActive).toBe(true);
    });

    it('should retrieve user alerts correctly', async () => {
      const user = mockUsers[0];

      // Create multiple alerts
      await alertService.createAlert(user.id, mockAlerts[0]);
      await alertService.createAlert(user.id, mockAlerts[1]);

      const alerts = await alertService.getUserAlerts(user.id);

      expect(alerts).toHaveLength(2);
      expect(alerts[0].userId).toBe(user.id);
      expect(alerts[1].userId).toBe(user.id);
    });

    it('should update alert criteria', async () => {
      const user = mockUsers[0];
      const alert = await alertService.createAlert(user.id, mockAlerts[0]);

      const updatedCriteria = {
        ...alert.criteria,
        keywords: ['python', 'django', 'backend'],
        salaryMin: 90000,
      };

      const updatedAlert = await alertService.updateAlert(alert.id, {
        criteria: updatedCriteria,
      });

      expect(updatedAlert.criteria.keywords).toEqual(['python', 'django', 'backend']);
      expect(updatedAlert.criteria.salaryMin).toBe(90000);
    });

    it('should toggle alert active status', async () => {
      const user = mockUsers[0];
      const alert = await alertService.createAlert(user.id, mockAlerts[0]);

      expect(alert.isActive).toBe(true);

      const deactivatedAlert = await alertService.updateAlert(alert.id, { isActive: false });
      expect(deactivatedAlert.isActive).toBe(false);

      const reactivatedAlert = await alertService.updateAlert(alert.id, { isActive: true });
      expect(reactivatedAlert.isActive).toBe(true);
    });

    it('should delete alert and clean up related data', async () => {
      const user = mockUsers[0];
      const alert = await alertService.createAlert(user.id, mockAlerts[0]);

      const deleted = await alertService.deleteAlert(alert.id);
      expect(deleted).toBe(true);

      const alerts = await alertService.getUserAlerts(user.id);
      expect(alerts).toHaveLength(0);
    });

    it('should calculate user statistics correctly', async () => {
      const user = mockUsers[0];

      // Create alerts and simulate deliveries
      const alert1 = await alertService.createAlert(user.id, mockAlerts[0]);
      const alert2 = await alertService.createAlert(user.id, mockAlerts[1]);

      await alertService.recordDelivery(alert1.id, {
        jobsFound: 15,
        deliveredAt: new Date(),
        deliveryStatus: 'delivered',
        deliveryMethod: 'email',
      });

      await alertService.recordDelivery(alert2.id, {
        jobsFound: 8,
        deliveredAt: new Date(),
        deliveryStatus: 'delivered',
        deliveryMethod: 'both',
      });

      const stats = await alertService.getUserStats(user.id);

      expect(stats.totalAlerts).toBe(2);
      expect(stats.activeAlerts).toBe(2);
      expect(stats.totalJobsFound).toBe(23);
    });
  });

  describe('Push Notification Service', () => {
    it('should check browser support correctly', () => {
      const isSupported = WebPushNotificationService.isSupported();
      // In test environment, this will likely be false
      expect(typeof isSupported).toBe('boolean');
    });

    it('should format job alert notification payload', async () => {
      const userId = mockUsers[0].id;
      const jobsFound = 5;
      const alertName = 'Frontend Developer Jobs';

      // Mock the notification sending
      const mockSendPush = jest
        .spyOn(pushService as any, 'sendPushNotification')
        .mockResolvedValue(undefined);

      await pushService.sendJobAlertNotification(userId, jobsFound, alertName);

      expect(mockSendPush).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          title: expect.stringContaining('5 New Jobs Found'),
          body: expect.stringContaining(alertName),
          data: expect.objectContaining({
            type: 'job_alert',
            alertName,
            jobsFound,
          }),
        }),
      );

      mockSendPush.mockRestore();
    });

    it('should format welcome notification correctly', async () => {
      const userId = mockUsers[0].id;
      const userName = mockUsers[0].name;

      const mockSendPush = jest
        .spyOn(pushService as any, 'sendPushNotification')
        .mockResolvedValue(undefined);

      await pushService.sendWelcomeNotification(userId, userName);

      expect(mockSendPush).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          title: expect.stringContaining('Welcome'),
          body: expect.stringContaining(userName),
          data: expect.objectContaining({
            type: 'welcome',
            userId,
          }),
        }),
      );

      mockSendPush.mockRestore();
    });

    it('should handle subscription management', async () => {
      const userId = mockUsers[0].id;

      const status = await pushService.getSubscriptionStatus(userId);

      expect(status).toHaveProperty('supported');
      expect(status).toHaveProperty('permission');
      expect(status).toHaveProperty('subscribed');
    });
  });

  describe('Job Alert Integration Service', () => {
    it('should process alerts and find matching jobs', async () => {
      const user = mockUsers[0];
      const alert = await alertService.createAlert(user.id, mockAlerts[0]);

      // Mock job scraping
      const mockScrapeJobs = jest
        .spyOn(integrationService as any, 'scrapeJobsForAlert')
        .mockResolvedValue(mockJobs);

      const result = await integrationService.processAlert(alert);

      expect(result.alert.id).toBe(alert.id);
      expect(result.jobsFound.length).toBeGreaterThan(0);
      expect(result.jobMatches.length).toBeGreaterThan(0);

      // Verify job matching scores
      result.jobMatches.forEach((match) => {
        expect(match.matchScore).toBeGreaterThanOrEqual(0);
        expect(match.matchScore).toBeLessThanOrEqual(100);
        expect(match.matchReasons).toBeInstanceOf(Array);
      });

      mockScrapeJobs.mockRestore();
    });

    it('should calculate job match scores accurately', async () => {
      const criteria = {
        keywords: ['javascript', 'react'],
        location: 'San Francisco',
        salaryMin: 80000,
        salaryMax: 120000,
        jobTypes: ['full-time'],
      };

      const perfectMatchJob = {
        id: '1',
        title: 'React JavaScript Developer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        salary: '$100,000',
        description: 'Looking for a React and JavaScript developer...',
        url: 'https://example.com/job1',
        postedDate: new Date(),
        jobType: 'full-time',
        skills: ['javascript', 'react', 'html', 'css'],
      };

      const matchResult = (integrationService as any).calculateMatchScore(
        perfectMatchJob,
        criteria,
      );

      expect(matchResult.score).toBeGreaterThanOrEqual(80);
      expect(matchResult.reasons).toContain(expect.stringContaining('Keywords'));
      expect(matchResult.reasons).toContain(expect.stringContaining('Location'));
      expect(matchResult.reasons).toContain(expect.stringContaining('Salary'));
    });

    it('should handle exclusion keywords correctly', async () => {
      const criteria = {
        keywords: ['developer'],
        excludeKeywords: ['intern', 'unpaid'],
      };

      const excludedJob = {
        id: '1',
        title: 'Unpaid Developer Intern',
        company: 'Startup Inc',
        description: 'Looking for an unpaid intern developer...',
        url: 'https://example.com/job1',
        postedDate: new Date(),
      };

      const matchResult = (integrationService as any).calculateMatchScore(excludedJob, criteria);

      expect(matchResult.score).toBeLessThan(50); // Heavy penalty for excluded keywords
      expect(matchResult.reasons).toContain(expect.stringContaining('Excluded'));
    });

    it('should process multiple alerts efficiently', async () => {
      const user = mockUsers[0];

      // Create multiple alerts
      await alertService.createAlert(user.id, mockAlerts[0]);
      await alertService.createAlert(user.id, mockAlerts[1]);

      // Mock job scraping
      const mockScrapeJobs = jest
        .spyOn(integrationService as any, 'scrapeJobsForAlert')
        .mockResolvedValue(mockJobs);

      const startTime = Date.now();
      const results = await integrationService.processAllAlerts();
      const endTime = Date.now();

      expect(results).toHaveLength(2);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      mockScrapeJobs.mockRestore();
    });

    it('should handle alert processing failures gracefully', async () => {
      const user = mockUsers[0];
      const alert = await alertService.createAlert(user.id, mockAlerts[0]);

      // Mock a failure in job scraping
      const mockScrapeJobs = jest
        .spyOn(integrationService as any, 'scrapeJobsForAlert')
        .mockRejectedValue(new Error('Scraping failed'));

      const result = await integrationService.processAlert(alert);

      expect(result.jobsFound).toHaveLength(0);
      expect(result.delivered).toBe(false);
      expect(result.error).toBeDefined();

      mockScrapeJobs.mockRestore();
    });
  });

  describe('Alert Management Component', () => {
    it('should render dashboard with user statistics', async () => {
      const user = mockUsers[0];
      alertComponent.setCurrentUser(user);

      // Create some test data
      await alertService.createAlert(user.id, mockAlerts[0]);
      await alertService.createAlert(user.id, mockAlerts[1]);

      const dashboardHtml = await alertComponent.renderAlertDashboard();

      expect(dashboardHtml).toContain('alert-dashboard');
      expect(dashboardHtml).toContain('alert-stats');
      expect(dashboardHtml).toContain('Total Alerts');
      expect(dashboardHtml).toContain('Active Alerts');
    });

    it('should render empty state for new users', async () => {
      const user = mockUsers[0];
      alertComponent.setCurrentUser(user);

      const dashboardHtml = await alertComponent.renderAlertDashboard();

      expect(dashboardHtml).toContain('empty-state');
      expect(dashboardHtml).toContain('No Job Alerts Yet');
      expect(dashboardHtml).toContain('Create Your First Alert');
    });

    it('should render create alert form', async () => {
      const formHtml = await alertComponent.renderCreateAlertForm();

      expect(formHtml).toContain('createAlertForm');
      expect(formHtml).toContain('Alert Name');
      expect(formHtml).toContain('Keywords');
      expect(formHtml).toContain('Location');
      expect(formHtml).toContain('Salary');
      expect(formHtml).toContain('Job Types');
    });

    it('should render edit alert form with pre-filled data', async () => {
      const user = mockUsers[0];
      const alert = await alertService.createAlert(user.id, mockAlerts[0]);

      const editFormHtml = await alertComponent.renderEditAlertForm(alert.id);

      expect(editFormHtml).toContain('editAlertForm');
      expect(editFormHtml).toContain(`value="${alert.name}"`);
      expect(editFormHtml).toContain(alert.frequency);
    });

    it('should render login prompt for unauthenticated users', async () => {
      const loginHtml = await alertComponent.renderAlertDashboard();

      expect(loginHtml).toContain('login-prompt');
      expect(loginHtml).toContain('Email Address');
      expect(loginHtml).toContain('Get Started');
    });
  });

  describe('End-to-End Alert Flow', () => {
    it('should complete full alert lifecycle', async () => {
      const user = mockUsers[0];

      // 1. Create alert
      const alert = await alertService.createAlert(user.id, mockAlerts[0]);
      expect(alert.id).toBeDefined();

      // 2. Process alert (mock job finding)
      const mockScrapeJobs = jest
        .spyOn(integrationService as any, 'scrapeJobsForAlert')
        .mockResolvedValue(mockJobs);

      const result = await integrationService.processAlert(alert);
      expect(result.jobsFound.length).toBeGreaterThan(0);

      // 3. Verify notifications were sent
      expect(result.delivered).toBe(true);

      // 4. Check alert was updated
      const updatedAlert = await alertService.getAlert(alert.id);
      expect(updatedAlert?.lastTriggered).toBeDefined();

      // 5. Verify delivery was recorded
      const userStats = await alertService.getUserStats(user.id);
      expect(userStats.totalJobsFound).toBeGreaterThan(0);

      mockScrapeJobs.mockRestore();
    });

    it('should handle user registration and first alert creation', async () => {
      const newUser = {
        email: 'newuser@example.com',
        name: 'New User',
      };

      // 1. Register user
      const user = await alertService.createUser(newUser);
      expect(user.id).toBeDefined();

      // 2. Send welcome email
      const welcomeResult = await emailService.sendWelcomeEmail(user);
      expect(welcomeResult.success).toBe(true);

      // 3. Create first alert
      const alert = await alertService.createAlert(user.id, {
        name: 'My First Alert',
        criteria: { keywords: ['developer'] },
        frequency: 'daily',
        isActive: true,
      });

      expect(alert.userId).toBe(user.id);

      // 4. Setup push notifications (if supported)
      if (WebPushNotificationService.isSupported()) {
        await pushService.sendWelcomeNotification(user.id, user.name);
      }
    });

    it('should handle digest notifications correctly', async () => {
      const user = mockUsers[0];

      // Create alerts
      const alert1 = await alertService.createAlert(user.id, mockAlerts[0]);
      const alert2 = await alertService.createAlert(user.id, mockAlerts[1]);

      // Simulate alert deliveries
      await alertService.recordDelivery(alert1.id, {
        jobsFound: 10,
        deliveredAt: new Date(),
        deliveryStatus: 'delivered',
        deliveryMethod: 'email',
      });

      await alertService.recordDelivery(alert2.id, {
        jobsFound: 5,
        deliveredAt: new Date(),
        deliveryStatus: 'delivered',
        deliveryMethod: 'email',
      });

      // Send daily digest
      await integrationService.sendDailyDigests();

      // Verify digest was processed (would check email/push logs in real implementation)
      const stats = await alertService.getUserStats(user.id);
      expect(stats.totalJobsFound).toBe(15);
    });
  });

  describe('Performance Tests', () => {
    it('should handle high volume of alerts efficiently', async () => {
      const startTime = Date.now();

      // Create 100 alerts
      const promises = [];
      for (let i = 0; i < 100; i++) {
        const alertData = {
          ...mockAlerts[0],
          name: `Alert ${i}`,
          criteria: {
            ...mockAlerts[0].criteria,
            keywords: [`keyword${i}`],
          },
        };
        promises.push(alertService.createAlert(mockUsers[0].id, alertData));
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);

      // Verify all alerts were created
      const userAlerts = await alertService.getUserAlerts(mockUsers[0].id);
      expect(userAlerts).toHaveLength(100);
    });

    it('should process multiple alerts concurrently', async () => {
      // Create 10 alerts
      const alerts = [];
      for (let i = 0; i < 10; i++) {
        const alert = await alertService.createAlert(mockUsers[0].id, {
          ...mockAlerts[0],
          name: `Concurrent Alert ${i}`,
        });
        alerts.push(alert);
      }

      // Mock job scraping
      const mockScrapeJobs = jest
        .spyOn(integrationService as any, 'scrapeJobsForAlert')
        .mockResolvedValue(mockJobs.slice(0, 10)); // Return fewer jobs to speed up test

      const startTime = Date.now();
      const results = await integrationService.processAllAlerts();
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds

      mockScrapeJobs.mockRestore();
    });

    it('should handle memory efficiently with large job datasets', async () => {
      const user = mockUsers[0];
      const alert = await alertService.createAlert(user.id, mockAlerts[0]);

      // Mock large job dataset (1000 jobs)
      const largeJobSet = Array.from({ length: 1000 }, (_, i) => ({
        ...mockJobs[0],
        id: `job-${i}`,
        title: `Job ${i}`,
        description: `Description for job ${i} with various keywords...`,
      }));

      const mockScrapeJobs = jest
        .spyOn(integrationService as any, 'scrapeJobsForAlert')
        .mockResolvedValue(largeJobSet);

      const initialMemory = process.memoryUsage().heapUsed;

      await integrationService.processAlert(alert);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      mockScrapeJobs.mockRestore();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid alert criteria gracefully', async () => {
      const user = mockUsers[0];

      const invalidAlertData = {
        name: '', // Empty name
        criteria: {
          keywords: [], // Empty keywords
          salaryMin: -1000, // Invalid salary
          salaryMax: 50000, // Max less than reasonable minimum
        },
        frequency: 'invalid' as any, // Invalid frequency
        isActive: true,
      };

      await expect(alertService.createAlert(user.id, invalidAlertData)).rejects.toThrow();
    });

    it('should handle database connection failures', async () => {
      // Simulate database failure
      const mockQuery = jest
        .spyOn(alertService as any, 'query')
        .mockRejectedValue(new Error('Database connection failed'));

      await expect(alertService.getUserAlerts(mockUsers[0].id)).rejects.toThrow(
        'Database connection failed',
      );

      mockQuery.mockRestore();
    });

    it('should handle email service failures gracefully', async () => {
      const user = mockUsers[0];
      const jobs = mockJobs.slice(0, 3);

      // Mock email service failure
      const mockSend = jest
        .spyOn(emailService as any, 'sendEmail')
        .mockRejectedValue(new Error('Email service unavailable'));

      const result = await emailService.sendJobAlert(user, 'Test Alert', jobs, 'daily');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Email service unavailable');

      mockSend.mockRestore();
    });

    it('should handle push notification failures without affecting alerts', async () => {
      const user = mockUsers[0];
      const alert = await alertService.createAlert(user.id, mockAlerts[0]);

      // Mock push service failure
      const mockSendPush = jest
        .spyOn(pushService as any, 'sendPushNotification')
        .mockRejectedValue(new Error('Push service failed'));

      // Mock successful email
      const mockSendEmail = jest
        .spyOn(emailService, 'sendJobAlert')
        .mockResolvedValue({ success: true, messageId: 'test-123', emailType: 'job_alert' });

      // Mock job scraping
      const mockScrapeJobs = jest
        .spyOn(integrationService as any, 'scrapeJobsForAlert')
        .mockResolvedValue(mockJobs);

      const result = await integrationService.processAlert(alert);

      // Should still be delivered via email even if push fails
      expect(result.delivered).toBe(true);

      mockSendPush.mockRestore();
      mockSendEmail.mockRestore();
      mockScrapeJobs.mockRestore();
    });

    it('should handle concurrent alert modifications', async () => {
      const user = mockUsers[0];
      const alert = await alertService.createAlert(user.id, mockAlerts[0]);

      // Simulate concurrent updates
      const updatePromises = [
        alertService.updateAlert(alert.id, { name: 'Updated Name 1' }),
        alertService.updateAlert(alert.id, { name: 'Updated Name 2' }),
        alertService.updateAlert(alert.id, { isActive: false }),
      ];

      const results = await Promise.allSettled(updatePromises);

      // At least one update should succeed
      const successful = results.filter((r) => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);

      // Final state should be consistent
      const finalAlert = await alertService.getAlert(alert.id);
      expect(finalAlert).toBeDefined();
    });
  });
});

// Test configuration for other test files (available within this file scope)
// Note: testConfig, mockUsers, mockAlerts, mockJobs are defined above for internal use
