// Email Service Implementation for Job Alerts
import nodemailer, { type Transporter } from 'nodemailer';
import type { JobListing as Job } from '../types/index.js';

export interface User {
  id: string;
  email: string;
  name?: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  emailNotifications: boolean;
  alertFrequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  digestFormat: 'summary' | 'detailed';
  quietHours?: {
    start: string; // HH:MM format
    end: string; // HH:MM format
  };
}

export interface AlertSummary {
  alertName: string;
  jobsFound: number;
  newJobs: Job[];
  timeframe: string;
}

export interface EmailService {
  sendJobAlert(user: User, jobs: Job[], alertName: string): Promise<boolean>;
  sendWelcomeEmail(user: User): Promise<boolean>;
  sendAlertSummary(user: User, summary: AlertSummary): Promise<boolean>;
  sendTestEmail(email: string): Promise<boolean>;
}

export class NodemailerEmailService implements EmailService {
  private transporter: Transporter;
  private fromEmail: string;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@jobdorker.com';
    this.transporter = this.createTransporter();
  }

  private createTransporter(): Transporter {
    const emailService = process.env.EMAIL_SERVICE || 'smtp';

    switch (emailService.toLowerCase()) {
      case 'gmail':
        return nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD, // App-specific password
          },
        });

      case 'sendgrid':
        return nodemailer.createTransport({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY,
          },
        });

      case 'ses':
        return nodemailer.createTransport({
          SES: {
            aws: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
              region: process.env.AWS_REGION || 'us-east-1',
            },
          },
        });

      default: // SMTP
        return nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number.parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
    }
  }

  async sendJobAlert(user: User, jobs: Job[], alertName: string): Promise<boolean> {
    try {
      const htmlContent = this.generateJobAlertHTML(user, jobs, alertName);
      const textContent = this.generateJobAlertText(user, jobs, alertName);

      const mailOptions = {
        from: this.fromEmail,
        to: user.email,
        subject: `Job Alert: ${jobs.length} new ${jobs.length === 1 ? 'job' : 'jobs'} found for "${alertName}"`,
        text: textContent,
        html: htmlContent,
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Failed to send job alert email:', error);
      return false;
    }
  }

  async sendWelcomeEmail(user: User): Promise<boolean> {
    try {
      const htmlContent = this.generateWelcomeHTML(user);
      const textContent = this.generateWelcomeText(user);

      const mailOptions = {
        from: this.fromEmail,
        to: user.email,
        subject: 'Welcome to Job Dorker - Your Job Search Companion',
        text: textContent,
        html: htmlContent,
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      return false;
    }
  }

  async sendAlertSummary(user: User, summary: AlertSummary): Promise<boolean> {
    try {
      const htmlContent = this.generateSummaryHTML(user, summary);
      const textContent = this.generateSummaryText(user, summary);

      const mailOptions = {
        from: this.fromEmail,
        to: user.email,
        subject: `Job Alert Summary: ${summary.jobsFound} jobs found in ${summary.timeframe}`,
        text: textContent,
        html: htmlContent,
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Failed to send alert summary email:', error);
      return false;
    }
  }

  async sendTestEmail(email: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: this.fromEmail,
        to: email,
        subject: 'Job Dorker Email Service Test',
        text: 'This is a test email to verify that the Job Dorker email service is working correctly.',
        html: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #2563eb;">Job Dorker Email Service Test</h2>
              <p>This is a test email to verify that the Job Dorker email service is working correctly.</p>
              <p>If you received this email, the email service is properly configured and operational.</p>
              <hr style="border: 1px solid #ddd;">
              <p style="font-size: 12px; color: #666;">
                This is an automated test email from Job Dorker.<br>
                Timestamp: ${new Date().toISOString()}
              </p>
            </body>
          </html>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Failed to send test email:', error);
      return false;
    }
  }

  private generateJobAlertHTML(user: User, jobs: Job[], alertName: string): string {
    const jobsHTML = jobs
      .slice(0, 10)
      .map(
        (job) => `
      <div style="border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 8px 0; background-color: #f9f9f9;">
        <h3 style="margin: 0 0 8px 0; color: #2563eb;">
          <a href="${job.url}" style="text-decoration: none; color: #2563eb;">${job.title}</a>
        </h3>
        <p style="margin: 4px 0; font-weight: bold; color: #1f2937;">${job.company}</p>
        ${job.location ? `<p style="margin: 4px 0; color: #6b7280;">📍 ${job.location}</p>` : ''}
        ${job.salary ? `<p style="margin: 4px 0; color: #059669;">💰 ${job.salary}</p>` : ''}
        <p style="margin: 8px 0 4px 0; color: #4b5563; font-size: 14px;">
          ${job.description ? `${job.description.substring(0, 200)}...` : 'No description available'}
        </p>
        <p style="margin: 4px 0; font-size: 12px; color: #9ca3af;">
          Posted: ${job.postedDate ? new Date(job.postedDate).toLocaleDateString() : 'Recently'}
        </p>
      </div>
    `,
      )
      .join('');

    return `
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Job Alert: ${alertName}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: white; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">🎯 Job Alert</h1>
              <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">New opportunities for: ${alertName}</p>
            </div>

            <!-- Content -->
            <div style="padding: 24px;">
              <p style="font-size: 16px; margin: 0 0 16px 0;">
                Hello ${user.name || 'there'}! 👋
              </p>
              <p style="margin: 0 0 20px 0;">
                We found <strong>${jobs.length} new job${jobs.length === 1 ? '' : 's'}</strong> matching your "${alertName}" alert criteria.
              </p>

              ${jobsHTML}

              ${
                jobs.length > 10
                  ? `
                <div style="text-align: center; margin: 20px 0; padding: 16px; background-color: #f3f4f6; border-radius: 8px;">
                  <p style="margin: 0; color: #6b7280;">
                    ... and ${jobs.length - 10} more job${jobs.length - 10 === 1 ? '' : 's'}!
                  </p>
                  <a href="http://localhost:3000" style="display: inline-block; margin: 8px 0 0 0; padding: 8px 16px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    View All Jobs
                  </a>
                </div>
              `
                  : ''
              }

              <!-- Call to Action -->
              <div style="text-align: center; margin: 24px 0;">
                <a href="http://localhost:3000" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  🔍 Explore More Jobs
                </a>
              </div>

              <!-- Alert Management -->
              <div style="margin: 24px 0; padding: 16px; background-color: #f9f9f9; border-radius: 8px; border-left: 4px solid #2563eb;">
                <h4 style="margin: 0 0 8px 0; color: #1f2937;">Alert Management</h4>
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
                  This alert was triggered for: <strong>${alertName}</strong>
                </p>
                <div style="font-size: 14px;">
                  <a href="http://localhost:3000/alerts" style="color: #2563eb; text-decoration: none; margin-right: 16px;">⚙️ Manage Alerts</a>
                  <a href="http://localhost:3000/alerts/unsubscribe" style="color: #dc2626; text-decoration: none;">🔇 Unsubscribe</a>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f3f4f6; padding: 16px 24px; border-radius: 0 0 12px 12px; text-align: center; font-size: 12px; color: #6b7280;">
              <p style="margin: 0 0 8px 0;">
                You're receiving this because you set up a job alert for "${alertName}".
              </p>
              <p style="margin: 0;">
                <a href="http://localhost:3000" style="color: #2563eb; text-decoration: none;">Job Dorker</a> | 
                <a href="http://localhost:3000/alerts" style="color: #2563eb; text-decoration: none;">Manage Alerts</a> | 
                <a href="http://localhost:3000/alerts/unsubscribe" style="color: #6b7280; text-decoration: none;">Unsubscribe</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateJobAlertText(user: User, jobs: Job[], alertName: string): string {
    const jobsText = jobs
      .slice(0, 10)
      .map(
        (job, index) => `
${index + 1}. ${job.title} at ${job.company}
   ${job.location ? `Location: ${job.location}` : ''}
   ${job.salary ? `Salary: ${job.salary}` : ''}
   ${job.description ? `${job.description.substring(0, 150)}...` : ''}
   URL: ${job.url}
   Posted: ${job.postedDate ? new Date(job.postedDate).toLocaleDateString() : 'Recently'}
`,
      )
      .join('\n');

    return `
Job Alert: New opportunities for "${alertName}"

Hello ${user.name || 'there'}!

We found ${jobs.length} new job${jobs.length === 1 ? '' : 's'} matching your "${alertName}" alert criteria:

${jobsText}

${jobs.length > 10 ? `\n... and ${jobs.length - 10} more job${jobs.length - 10 === 1 ? '' : 's'}!\n` : ''}

Visit Job Dorker to explore more opportunities: http://localhost:3000

---
Alert Management:
- Manage your alerts: http://localhost:3000/alerts
- Unsubscribe: http://localhost:3000/alerts/unsubscribe

You're receiving this because you set up a job alert for "${alertName}".
    `.trim();
  }

  private generateWelcomeHTML(user: User): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: white; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 28px;">🎉 Welcome to Job Dorker!</h1>
              <p style="margin: 12px 0 0 0; font-size: 18px; opacity: 0.9;">Your intelligent job search companion</p>
            </div>
            
            <div style="padding: 32px;">
              <p style="font-size: 18px; margin: 0 0 20px 0;">
                Hello ${user.name || 'there'}! 👋
              </p>
              
              <p style="margin: 0 0 20px 0;">
                Welcome to Job Dorker! We're excited to help you discover amazing job opportunities with our intelligent job search platform.
              </p>
              
              <h3 style="color: #2563eb; margin: 24px 0 12px 0;">🚀 What you can do:</h3>
              <ul style="margin: 0 0 20px 0; padding-left: 20px;">
                <li style="margin: 8px 0;">Set up personalized job alerts</li>
                <li style="margin: 8px 0;">Search across multiple job boards</li>
                <li style="margin: 8px 0;">Generate detailed job reports</li>
                <li style="margin: 8px 0;">Access our mobile-friendly interface</li>
              </ul>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="http://localhost:3000" style="display: inline-block; padding: 16px 32px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">
                  🔍 Start Job Searching
                </a>
              </div>
              
              <div style="margin: 24px 0; padding: 20px; background-color: #f0f7ff; border-radius: 8px; border-left: 4px solid #2563eb;">
                <h4 style="margin: 0 0 12px 0; color: #1f2937;">💡 Pro Tip:</h4>
                <p style="margin: 0; color: #4b5563;">
                  Create your first job alert to get notified when new opportunities matching your criteria are discovered!
                </p>
              </div>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; font-size: 14px; color: #6b7280;">
              <p style="margin: 0;">
                Happy job hunting! 🎯<br>
                The Job Dorker Team
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateWelcomeText(user: User): string {
    return `
Welcome to Job Dorker!

Hello ${user.name || 'there'}!

Welcome to Job Dorker! We're excited to help you discover amazing job opportunities with our intelligent job search platform.

What you can do:
- Set up personalized job alerts
- Search across multiple job boards  
- Generate detailed job reports
- Access our mobile-friendly interface

Get started: http://localhost:3000

Pro Tip: Create your first job alert to get notified when new opportunities matching your criteria are discovered!

Happy job hunting!
The Job Dorker Team
    `.trim();
  }

  private generateSummaryHTML(user: User, summary: AlertSummary): string {
    const jobsHTML = summary.newJobs
      .slice(0, 5)
      .map(
        (job) => `
      <div style="border-left: 3px solid #2563eb; padding: 12px; margin: 8px 0; background-color: #f9f9f9;">
        <h4 style="margin: 0 0 4px 0;">
          <a href="${job.url}" style="text-decoration: none; color: #2563eb;">${job.title}</a>
        </h4>
        <p style="margin: 0; color: #6b7280;">${job.company} ${job.location ? `• ${job.location}` : ''}</p>
      </div>
    `,
      )
      .join('');

    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">📊 Job Alert Summary</h1>
              <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">${summary.timeframe}</p>
            </div>
            
            <div style="padding: 24px;">
              <p style="font-size: 16px; margin: 0 0 16px 0;">
                Hello ${user.name || 'there'}! 👋
              </p>
              
              <div style="text-align: center; margin: 0 0 24px 0; padding: 20px; background-color: #f0f7ff; border-radius: 8px;">
                <h2 style="margin: 0; color: #2563eb; font-size: 32px;">${summary.jobsFound}</h2>
                <p style="margin: 4px 0 0 0; color: #6b7280;">new job${summary.jobsFound === 1 ? '' : 's'} found for "${summary.alertName}"</p>
              </div>
              
              ${
                summary.newJobs.length > 0
                  ? `
                <h3 style="color: #1f2937; margin: 20px 0 12px 0;">🎯 Recent Opportunities:</h3>
                ${jobsHTML}
                
                ${
                  summary.newJobs.length > 5
                    ? `
                  <p style="text-align: center; margin: 16px 0; color: #6b7280;">
                    ... and ${summary.newJobs.length - 5} more!
                  </p>
                `
                    : ''
                }
              `
                  : `
                <p style="color: #6b7280; text-align: center; margin: 20px 0;">
                  No new jobs found in this timeframe. We'll keep looking! 🔍
                </p>
              `
              }
              
              <div style="text-align: center; margin: 24px 0;">
                <a href="http://localhost:3000" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  View All Results
                </a>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateSummaryText(user: User, summary: AlertSummary): string {
    const jobsText = summary.newJobs
      .slice(0, 5)
      .map(
        (job, index) => `
${index + 1}. ${job.title} at ${job.company}
   ${job.location ? `Location: ${job.location}` : ''}
   URL: ${job.url}
`,
      )
      .join('');

    return `
Job Alert Summary - ${summary.timeframe}

Hello ${user.name || 'there'}!

Summary for "${summary.alertName}":
- ${summary.jobsFound} new job${summary.jobsFound === 1 ? '' : 's'} found

${summary.newJobs.length > 0 ? `Recent opportunities:\n${jobsText}` : "No new jobs found in this timeframe. We'll keep looking!"}

${summary.newJobs.length > 5 ? `\n... and ${summary.newJobs.length - 5} more!\n` : ''}

View all results: http://localhost:3000
Manage alerts: http://localhost:3000/alerts
    `.trim();
  }
}

// Export singleton instance
export const emailService = new NodemailerEmailService();
