/**
 * Job Search Pro - Service Worker
 * Provides offline capability, caching, and push notifications
 * Stage 6 PWA Implementation - Phase 7
 */

// Service Worker version and cache names
const SW_VERSION = '1.0.0';
const CACHE_PREFIX = 'job-search-pro';
const STATIC_CACHE = `${CACHE_PREFIX}-static-v${SW_VERSION}`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}-dynamic-v${SW_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-v${SW_VERSION}`;

// Cache durations
const _CACHE_DURATIONS = {
  static: 7 * 24 * 60 * 60 * 1000, // 7 days
  dynamic: 24 * 60 * 60 * 1000, // 1 day
  api: 5 * 60 * 1000, // 5 minutes
};

// Files to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/enhanced-dashboard.html',
  '/advanced-job-search.html',
  '/live-scraping.html',
  '/job-alerts.html',
  '/job-comparison.html',
  '/css/dashboard.css',
  '/css/advanced-filtering.css',
  '/css/job-comparison.css',
  '/css/export-sharing.css',
  '/js/enhanced-dashboard.js',
  '/js/websocket-client.js',
  '/js/job-alert-system.js',
  '/components/advanced-filtering-sorting.js',
  '/components/job-comparison-tool.js',
  '/components/export-sharing.js',
  '/manifest.json',
  // Add Chart.js and other critical dependencies
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js',
  'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js',
];

// API endpoints to cache
const API_PATTERNS = [
  /\/api\/v2\/jobs/,
  /\/api\/v2\/stats/,
  /\/api\/v2\/companies/,
  /\/api\/v2\/skills/,
];

// Network-first patterns (always try network first)
const NETWORK_FIRST_PATTERNS = [
  /\/api\/v2\/scraping\/status/,
  /\/api\/v2\/alerts/,
  /\/ws/, // WebSocket connections
];

/**
 * Service Worker Installation
 * Pre-cache static assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      }),
  );
});

/**
 * Service Worker Activation
 * Clean up old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (cacheName) => cacheName.startsWith(CACHE_PREFIX) && !cacheName.includes(SW_VERSION),
            )
            .map((cacheName) => {
              return caches.delete(cacheName);
            }),
        );
      })
      .then(() => {
        return self.clients.claim(); // Take control of all pages
      }),
  );
});

/**
 * Fetch Event Handler
 * Implements caching strategies based on request type
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Determine caching strategy based on request
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request));
  } else if (isApiRequest(request)) {
    if (isNetworkFirstPattern(request)) {
      event.respondWith(networkFirst(request));
    } else {
      event.respondWith(staleWhileRevalidate(request));
    }
  } else {
    event.respondWith(networkFirst(request));
  }
});

/**
 * Push Notification Handler
 * Handle incoming push notifications
 */
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  try {
    const data = event.data.json();

    const options = {
      body: data.body || 'New job alert available!',
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/badge-72x72.png',
      image: data.image,
      tag: data.tag || 'job-alert',
      renotify: true,
      requireInteraction: data.requireInteraction || false,
      actions: [
        {
          action: 'view',
          title: 'View Job',
          icon: '/assets/icons/view-action.png',
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/assets/icons/dismiss-action.png',
        },
      ],
      data: {
        url: data.url || '/enhanced-dashboard.html',
        jobId: data.jobId,
        timestamp: Date.now(),
      },
    };

    event.waitUntil(self.registration.showNotification(data.title || 'Job Search Pro', options));
  } catch (error) {
    console.error('[SW] Error handling push notification:', error);
  }
});

/**
 * Notification Click Handler
 * Handle notification click actions
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === 'dismiss') {
    return;
  }

  const urlToOpen = action === 'view' && data?.url ? data.url : '/enhanced-dashboard.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url.includes(urlToOpen.split('?')[0]) && 'focus' in client) {
          return client.focus();
        }
      }

      // Open new window if no existing window found
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});

/**
 * Background Sync Handler
 * Handle offline actions when connection is restored
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'job-search-sync') {
    event.waitUntil(syncJobData());
  } else if (event.tag === 'alert-preferences-sync') {
    event.waitUntil(syncAlertPreferences());
  }
});

/**
 * Message Handler
 * Handle messages from the main thread
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'CACHE_JOB_DATA':
      event.waitUntil(cacheJobData(payload));
      break;
    case 'CLEAR_CACHE':
      event.waitUntil(clearCache(payload.cacheType));
      break;
    case 'UPDATE_CACHE':
      event.waitUntil(updateCache());
      break;
    case 'GET_CACHE_STATUS':
      event.waitUntil(
        getCacheStatus().then((status) => {
          event.ports[0].postMessage(status);
        }),
      );
      break;
  }
});

// ===== CACHING STRATEGIES =====

/**
 * Cache First Strategy
 * For static assets that rarely change
 */
async function cacheFirst(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }
    const response = await fetch(request);

    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('[SW] Cache first error:', error);
    return new Response('Offline - Asset not available', { status: 503 });
  }
}

/**
 * Network First Strategy
 * For dynamic content that needs to be fresh
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (_error) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return (
        caches.match('/offline.html') ||
        new Response('Offline - Page not available', {
          status: 503,
          headers: { 'Content-Type': 'text/html' },
        })
      );
    }

    return new Response('Offline - Resource not available', { status: 503 });
  }
}

/**
 * Stale While Revalidate Strategy
 * For API data that can be stale but should update in background
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  // Always try to fetch in background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch((_error) => {});

  // Return cached version immediately if available
  if (cached) {
    return cached;
  }
  return fetchPromise;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Check if request is for a static asset
 */
function isStaticAsset(request) {
  const url = new URL(request.url);
  return (
    STATIC_ASSETS.some((asset) => url.pathname === asset || url.href === asset) ||
    url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|ico)$/)
  );
}

/**
 * Check if request is for API
 */
function isApiRequest(request) {
  const url = new URL(request.url);
  return (
    url.pathname.startsWith('/api/') || API_PATTERNS.some((pattern) => pattern.test(url.pathname))
  );
}

/**
 * Check if request should use network-first strategy
 */
function isNetworkFirstPattern(request) {
  const url = new URL(request.url);
  return NETWORK_FIRST_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

/**
 * Sync job data when back online
 */
async function syncJobData() {
  try {
    // Get pending sync data from IndexedDB
    const pendingData = await getPendingSyncData('job-searches');

    for (const data of pendingData) {
      try {
        await fetch('/api/v2/jobs/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        // Remove from pending sync
        await removePendingSyncData('job-searches', data.id);
      } catch (error) {
        console.error('[SW] Failed to sync job search:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Job data sync failed:', error);
  }
}

/**
 * Sync alert preferences when back online
 */
async function syncAlertPreferences() {
  try {
    const pendingData = await getPendingSyncData('alert-preferences');

    for (const data of pendingData) {
      try {
        await fetch('/api/v2/alerts/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        await removePendingSyncData('alert-preferences', data.id);
      } catch (error) {
        console.error('[SW] Failed to sync alert preferences:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Alert preferences sync failed:', error);
  }
}

/**
 * Cache job data for offline access
 */
async function cacheJobData(data) {
  try {
    const cache = await caches.open(API_CACHE);
    const response = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });

    await cache.put('/api/v2/jobs/cached', response);
  } catch (error) {
    console.error('[SW] Failed to cache job data:', error);
  }
}

/**
 * Clear specific cache type
 */
async function clearCache(cacheType) {
  try {
    const cacheName = `${CACHE_PREFIX}-${cacheType}-v${SW_VERSION}`;
    await caches.delete(cacheName);
  } catch (error) {
    console.error('[SW] Failed to clear cache:', error);
  }
}

/**
 * Update all caches
 */
async function updateCache() {
  try {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(
      STATIC_ASSETS.map(async (asset) => {
        try {
          const response = await fetch(asset);
          if (response.ok) {
            await cache.put(asset, response);
          }
        } catch (_error) {}
      }),
    );
  } catch (error) {
    console.error('[SW] Cache update failed:', error);
  }
}

/**
 * Get cache status information
 */
async function getCacheStatus() {
  try {
    const cacheNames = await caches.keys();
    const status = {
      version: SW_VERSION,
      caches: {},
      totalSize: 0,
    };

    for (const cacheName of cacheNames) {
      if (cacheName.startsWith(CACHE_PREFIX)) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        status.caches[cacheName] = {
          itemCount: keys.length,
          lastUpdated: Date.now(), // Simplified - in real implementation, track actual timestamps
        };
      }
    }

    return status;
  } catch (error) {
    console.error('[SW] Failed to get cache status:', error);
    return { error: error.message };
  }
}

// ===== INDEXEDDB HELPERS =====

/**
 * Get pending sync data from IndexedDB
 */
async function getPendingSyncData(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('job-search-sync', 1);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
  });
}

/**
 * Remove pending sync data from IndexedDB
 */
async function removePendingSyncData(storeName, id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('job-search-sync', 1);

    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const deleteRequest = store.delete(id);

      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}
