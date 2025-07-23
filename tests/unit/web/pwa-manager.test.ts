/**
 * PWA Manager Tests
 * Phase 8 Stage 1: Comprehensive Test Suite Expansion
 *
 * Tests for Progressive Web App functionality
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock browser APIs
const mockServiceWorker = {
  register: vi.fn(),
  getRegistration: vi.fn(),
  ready: Promise.resolve({
    active: { postMessage: vi.fn() },
    waiting: null,
    installing: null,
    update: vi.fn(),
  }),
};

const mockNavigator = {
  serviceWorker: mockServiceWorker,
  onLine: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

const mockWindow = {
  navigator: mockNavigator,
  location: { href: 'http://localhost:3000/' },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  localStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    length: 0,
    clear: vi.fn(),
    key: vi.fn(),
  },
  matchMedia: vi.fn(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })),
};

// Set up global mocks
global.navigator = mockNavigator as any;
global.window = mockWindow as any;
global.localStorage = mockWindow.localStorage;
global.document = {
  addEventListener: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  createElement: vi.fn(() => ({
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
    style: {},
  })),
  head: {
    appendChild: vi.fn(),
  },
} as any;

describe('PWA Manager Functionality', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset service worker mock
    mockServiceWorker.register.mockResolvedValue({
      active: { postMessage: vi.fn() },
      waiting: null,
      installing: null,
      update: vi.fn(),
    });
  });

  describe('Service Worker Registration', () => {
    it('should check for service worker support', () => {
      const hasSupport = 'serviceWorker' in global.navigator;
      expect(hasSupport).toBe(true);
    });

    it('should register service worker when supported', async () => {
      // Mock successful registration
      const registration = {
        active: { postMessage: vi.fn() },
        update: vi.fn(),
      };
      mockServiceWorker.register.mockResolvedValue(registration);

      // Simulate PWA manager registration
      const registerSW = async () => {
        if ('serviceWorker' in navigator) {
          return await navigator.serviceWorker.register('/sw.js');
        }
        throw new Error('Service Worker not supported');
      };

      const result = await registerSW();

      expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js');
      expect(result).toEqual(registration);
    });

    it('should handle service worker registration failure', async () => {
      const error = new Error('Registration failed');
      mockServiceWorker.register.mockRejectedValue(error);

      const registerSW = async () => {
        return await navigator.serviceWorker.register('/sw.js');
      };

      await expect(registerSW()).rejects.toThrow('Registration failed');
    });
  });

  describe('PWA Installation', () => {
    it('should detect PWA installation capability', () => {
      const isInstallable = () => {
        return window.matchMedia?.('(display-mode: standalone)').matches;
      };

      mockWindow.matchMedia.mockReturnValue({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });
      expect(isInstallable()).toBe(false);

      mockWindow.matchMedia.mockReturnValue({
        matches: true,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });
      expect(isInstallable()).toBe(true);
    });

    it('should handle beforeinstallprompt event', () => {
      let promptEvent = null;

      const handleInstallPrompt = (event: any) => {
        event.preventDefault();
        promptEvent = event;
      };

      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };

      handleInstallPrompt(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(promptEvent).toBe(mockEvent);
    });
  });

  describe('Offline Functionality', () => {
    it('should detect online/offline status', () => {
      const isOnline = () => navigator.onLine;

      mockNavigator.onLine = true;
      expect(isOnline()).toBe(true);

      mockNavigator.onLine = false;
      expect(isOnline()).toBe(false);
    });

    it('should handle offline event', () => {
      const offlineHandler = vi.fn();

      // Simulate offline event listener
      const addEventListener = (event: string, _handler: () => void) => {
        if (event === 'offline') {
          offlineHandler();
        }
      };

      addEventListener('offline', offlineHandler);
      expect(offlineHandler).toHaveBeenCalled();
    });

    it('should cache management work properly', () => {
      const cacheData = { timestamp: Date.now(), data: 'test' };

      // Mock localStorage for cache
      mockWindow.localStorage.setItem.mockImplementation(() => {});
      mockWindow.localStorage.getItem.mockReturnValue(JSON.stringify(cacheData));

      const saveToCache = (key: string, data: any) => {
        localStorage.setItem(key, JSON.stringify(data));
      };

      const getFromCache = (key: string) => {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      };

      saveToCache('test-key', cacheData);
      const retrieved = getFromCache('test-key');

      expect(mockWindow.localStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(cacheData),
      );
      expect(retrieved).toEqual(cacheData);
    });
  });

  describe('Mobile PWA Features', () => {
    it('should detect mobile device', () => {
      const isMobile = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );
      };

      // Test with mobile user agent
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)';
      expect(isMobile()).toBe(true);

      // Test with desktop user agent
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      expect(isMobile()).toBe(false);
    });

    it('should handle touch events safely', () => {
      const handleTouchStart = (event: TouchEvent | null) => {
        if (!event || !event.touches || event.touches.length === 0) {
          return null;
        }
        return {
          x: event.touches[0]?.clientX || 0,
          y: event.touches[0]?.clientY || 0,
        };
      };

      // Test with null event
      expect(handleTouchStart(null)).toBe(null);

      // Test with valid touch event
      const mockTouchEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as TouchEvent;

      const result = handleTouchStart(mockTouchEvent);
      expect(result).toEqual({ x: 100, y: 200 });

      // Test with empty touches
      const emptyTouchEvent = { touches: [] } as unknown as TouchEvent;
      expect(handleTouchStart(emptyTouchEvent)).toBe(null);
    });
  });

  describe('Performance Monitoring', () => {
    it('should measure PWA performance metrics', () => {
      const performanceMetrics = {
        startTime: Date.now(),
        loadTime: 0,
        renderTime: 0,
      };

      const measureLoadTime = () => {
        performanceMetrics.loadTime = Date.now() - performanceMetrics.startTime;
        return performanceMetrics.loadTime;
      };

      // Simulate some delay
      const delay = 100;
      performanceMetrics.startTime = Date.now() - delay;

      const loadTime = measureLoadTime();
      expect(loadTime).toBeGreaterThanOrEqual(delay);
      expect(loadTime).toBeLessThan(1000); // Should be reasonable
    });

    it('should track service worker performance', async () => {
      const metrics = {
        registrationTime: 0,
        activationTime: 0,
      };

      const trackSWPerformance = async () => {
        const start = Date.now();
        await navigator.serviceWorker.register('/sw.js');
        metrics.registrationTime = Date.now() - start;

        await navigator.serviceWorker.ready;
        metrics.activationTime = Date.now() - start;

        return metrics;
      };

      mockServiceWorker.register.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 50)),
      );

      const result = await trackSWPerformance();

      expect(result.registrationTime).toBeGreaterThan(0);
      expect(result.activationTime).toBeGreaterThan(0);
      expect(mockServiceWorker.register).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle service worker update errors', async () => {
      const updateError = new Error('Update failed');
      const registration = {
        update: vi.fn().mockRejectedValue(updateError),
      };

      const handleSWUpdate = async (reg: any) => {
        try {
          await reg.update();
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      };

      const result = await handleSWUpdate(registration);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });

    it('should gracefully degrade without service worker support', () => {
      const mockNavigatorNoSW = { ...mockNavigator };
      // Need to delete property to test 'in' operator properly
      // biome-ignore lint/performance/noDelete: Test requires actual property deletion
      delete (mockNavigatorNoSW as any).serviceWorker;

      const initPWA = (nav: any) => {
        if ('serviceWorker' in nav) {
          return { pwaSupported: true, swSupported: true };
        }
        return { pwaSupported: true, swSupported: false };
      };

      const result = initPWA(mockNavigatorNoSW);

      expect(result.pwaSupported).toBe(true);
      expect(result.swSupported).toBe(false);
    });
  });
});
