/**
 * Push Notification Handler
 * Handles PWA push notification subscriptions and sending
 * Stage 6 PWA Implementation - Phase 7
 */

const webpush = require('web-push');
const fs = require('fs').promises;
const path = require('path');

class PushNotificationService {
  constructor() {
    this.subscriptions = new Map();
    this.subscriptionsFile = path.join(__dirname, '../../../data/push-subscriptions.json');
    
    // VAPID keys - in production, these should be environment variables
    this.vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY || 'BExample-VAPID-Public-Key-Here-64-Characters-Long',
      privateKey: process.env.VAPID_PRIVATE_KEY || 'Example-VAPID-Private-Key-Here-44-Characters'
    };
    
    // Configure web-push
    webpush.setVapidDetails(
      'mailto:admin@jobsearchpro.com',
      this.vapidKeys.publicKey,
      this.vapidKeys.privateKey
    );
    
    this.loadSubscriptions();
  }

  /**
   * Load existing subscriptions from file
   */
  async loadSubscriptions() {
    try {
      const data = await fs.readFile(this.subscriptionsFile, 'utf8');
      const subscriptions = JSON.parse(data);
      
      for (const [id, subscription] of Object.entries(subscriptions)) {
        this.subscriptions.set(id, subscription);
      }
      
      console.log(`[Push] Loaded ${this.subscriptions.size} subscriptions`);
    } catch (error) {
      // File doesn't exist yet - that's okay
      console.log('[Push] No existing subscriptions file found');
    }
  }

  /**
   * Save subscriptions to file
   */
  async saveSubscriptions() {
    try {
      const subscriptions = Object.fromEntries(this.subscriptions);
      await fs.writeFile(
        this.subscriptionsFile,
        JSON.stringify(subscriptions, null, 2)
      );
    } catch (error) {
      console.error('[Push] Failed to save subscriptions:', error);
    }
  }

  /**
   * Add new push subscription
   */
  async addSubscription(subscriptionData, userAgent) {
    try {
      const subscriptionId = this.generateSubscriptionId(subscriptionData);
      
      const subscription = {
        id: subscriptionId,
        subscription: subscriptionData,
        userAgent: userAgent,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        isActive: true
      };
      
      this.subscriptions.set(subscriptionId, subscription);
      await this.saveSubscriptions();
      
      console.log('[Push] New subscription added:', subscriptionId);
      return subscriptionId;
      
    } catch (error) {
      console.error('[Push] Failed to add subscription:', error);
      throw error;
    }
  }

  /**
   * Remove push subscription
   */
  async removeSubscription(subscriptionId) {
    try {
      if (this.subscriptions.has(subscriptionId)) {
        this.subscriptions.delete(subscriptionId);
        await this.saveSubscriptions();
        console.log('[Push] Subscription removed:', subscriptionId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Push] Failed to remove subscription:', error);
      throw error;
    }
  }

  /**
   * Send push notification to specific subscription
   */
  async sendNotification(subscriptionId, payload) {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }
      
      const result = await webpush.sendNotification(
        subscription.subscription,
        JSON.stringify(payload)
      );
      
      // Update last used timestamp
      subscription.lastUsed = new Date().toISOString();
      await this.saveSubscriptions();
      
      console.log('[Push] Notification sent to:', subscriptionId);
      return result;
      
    } catch (error) {
      console.error('[Push] Failed to send notification:', error);
      
      // Handle expired subscriptions
      if (error.statusCode === 410) {
        console.log('[Push] Subscription expired, removing:', subscriptionId);
        await this.removeSubscription(subscriptionId);
      }
      
      throw error;
    }
  }

  /**
   * Send push notification to all subscriptions
   */
  async sendNotificationToAll(payload) {
    const results = {
      success: 0,
      failed: 0,
      expired: 0
    };
    
    const promises = Array.from(this.subscriptions.keys()).map(async (subscriptionId) => {
      try {
        await this.sendNotification(subscriptionId, payload);
        results.success++;
      } catch (error) {
        if (error.statusCode === 410) {
          results.expired++;
        } else {
          results.failed++;
        }
      }
    });
    
    await Promise.all(promises);
    
    console.log('[Push] Broadcast completed:', results);
    return results;
  }

  /**
   * Send job alert notification
   */
  async sendJobAlert(jobData, targetSubscriptions = null) {
    const payload = {
      title: '🔔 New Job Alert!',
      body: `${jobData.title} at ${jobData.company} - ${jobData.location}`,
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/badge-72x72.png',
      tag: 'job-alert',
      requireInteraction: true,
      data: {
        url: `/job-details.html?id=${jobData.id}`,
        jobId: jobData.id,
        type: 'job-alert'
      },
      actions: [
        {
          action: 'view',
          title: 'View Job'
        },
        {
          action: 'save',
          title: 'Save for Later'
        }
      ]
    };
    
    if (targetSubscriptions) {
      // Send to specific subscriptions
      const results = { success: 0, failed: 0 };
      
      for (const subscriptionId of targetSubscriptions) {
        try {
          await this.sendNotification(subscriptionId, payload);
          results.success++;
        } catch (error) {
          results.failed++;
        }
      }
      
      return results;
    } else {
      // Send to all subscriptions
      return await this.sendNotificationToAll(payload);
    }
  }

  /**
   * Send scraping status notification
   */
  async sendScrapingStatus(status) {
    const payload = {
      title: '⚡ Scraping Update',
      body: `Job scraping ${status.completed ? 'completed' : 'in progress'}: ${status.found} jobs found`,
      icon: '/assets/icons/icon-192x192.png',
      tag: 'scraping-status',
      data: {
        url: '/live-scraping.html',
        type: 'scraping-status',
        status: status
      }
    };
    
    return await this.sendNotificationToAll(payload);
  }

  /**
   * Send weekly summary notification
   */
  async sendWeeklySummary(summaryData) {
    const payload = {
      title: '📊 Weekly Job Search Summary',
      body: `${summaryData.newJobs} new jobs this week. ${summaryData.applications} applications sent.`,
      icon: '/assets/icons/icon-192x192.png',
      tag: 'weekly-summary',
      requireInteraction: true,
      data: {
        url: '/enhanced-dashboard.html?view=summary',
        type: 'weekly-summary',
        summary: summaryData
      }
    };
    
    return await this.sendNotificationToAll(payload);
  }

  /**
   * Generate unique subscription ID
   */
  generateSubscriptionId(subscriptionData) {
    const crypto = require('crypto');
    const endpoint = subscriptionData.endpoint;
    return crypto.createHash('sha256').update(endpoint).digest('hex').substring(0, 16);
  }

  /**
   * Get subscription statistics
   */
  getStats() {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    let activeSubscriptions = 0;
    let recentlyUsed = 0;
    
    for (const subscription of this.subscriptions.values()) {
      if (subscription.isActive) {
        activeSubscriptions++;
        
        if (new Date(subscription.lastUsed) > oneWeekAgo) {
          recentlyUsed++;
        }
      }
    }
    
    return {
      total: this.subscriptions.size,
      active: activeSubscriptions,
      recentlyUsed: recentlyUsed,
      vapidConfigured: !!(this.vapidKeys.publicKey && this.vapidKeys.privateKey)
    };
  }

  /**
   * Test notification sending
   */
  async sendTestNotification(subscriptionId) {
    const payload = {
      title: '🧪 Test Notification',
      body: 'This is a test notification from Job Search Pro!',
      icon: '/assets/icons/icon-192x192.png',
      tag: 'test-notification',
      data: {
        url: '/enhanced-dashboard.html',
        type: 'test'
      }
    };
    
    return await this.sendNotification(subscriptionId, payload);
  }

  /**
   * Clean up expired subscriptions
   */
  async cleanupExpiredSubscriptions() {
    const expiredSubscriptions = [];
    
    for (const [id, subscription] of this.subscriptions) {
      try {
        // Try to send a test notification to check if subscription is still valid
        await webpush.sendNotification(
          subscription.subscription,
          JSON.stringify({ test: true })
        );
      } catch (error) {
        if (error.statusCode === 410) {
          expiredSubscriptions.push(id);
        }
      }
    }
    
    // Remove expired subscriptions
    for (const id of expiredSubscriptions) {
      this.subscriptions.delete(id);
    }
    
    if (expiredSubscriptions.length > 0) {
      await this.saveSubscriptions();
      console.log(`[Push] Cleaned up ${expiredSubscriptions.length} expired subscriptions`);
    }
    
    return expiredSubscriptions.length;
  }
}

// Export singleton instance
module.exports = new PushNotificationService();
