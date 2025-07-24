import { join } from 'node:path';
import Database from 'better-sqlite3';
// Alert Service Implementation for Job Alerts Management
import type { JobListing as Job } from '../types/index.js';
import type { User } from './email-service.js';

export interface AlertCriteria {
  keywords?: string[];
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  companies?: string[];
  industries?: string[];
  jobTypes?: ('full-time' | 'part-time' | 'contract' | 'remote')[];
  experienceLevel?: ('entry' | 'mid' | 'senior' | 'executive')[];
  excludeKeywords?: string[];
}

export interface Alert {
  id: string;
  userId: string;
  name: string;
  criteria: AlertCriteria;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  isActive: boolean;
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertDelivery {
  id: string;
  alertId: string;
  jobsFound: number;
  deliveredAt: Date;
  deliveryStatus: 'sent' | 'failed' | 'pending';
  jobs: Job[];
}

export interface AlertService {
  createAlert(
    userId: string,
    name: string,
    criteria: AlertCriteria,
    frequency?: string,
  ): Promise<Alert>;
  updateAlert(alertId: string, updates: Partial<Alert>): Promise<Alert>;
  deleteAlert(alertId: string): Promise<boolean>;
  getUserAlerts(userId: string): Promise<Alert[]>;
  getAlert(alertId: string): Promise<Alert | null>;
  toggleAlert(alertId: string, isActive: boolean): Promise<boolean>;
  triggerAlerts(): Promise<void>;
  checkAlert(alert: Alert, jobs: Job[]): Promise<Job[]>;
  previewAlert(criteria: AlertCriteria, limit?: number): Promise<Job[]>;
  getAlertDeliveries(alertId: string, limit?: number): Promise<AlertDelivery[]>;
  getUserStats(userId: string): Promise<AlertStats>;
}

export interface AlertStats {
  totalAlerts: number;
  activeAlerts: number;
  totalJobsFound: number;
  recentDeliveries: number;
  avgJobsPerAlert: number;
}

export class DatabaseAlertService implements AlertService {
  private db: Database.Database;
  private emailService: EmailService;

  constructor(databasePath?: string, emailService?: EmailService) {
    this.db = new Database(databasePath || join(process.cwd(), 'jobs.db'));
    this.emailService = emailService || emailService;
    this.initializeTables();
  }

  private initializeTables(): void {
    // Create users table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        preferences TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create job_alerts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS job_alerts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        criteria TEXT NOT NULL,
        frequency TEXT DEFAULT 'daily',
        is_active INTEGER DEFAULT 1,
        last_triggered DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Create alert_deliveries table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alert_deliveries (
        id TEXT PRIMARY KEY,
        alert_id TEXT NOT NULL,
        jobs_found INTEGER DEFAULT 0,
        delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivery_status TEXT DEFAULT 'sent',
        jobs_data TEXT DEFAULT '[]',
        FOREIGN KEY (alert_id) REFERENCES job_alerts (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_job_alerts_user_id ON job_alerts (user_id);
      CREATE INDEX IF NOT EXISTS idx_job_alerts_active ON job_alerts (is_active);
      CREATE INDEX IF NOT EXISTS idx_alert_deliveries_alert_id ON alert_deliveries (alert_id);
    `);
  }

  async createAlert(
    userId: string,
    name: string,
    criteria: AlertCriteria,
    frequency = 'daily',
  ): Promise<Alert> {
    const alertId = this.generateId();
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO job_alerts (id, user_id, name, criteria, frequency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      alertId,
      userId,
      name,
      JSON.stringify(criteria),
      frequency,
      now.toISOString(),
      now.toISOString(),
    );

    return {
      id: alertId,
      userId,
      name,
      criteria,
      frequency: frequency as Alert['frequency'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateAlert(alertId: string, updates: Partial<Alert>): Promise<Alert> {
    const existingAlert = await this.getAlert(alertId);
    if (!existingAlert) {
      throw new Error(`Alert with ID ${alertId} not found`);
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updates.name);
    }

    if (updates.criteria !== undefined) {
      updateFields.push('criteria = ?');
      updateValues.push(JSON.stringify(updates.criteria));
    }

    if (updates.frequency !== undefined) {
      updateFields.push('frequency = ?');
      updateValues.push(updates.frequency);
    }

    if (updates.isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(updates.isActive ? 1 : 0);
    }

    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());

    updateValues.push(alertId);

    const stmt = this.db.prepare(`
      UPDATE job_alerts 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...updateValues);

    return (await this.getAlert(alertId)) as Alert;
  }

  async deleteAlert(alertId: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM job_alerts WHERE id = ?');
    const result = stmt.run(alertId);
    return result.changes > 0;
  }

  async getUserAlerts(userId: string): Promise<Alert[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM job_alerts 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(userId) as any[];
    return rows.map(this.mapRowToAlert);
  }

  async getAlert(alertId: string): Promise<Alert | null> {
    const stmt = this.db.prepare('SELECT * FROM job_alerts WHERE id = ?');
    const row = stmt.get(alertId) as any;

    if (!row) return null;
    return this.mapRowToAlert(row);
  }

  async toggleAlert(alertId: string, isActive: boolean): Promise<boolean> {
    const stmt = this.db.prepare(`
      UPDATE job_alerts 
      SET is_active = ?, updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(isActive ? 1 : 0, new Date().toISOString(), alertId);
    return result.changes > 0;
  }

  async triggerAlerts(): Promise<void> {
    // Get all active alerts that are due for triggering
    const alerts = await this.getActiveAlertsToTrigger();

    for (const alert of alerts) {
      try {
        await this.processAlert(alert);
      } catch (error) {
        console.error(`Failed to process alert ${alert.id}:`, error);
      }
    }
  }

  private async getActiveAlertsToTrigger(): Promise<Alert[]> {
    const now = new Date();

    // For this implementation, we'll check all active alerts
    // In production, you'd want more sophisticated scheduling logic
    const stmt = this.db.prepare(`
      SELECT * FROM job_alerts 
      WHERE is_active = 1
      ORDER BY last_triggered ASC NULLS FIRST
    `);

    const rows = stmt.all() as any[];
    return rows.map(this.mapRowToAlert).filter((alert) => {
      return this.shouldTriggerAlert(alert, now);
    });
  }

  private shouldTriggerAlert(alert: Alert, now: Date): boolean {
    if (!alert.lastTriggered) {
      return true; // Never triggered, should trigger now
    }

    const timeSinceLastTrigger = now.getTime() - alert.lastTriggered.getTime();
    const intervalMs = this.getIntervalMs(alert.frequency);

    return timeSinceLastTrigger >= intervalMs;
  }

  private getIntervalMs(frequency: Alert['frequency']): number {
    switch (frequency) {
      case 'immediate':
        return 0; // Always trigger
      case 'hourly':
        return 60 * 60 * 1000; // 1 hour
      case 'daily':
        return 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      default:
        return 24 * 60 * 60 * 1000; // Default to daily
    }
  }

  private async processAlert(alert: Alert): Promise<void> {
    // Get user information
    const user = await this.getUser(alert.userId);
    if (!user) {
      console.error(`User not found for alert ${alert.id}`);
      return;
    }

    // Find matching jobs
    const matchingJobs = await this.checkAlert(alert, []);

    if (matchingJobs.length > 0) {
      // Send email notification
      const emailSent = await this.emailService.sendJobAlert(user, matchingJobs, alert.name);

      // Record delivery
      await this.recordDelivery(alert.id, matchingJobs, emailSent ? 'sent' : 'failed');

      if (emailSent) {
      } else {
        console.error(`❌ Failed to send email for alert: ${alert.name}`);
      }
    } else {
    }

    // Update last triggered timestamp
    await this.updateLastTriggered(alert.id);
  }

  private async getUser(userId: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(userId) as any;

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      preferences: row.preferences ? JSON.parse(row.preferences) : {},
    };
  }

  private async updateLastTriggered(alertId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE job_alerts 
      SET last_triggered = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(new Date().toISOString(), new Date().toISOString(), alertId);
  }

  private async recordDelivery(alertId: string, jobs: Job[], status: string): Promise<void> {
    const deliveryId = this.generateId();

    const stmt = this.db.prepare(`
      INSERT INTO alert_deliveries (id, alert_id, jobs_found, delivery_status, jobs_data)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      deliveryId,
      alertId,
      jobs.length,
      status,
      JSON.stringify(jobs.slice(0, 20)), // Store only first 20 jobs to avoid large JSON
    );
  }

  async checkAlert(alert: Alert, _jobs: Job[]): Promise<Job[]> {
    // For now, we'll simulate finding matching jobs
    // In production, this would query your job database with the alert criteria
    return this.findMatchingJobs(alert.criteria);
  }

  private async findMatchingJobs(criteria: AlertCriteria): Promise<Job[]> {
    // This is a placeholder implementation
    // In production, you'd query your actual jobs database

    // Simulate some matching jobs for demonstration
    const mockJobs: Job[] = [
      {
        id: '1',
        title: 'Senior Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        salary: '$120,000 - $160,000',
        description: 'We are looking for a senior software engineer...',
        url: 'https://example.com/job/1',
        postedDate: new Date().toISOString(),
        scraped: true,
        scrapedAt: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Full Stack Developer',
        company: 'Startup Inc',
        location: 'Remote',
        salary: '$90,000 - $130,000',
        description: 'Join our dynamic team as a full stack developer...',
        url: 'https://example.com/job/2',
        postedDate: new Date().toISOString(),
        scraped: true,
        scrapedAt: new Date().toISOString(),
      },
    ];

    // Apply basic filtering based on criteria
    return mockJobs.filter((job) => {
      if (criteria.keywords && criteria.keywords.length > 0) {
        const titleAndDescription = `${job.title} ${job.description}`.toLowerCase();
        return criteria.keywords.some((keyword) =>
          titleAndDescription.includes(keyword.toLowerCase()),
        );
      }
      return true;
    });
  }

  async previewAlert(criteria: AlertCriteria, limit = 10): Promise<Job[]> {
    const matchingJobs = await this.findMatchingJobs(criteria);
    return matchingJobs.slice(0, limit);
  }

  async getAlertDeliveries(alertId: string, limit = 20): Promise<AlertDelivery[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM alert_deliveries 
      WHERE alert_id = ? 
      ORDER BY delivered_at DESC 
      LIMIT ?
    `);

    const rows = stmt.all(alertId, limit) as any[];
    return rows.map((row) => ({
      id: row.id,
      alertId: row.alert_id,
      jobsFound: row.jobs_found,
      deliveredAt: new Date(row.delivered_at),
      deliveryStatus: row.delivery_status,
      jobs: JSON.parse(row.jobs_data || '[]'),
    }));
  }

  async getUserStats(userId: string): Promise<AlertStats> {
    const alertsStmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_alerts,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_alerts
      FROM job_alerts 
      WHERE user_id = ?
    `);

    const deliveriesStmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_deliveries,
        SUM(jobs_found) as total_jobs_found,
        AVG(jobs_found) as avg_jobs_per_alert
      FROM alert_deliveries ad
      JOIN job_alerts ja ON ad.alert_id = ja.id
      WHERE ja.user_id = ?
        AND ad.delivered_at > datetime('now', '-30 days')
    `);

    const alertStats = alertsStmt.get(userId) as any;
    const deliveryStats = deliveriesStmt.get(userId) as any;

    return {
      totalAlerts: alertStats.total_alerts || 0,
      activeAlerts: alertStats.active_alerts || 0,
      totalJobsFound: deliveryStats.total_jobs_found || 0,
      recentDeliveries: deliveryStats.total_deliveries || 0,
      avgJobsPerAlert: Math.round(deliveryStats.avg_jobs_per_alert || 0),
    };
  }

  private mapRowToAlert(row: any): Alert {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      criteria: JSON.parse(row.criteria),
      frequency: row.frequency,
      isActive: row.is_active === 1,
      lastTriggered: row.last_triggered ? new Date(row.last_triggered) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // User management methods
  async createUser(email: string, name?: string): Promise<User> {
    const userId = this.generateId();

    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, name)
      VALUES (?, ?, ?)
    `);

    stmt.run(userId, email, name);

    const user: User = {
      id: userId,
      email,
      name,
      preferences: {},
    };

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user);

    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email) as any;

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      preferences: row.preferences ? JSON.parse(row.preferences) : {},
    };
  }
}

// Export singleton instance
export const alertService = new DatabaseAlertService();
