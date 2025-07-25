// Web Push Notification Service
// This service is designed for browser environments only

// Type guard to ensure browser environment
declare const window: any;
declare const navigator: any;

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: any;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
  silent?: boolean;
}

interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

interface PushNotificationConfig {
  vapidKeys: {
    publicKey: string;
    privateKey: string;
  };
  subject: string;
  applicationServerKeys?: Uint8Array;
}

export class WebPushNotificationService {
  private config: PushNotificationConfig;
  private subscriptions: Map<string, PushSubscription[]> = new Map();

  constructor(config: PushNotificationConfig) {
    this.config = config;
    this.initializeServiceWorker();
  }

  private async initializeServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw-push.js');

        // Listen for service worker messages
        navigator.serviceWorker.addEventListener(
          'message',
          this.handleServiceWorkerMessage.bind(this),
        );
      } catch (error) {
        console.error('Failed to register push service worker:', error);
      }
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, data } = event.data;

    switch (type) {
      case 'NOTIFICATION_CLICKED':
        this.handleNotificationClick(data);
        break;
      case 'NOTIFICATION_CLOSED':
        this.handleNotificationClose(data);
        break;
      case 'ACTION_CLICKED':
        this.handleActionClick(data);
        break;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      throw new Error('Notification permission denied');
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  async subscribeToPush(userId: string): Promise<PushSubscription | null> {
    try {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        return null;
      }

      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey:
          this.config.applicationServerKeys ||
          this.urlBase64ToUint8Array(this.config.vapidKeys.publicKey),
      });

      const pushSubscription: PushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
        },
      };

      // Store subscription for this user
      const userSubscriptions = this.subscriptions.get(userId) || [];
      userSubscriptions.push(pushSubscription);
      this.subscriptions.set(userId, userSubscriptions);

      // Send subscription to server
      await this.sendSubscriptionToServer(userId, pushSubscription);

      return pushSubscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  async unsubscribeFromPush(userId: string): Promise<boolean> {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from local storage
        this.subscriptions.delete(userId);

        // Notify server
        await this.removeSubscriptionFromServer(userId);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  async sendJobAlertNotification(
    userId: string,
    jobsFound: number,
    alertName: string,
    jobs?: any[],
  ): Promise<void> {
    const payload: NotificationPayload = {
      title: `🔔 ${jobsFound} New Job${jobsFound > 1 ? 's' : ''} Found!`,
      body: `Your alert "${alertName}" found ${jobsFound} new job${jobsFound > 1 ? 's' : ''} matching your criteria.`,
      icon: '/icons/job-alert-icon.png',
      badge: '/icons/job-badge.png',
      data: {
        type: 'job_alert',
        alertName,
        jobsFound,
        userId,
        jobs: jobs?.slice(0, 3), // Include top 3 jobs
      },
      actions: [
        {
          action: 'view_jobs',
          title: 'View Jobs',
          icon: '/icons/view-icon.png',
        },
        {
          action: 'manage_alerts',
          title: 'Manage Alerts',
          icon: '/icons/settings-icon.png',
        },
      ],
      requireInteraction: true,
    };

    await this.sendPushNotification(userId, payload);
  }

  async sendWelcomeNotification(userId: string, userName?: string): Promise<void> {
    const payload: NotificationPayload = {
      title: '🎉 Welcome to Job Search Alerts!',
      body: `Hi ${userName || 'there'}! Your job alerts are now active and we'll notify you when new opportunities are found.`,
      icon: '/icons/welcome-icon.png',
      badge: '/icons/job-badge.png',
      data: {
        type: 'welcome',
        userId,
      },
      actions: [
        {
          action: 'create_alert',
          title: 'Create Alert',
          icon: '/icons/add-icon.png',
        },
      ],
    };

    await this.sendPushNotification(userId, payload);
  }

  async sendJobMatchNotification(userId: string, job: any, matchScore: number): Promise<void> {
    const payload: NotificationPayload = {
      title: `⭐ High Match Job: ${job.title}`,
      body: `${job.company} • ${matchScore}% match • ${job.location || 'Remote'}`,
      icon: '/icons/high-match-icon.png',
      badge: '/icons/job-badge.png',
      image: job.companyLogo,
      data: {
        type: 'job_match',
        job,
        matchScore,
        userId,
      },
      actions: [
        {
          action: 'view_job',
          title: 'View Job',
          icon: '/icons/view-icon.png',
        },
        {
          action: 'save_job',
          title: 'Save Job',
          icon: '/icons/save-icon.png',
        },
      ],
      requireInteraction: true,
    };

    await this.sendPushNotification(userId, payload);
  }

  async sendDigestNotification(
    userId: string,
    period: 'daily' | 'weekly',
    totalJobs: number,
    alerts: Array<{ name: string; jobsFound: number }>,
  ): Promise<void> {
    const alertSummary = alerts
      .map((alert) => `${alert.name}: ${alert.jobsFound} job${alert.jobsFound > 1 ? 's' : ''}`)
      .join(', ');

    const payload: NotificationPayload = {
      title: `📊 Your ${period.charAt(0).toUpperCase() + period.slice(1)} Job Summary`,
      body: `${totalJobs} total jobs found across ${alerts.length} alert${alerts.length > 1 ? 's' : ''}: ${alertSummary}`,
      icon: '/icons/digest-icon.png',
      badge: '/icons/job-badge.png',
      data: {
        type: 'digest',
        period,
        totalJobs,
        alerts,
        userId,
      },
      actions: [
        {
          action: 'view_digest',
          title: 'View Summary',
          icon: '/icons/view-icon.png',
        },
        {
          action: 'manage_alerts',
          title: 'Manage Alerts',
          icon: '/icons/settings-icon.png',
        },
      ],
    };

    await this.sendPushNotification(userId, payload);
  }

  private async sendPushNotification(userId: string, payload: NotificationPayload): Promise<void> {
    const userSubscriptions = this.subscriptions.get(userId);
    if (!userSubscriptions || userSubscriptions.length === 0) {
      return;
    }

    const pushPromises = userSubscriptions.map(async (subscription) => {
      try {
        await this.sendToSubscription(subscription, payload);
      } catch (error) {
        console.error('Failed to send push to subscription:', error);
        // Remove invalid subscription
        await this.removeInvalidSubscription(userId, subscription);
      }
    });

    await Promise.allSettled(pushPromises);
  }

  private async sendToSubscription(
    _subscription: PushSubscription,
    payload: NotificationPayload,
  ): Promise<void> {
    // In a real implementation, this would send the push notification via your server
    // Here we simulate the push by directly showing the notification

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;

      await registration.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon,
        badge: payload.badge,
        image: payload.image,
        data: payload.data,
        actions: payload.actions,
        requireInteraction: payload.requireInteraction,
        silent: payload.silent,
        tag: `job-alert-${Date.now()}`, // Unique tag to prevent grouping
        timestamp: Date.now(),
        vibrate: [200, 100, 200],
      });
    }
  }

  private async sendSubscriptionToServer(
    userId: string,
    subscription: PushSubscription,
  ): Promise<void> {
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          subscription,
        }),
      });
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  }

  private async removeSubscriptionFromServer(userId: string): Promise<void> {
    try {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
    } catch (error) {
      console.error('Failed to remove subscription from server:', error);
    }
  }

  private async removeInvalidSubscription(
    userId: string,
    subscription: PushSubscription,
  ): Promise<void> {
    const userSubscriptions = this.subscriptions.get(userId) || [];
    const filteredSubscriptions = userSubscriptions.filter(
      (sub) => sub.endpoint !== subscription.endpoint,
    );
    this.subscriptions.set(userId, filteredSubscriptions);
  }

  private handleNotificationClick(data: any): void {
    const { type } = data;

    switch (type) {
      case 'job_alert':
        this.navigateToJobAlerts();
        break;
      case 'job_match':
        this.navigateToJob(data.job);
        break;
      case 'digest':
        this.navigateToDigest(data.period);
        break;
      case 'welcome':
        this.navigateToAlertCreation();
        break;
    }
  }

  private handleNotificationClose(_data: any): void {}

  private handleActionClick(data: any): void {
    const { action, notificationData } = data;

    switch (action) {
      case 'view_jobs':
        this.navigateToJobAlerts();
        break;
      case 'view_job':
        this.navigateToJob(notificationData.job);
        break;
      case 'save_job':
        this.saveJob(notificationData.job);
        break;
      case 'manage_alerts':
        this.navigateToAlertManagement();
        break;
      case 'create_alert':
        this.navigateToAlertCreation();
        break;
      case 'view_digest':
        this.navigateToDigest(notificationData.period);
        break;
    }
  }

  private navigateToJobAlerts(): void {
    window.open('/jobs', '_blank');
  }

  private navigateToJob(job: any): void {
    if (job?.url) {
      window.open(job.url, '_blank');
    }
  }

  private navigateToAlertManagement(): void {
    window.open('/alerts', '_blank');
  }

  private navigateToAlertCreation(): void {
    window.open('/alerts/create', '_blank');
  }

  private navigateToDigest(period: string): void {
    window.open(`/digest/${period}`, '_blank');
  }

  private async saveJob(job: any): Promise<void> {
    try {
      await fetch('/api/jobs/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ job }),
      });

      // Show success notification
      this.showLocalNotification('Job saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save job:', error);
      this.showLocalNotification('Failed to save job', 'error');
    }
  }

  private showLocalNotification(message: string, type: 'success' | 'error'): void {
    // Show a simple browser notification for immediate feedback
    if (Notification.permission === 'granted') {
      new Notification(message, {
        icon: type === 'success' ? '/icons/success-icon.png' : '/icons/error-icon.png',
        badge: '/icons/job-badge.png',
      });
    }
  }

  // Utility methods
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return window.btoa(binary);
  }

  // Check if push notifications are supported
  static isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  // Get current subscription status
  async getSubscriptionStatus(userId: string): Promise<{
    supported: boolean;
    permission: NotificationPermission;
    subscribed: boolean;
    subscription?: PushSubscription;
  }> {
    const supported = WebPushNotificationService.isSupported();
    const permission = Notification.permission;

    if (!supported) {
      return { supported: false, permission: 'default', subscribed: false };
    }

    const userSubscriptions = this.subscriptions.get(userId);
    const subscribed = userSubscriptions && userSubscriptions.length > 0;

    return {
      supported,
      permission,
      subscribed: !!subscribed,
      subscription: subscribed ? userSubscriptions![0] : undefined,
    } as {
      supported: boolean;
      permission: NotificationPermission;
      subscribed: boolean;
      subscription?: PushSubscription;
    };
  }

  // Test push notification
  async sendTestNotification(userId: string): Promise<void> {
    const payload: NotificationPayload = {
      title: '🧪 Test Notification',
      body: 'This is a test push notification to verify your settings are working correctly.',
      icon: '/icons/test-icon.png',
      badge: '/icons/job-badge.png',
      data: {
        type: 'test',
        userId,
      },
      actions: [
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/close-icon.png',
        },
      ],
    };

    await this.sendPushNotification(userId, payload);
  }
}

// Service Worker Script (separate file: sw-push.js)
export const serviceWorkerScript = `
self.addEventListener('push', function(event) {
  if (event.data) {
    const payload = event.data.json();
    
    const options = {
      body: payload.body,
      icon: payload.icon || '/icons/default-icon.png',
      badge: payload.badge || '/icons/job-badge.png',
      image: payload.image,
      data: payload.data,
      actions: payload.actions,
      requireInteraction: payload.requireInteraction,
      silent: payload.silent,
      tag: payload.tag || 'job-alert',
      timestamp: Date.now(),
      vibrate: [200, 100, 200]
    };

    event.waitUntil(
      self.registration.showNotification(payload.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const data = event.notification.data;
  
  if (event.action) {
    // Handle action clicks
    self.clients.postMessage({
      type: 'ACTION_CLICKED',
      data: {
        action: event.action,
        notificationData: data
      }
    });
  } else {
    // Handle notification click
    self.clients.postMessage({
      type: 'NOTIFICATION_CLICKED',
      data: data
    });
  }

  // Focus or open the app
  event.waitUntil(
    self.clients.matchAll().then(function(clientList) {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return self.clients.openWindow('/');
    })
  );
});

self.addEventListener('notificationclose', function(event) {
  const data = event.notification.data;
  
  self.clients.postMessage({
    type: 'NOTIFICATION_CLOSED',
    data: data
  });
});
`;

// Usage example
export const pushNotificationService = new WebPushNotificationService({
  vapidKeys: {
    publicKey: 'YOUR_VAPID_PUBLIC_KEY',
    privateKey: 'YOUR_VAPID_PRIVATE_KEY',
  },
  subject: 'mailto:your-email@example.com',
});

// Initialize push notifications for a user
export async function initializePushNotifications(userId: string): Promise<boolean> {
  if (!WebPushNotificationService.isSupported()) {
    return false;
  }

  try {
    const subscription = await pushNotificationService.subscribeToPush(userId);
    if (subscription) {
      // Send welcome notification
      await pushNotificationService.sendWelcomeNotification(userId);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to initialize push notifications:', error);
    return false;
  }
}
