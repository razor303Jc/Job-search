/**
 * PWA Manager - Progressive Web App Functionality
 * Handles service worker registration, installation prompts, and PWA features
 * Stage 6 PWA Implementation - Phase 7
 */

class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.serviceWorkerRegistration = null;
    this.pushSubscription = null;
    
    // PWA configuration
    this.config = {
      swPath: '/sw.js',
      pushServerKey: process.env.VAPID_PUBLIC_KEY || 'BExample-Key-Here',
      enableNotifications: true,
      enableBackgroundSync: true,
      updateCheckInterval: 30 * 60 * 1000, // 30 minutes
    };
    
    this.init();
  }

  /**
   * Initialize PWA functionality
   */
  async init() {
    try {
      console.log('[PWA] Initializing Progressive Web App features...');
      
      // Check if PWA is supported
      if (!this.isPWASupported()) {
        console.warn('[PWA] PWA features not fully supported in this browser');
        return;
      }
      
      // Register service worker
      await this.registerServiceWorker();
      
      // Set up installation prompt handling
      this.setupInstallationPrompt();
      
      // Check if already installed
      this.checkInstallationStatus();
      
      // Set up push notifications
      if (this.config.enableNotifications) {
        await this.setupPushNotifications();
      }
      
      // Set up background sync
      if (this.config.enableBackgroundSync) {
        this.setupBackgroundSync();
      }
      
      // Set up periodic update checks
      this.setupUpdateChecks();
      
      // Set up app shortcuts and navigation
      this.setupAppShortcuts();
      
      console.log('[PWA] PWA initialization completed');
      
      // Emit ready event
      this.emitEvent('pwa:ready', {
        isInstalled: this.isInstalled,
        hasNotifications: this.pushSubscription !== null,
        serviceWorkerReady: this.serviceWorkerRegistration !== null
      });
      
    } catch (error) {
      console.error('[PWA] Failed to initialize PWA:', error);
      this.emitEvent('pwa:error', { error: error.message });
    }
  }

  /**
   * Check if PWA features are supported
   */
  isPWASupported() {
    return (
      'serviceWorker' in navigator &&
      'caches' in window &&
      'fetch' in window &&
      'Promise' in window
    );
  }

  /**
   * Register service worker
   */
  async registerServiceWorker() {
    try {
      console.log('[PWA] Registering service worker...');
      
      this.serviceWorkerRegistration = await navigator.serviceWorker.register(
        this.config.swPath,
        { scope: '/' }
      );
      
      console.log('[PWA] Service worker registered:', this.serviceWorkerRegistration.scope);
      
      // Handle service worker updates
      this.serviceWorkerRegistration.addEventListener('updatefound', () => {
        console.log('[PWA] Service worker update found');
        this.handleServiceWorkerUpdate();
      });
      
      // Listen for service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event);
      });
      
      // Check for immediate updates
      if (this.serviceWorkerRegistration.waiting) {
        this.handleServiceWorkerUpdate();
      }
      
    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
      throw error;
    }
  }

  /**
   * Handle service worker updates
   */
  handleServiceWorkerUpdate() {
    const newWorker = this.serviceWorkerRegistration.waiting || this.serviceWorkerRegistration.installing;
    
    if (newWorker) {
      console.log('[PWA] New service worker available');
      
      // Show update notification
      this.showUpdateNotification();
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          console.log('[PWA] New service worker activated');
          this.emitEvent('pwa:updated');
        }
      });
    }
  }

  /**
   * Show update notification to user
   */
  showUpdateNotification() {
    const updateBanner = this.createUpdateBanner();
    document.body.appendChild(updateBanner);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (updateBanner.parentNode) {
        updateBanner.parentNode.removeChild(updateBanner);
      }
    }, 10000);
  }

  /**
   * Create update notification banner
   */
  createUpdateBanner() {
    const banner = document.createElement('div');
    banner.className = 'pwa-update-banner';
    banner.innerHTML = `
      <div class="pwa-update-content">
        <span class="pwa-update-text">🔄 A new version is available!</span>
        <button class="pwa-update-btn" onclick="window.pwaManager.activateUpdate()">
          Update Now
        </button>
        <button class="pwa-update-close" onclick="this.parentNode.parentNode.remove()">
          ✕
        </button>
      </div>
    `;
    
    // Add styles
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #2563eb;
      color: white;
      padding: 12px;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      transform: translateY(-100%);
      transition: transform 0.3s ease;
    `;
    
    // Animate in
    setTimeout(() => {
      banner.style.transform = 'translateY(0)';
    }, 100);
    
    return banner;
  }

  /**
   * Activate service worker update
   */
  activateUpdate() {
    if (this.serviceWorkerRegistration?.waiting) {
      this.serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }

  /**
   * Handle messages from service worker
   */
  handleServiceWorkerMessage(event) {
    const { type, payload } = event.data;
    
    console.log('[PWA] Message from service worker:', type, payload);
    
    switch (type) {
      case 'CACHE_UPDATED':
        this.emitEvent('pwa:cache-updated', payload);
        break;
      case 'OFFLINE_READY':
        this.showOfflineReadyNotification();
        break;
      case 'BACKGROUND_SYNC_SUCCESS':
        this.emitEvent('pwa:sync-success', payload);
        break;
    }
  }

  /**
   * Set up installation prompt handling
   */
  setupInstallationPrompt() {
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (event) => {
      console.log('[PWA] Installation prompt available');
      
      // Prevent the default mini-infobar
      event.preventDefault();
      
      // Store the event for later use
      this.deferredPrompt = event;
      
      // Show custom installation UI
      this.showInstallationPrompt();
      
      this.emitEvent('pwa:install-available');
    });
    
    // Listen for installation completion
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.hideInstallationPrompt();
      this.emitEvent('pwa:installed');
    });
  }

  /**
   * Show installation prompt UI
   */
  showInstallationPrompt() {
    // Check if prompt already exists
    if (document.querySelector('.pwa-install-prompt')) {
      return;
    }
    
    const prompt = document.createElement('div');
    prompt.className = 'pwa-install-prompt';
    prompt.innerHTML = `
      <div class="pwa-install-content">
        <div class="pwa-install-icon">📱</div>
        <div class="pwa-install-text">
          <h3>Install Job Search Pro</h3>
          <p>Get quick access and enhanced performance</p>
        </div>
        <div class="pwa-install-actions">
          <button class="pwa-install-btn" onclick="window.pwaManager.promptInstallation()">
            Install
          </button>
          <button class="pwa-install-later" onclick="window.pwaManager.hideInstallationPrompt()">
            Later
          </button>
        </div>
      </div>
    `;
    
    // Add styles
    this.addInstallPromptStyles();
    
    document.body.appendChild(prompt);
    
    // Animate in
    setTimeout(() => {
      prompt.classList.add('pwa-install-show');
    }, 100);
  }

  /**
   * Add styles for installation prompt
   */
  addInstallPromptStyles() {
    if (document.querySelector('#pwa-install-styles')) {
      return;
    }
    
    const styles = document.createElement('style');
    styles.id = 'pwa-install-styles';
    styles.textContent = `
      .pwa-install-prompt {
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        max-width: 400px;
        margin: 0 auto;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        border: 1px solid #e5e7eb;
        z-index: 10000;
        transform: translateY(100px);
        opacity: 0;
        transition: all 0.3s ease;
      }
      
      .pwa-install-show {
        transform: translateY(0);
        opacity: 1;
      }
      
      .pwa-install-content {
        display: flex;
        align-items: center;
        padding: 16px;
        gap: 12px;
      }
      
      .pwa-install-icon {
        font-size: 24px;
        flex-shrink: 0;
      }
      
      .pwa-install-text {
        flex: 1;
        min-width: 0;
      }
      
      .pwa-install-text h3 {
        margin: 0 0 4px 0;
        font-size: 16px;
        font-weight: 600;
        color: #111827;
      }
      
      .pwa-install-text p {
        margin: 0;
        font-size: 14px;
        color: #6b7280;
      }
      
      .pwa-install-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }
      
      .pwa-install-btn {
        background: #2563eb;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .pwa-install-btn:hover {
        background: #1d4ed8;
      }
      
      .pwa-install-later {
        background: transparent;
        color: #6b7280;
        border: 1px solid #d1d5db;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .pwa-install-later:hover {
        background: #f9fafb;
        color: #374151;
      }
      
      .pwa-update-banner .pwa-update-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        max-width: 1200px;
        margin: 0 auto;
      }
      
      .pwa-update-btn {
        background: white;
        color: #2563eb;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
      }
      
      .pwa-update-close {
        background: transparent;
        color: white;
        border: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      @media (max-width: 640px) {
        .pwa-install-prompt {
          left: 16px;
          right: 16px;
          bottom: 16px;
        }
        
        .pwa-install-content {
          flex-direction: column;
          text-align: center;
        }
        
        .pwa-install-actions {
          width: 100%;
          justify-content: center;
        }
        
        .pwa-update-banner .pwa-update-content {
          flex-direction: column;
          gap: 8px;
          text-align: center;
        }
      }
    `;
    
    document.head.appendChild(styles);
  }

  /**
   * Prompt user to install the app
   */
  async promptInstallation() {
    if (!this.deferredPrompt) {
      console.warn('[PWA] No deferred prompt available');
      return;
    }
    
    try {
      // Show the installation prompt
      this.deferredPrompt.prompt();
      
      // Wait for user choice
      const { outcome } = await this.deferredPrompt.userChoice;
      
      console.log('[PWA] Installation prompt result:', outcome);
      
      if (outcome === 'accepted') {
        this.emitEvent('pwa:install-accepted');
      } else {
        this.emitEvent('pwa:install-dismissed');
      }
      
      // Clear the deferred prompt
      this.deferredPrompt = null;
      this.hideInstallationPrompt();
      
    } catch (error) {
      console.error('[PWA] Installation prompt failed:', error);
    }
  }

  /**
   * Hide installation prompt
   */
  hideInstallationPrompt() {
    const prompt = document.querySelector('.pwa-install-prompt');
    if (prompt) {
      prompt.classList.remove('pwa-install-show');
      setTimeout(() => {
        if (prompt.parentNode) {
          prompt.parentNode.removeChild(prompt);
        }
      }, 300);
    }
  }

  /**
   * Check if app is already installed
   */
  checkInstallationStatus() {
    // Check if running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      console.log('[PWA] App is running in standalone mode');
      this.emitEvent('pwa:running-standalone');
    }
    
    // Check for iOS standalone mode
    if (window.navigator.standalone === true) {
      this.isInstalled = true;
      console.log('[PWA] App is running in iOS standalone mode');
    }
  }

  /**
   * Set up push notifications
   */
  async setupPushNotifications() {
    try {
      console.log('[PWA] Setting up push notifications...');
      
      // Check if notifications are supported
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('[PWA] Push notifications not supported');
        return;
      }
      
      // Request notification permission
      const permission = await this.requestNotificationPermission();
      
      if (permission === 'granted') {
        // Subscribe to push notifications
        await this.subscribeToPushNotifications();
      }
      
    } catch (error) {
      console.error('[PWA] Failed to setup push notifications:', error);
    }
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission() {
    if (Notification.permission === 'granted') {
      return 'granted';
    }
    
    if (Notification.permission === 'denied') {
      console.warn('[PWA] Notification permission denied');
      return 'denied';
    }
    
    // Request permission
    const permission = await Notification.requestPermission();
    console.log('[PWA] Notification permission:', permission);
    
    this.emitEvent('pwa:notification-permission', { permission });
    
    return permission;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPushNotifications() {
    try {
      if (!this.serviceWorkerRegistration) {
        throw new Error('Service worker not registered');
      }
      
      // Check for existing subscription
      let subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription
        subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.config.pushServerKey)
        });
        
        console.log('[PWA] New push subscription created');
      } else {
        console.log('[PWA] Existing push subscription found');
      }
      
      this.pushSubscription = subscription;
      
      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      
      this.emitEvent('pwa:push-subscribed', { subscription });
      
    } catch (error) {
      console.error('[PWA] Failed to subscribe to push notifications:', error);
    }
  }

  /**
   * Send push subscription to server
   */
  async sendSubscriptionToServer(subscription) {
    try {
      const response = await fetch('/api/v2/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        })
      });
      
      if (response.ok) {
        console.log('[PWA] Push subscription sent to server');
      } else {
        console.warn('[PWA] Failed to send subscription to server:', response.status);
      }
      
    } catch (error) {
      console.error('[PWA] Error sending subscription to server:', error);
    }
  }

  /**
   * Set up background sync
   */
  setupBackgroundSync() {
    // Register for background sync when offline
    window.addEventListener('online', () => {
      console.log('[PWA] Back online - triggering background sync');
      this.triggerBackgroundSync();
    });
    
    // Handle form submissions for offline sync
    document.addEventListener('submit', (event) => {
      if (!navigator.onLine) {
        this.handleOfflineFormSubmission(event);
      }
    });
  }

  /**
   * Trigger background sync
   */
  async triggerBackgroundSync() {
    if (this.serviceWorkerRegistration && 'sync' in this.serviceWorkerRegistration) {
      try {
        await this.serviceWorkerRegistration.sync.register('job-search-sync');
        await this.serviceWorkerRegistration.sync.register('alert-preferences-sync');
        console.log('[PWA] Background sync registered');
      } catch (error) {
        console.error('[PWA] Background sync registration failed:', error);
      }
    }
  }

  /**
   * Handle offline form submissions
   */
  handleOfflineFormSubmission(event) {
    // Store form data for later sync
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    // Store in IndexedDB for sync when online
    this.storeForSync('form-submissions', {
      id: Date.now().toString(),
      url: event.target.action,
      method: event.target.method || 'POST',
      data: data,
      timestamp: Date.now()
    });
    
    // Show offline notification
    this.showOfflineNotification('Your data has been saved and will sync when you\'re back online.');
    
    event.preventDefault();
  }

  /**
   * Set up periodic update checks
   */
  setupUpdateChecks() {
    // Check for updates periodically
    setInterval(() => {
      this.checkForUpdates();
    }, this.config.updateCheckInterval);
    
    // Check for updates when page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkForUpdates();
      }
    });
  }

  /**
   * Check for service worker updates
   */
  async checkForUpdates() {
    if (this.serviceWorkerRegistration) {
      try {
        await this.serviceWorkerRegistration.update();
        console.log('[PWA] Update check completed');
      } catch (error) {
        console.error('[PWA] Update check failed:', error);
      }
    }
  }

  /**
   * Set up app shortcuts and navigation
   */
  setupAppShortcuts() {
    // Handle app shortcuts navigation
    if ('serviceWorker' in navigator && 'navigate' in navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'NAVIGATE') {
          window.location.href = event.data.url;
        }
      });
    }
  }

  /**
   * Show offline notification
   */
  showOfflineNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'pwa-offline-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f59e0b;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      z-index: 10000;
      max-width: 300px;
      font-size: 14px;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  /**
   * Show offline ready notification
   */
  showOfflineReadyNotification() {
    this.showOfflineNotification('App is ready for offline use!');
  }

  /**
   * Store data for background sync
   */
  async storeForSync(storeName, data) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('job-search-sync', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        store.add(data);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Utility: Convert VAPID key
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }

  /**
   * Emit custom events
   */
  emitEvent(eventName, detail = {}) {
    const event = new CustomEvent(eventName, { detail });
    window.dispatchEvent(event);
    console.log('[PWA] Event emitted:', eventName, detail);
  }

  /**
   * Get PWA status
   */
  getStatus() {
    return {
      isSupported: this.isPWASupported(),
      isInstalled: this.isInstalled,
      hasServiceWorker: this.serviceWorkerRegistration !== null,
      hasNotifications: this.pushSubscription !== null,
      isOnline: navigator.onLine,
      version: this.serviceWorkerRegistration?.active?.scriptURL || 'unknown'
    };
  }

  /**
   * Manual cache management
   */
  async clearCache(cacheType = 'all') {
    if (this.serviceWorkerRegistration) {
      const channel = new MessageChannel();
      
      return new Promise((resolve) => {
        channel.port1.onmessage = (event) => {
          resolve(event.data);
        };
        
        this.serviceWorkerRegistration.active.postMessage(
          {
            type: 'CLEAR_CACHE',
            payload: { cacheType }
          },
          [channel.port2]
        );
      });
    }
  }

  /**
   * Get cache status
   */
  async getCacheStatus() {
    if (this.serviceWorkerRegistration) {
      const channel = new MessageChannel();
      
      return new Promise((resolve) => {
        channel.port1.onmessage = (event) => {
          resolve(event.data);
        };
        
        this.serviceWorkerRegistration.active.postMessage(
          {
            type: 'GET_CACHE_STATUS'
          },
          [channel.port2]
        );
      });
    }
  }
}

// Initialize PWA Manager
window.pwaManager = new PWAManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PWAManager;
}
