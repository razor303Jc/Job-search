/**
 * Mobile PWA Components
 * Mobile-first responsive design and touch optimization
 * Stage 6 PWA Implementation - Phase 7
 */

interface TouchGestureEvent {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  deltaX: number;
  deltaY: number;
  duration: number;
  type: 'swipe' | 'tap' | 'pinch' | 'long-press';
  direction?: 'left' | 'right' | 'up' | 'down';
}

interface MobileNavigationConfig {
  enableSwipeNavigation: boolean;
  enablePullToRefresh: boolean;
  enableTouchFeedback: boolean;
  swipeThreshold: number;
  longPressDelay: number;
}

class MobilePWAComponents {
  private config: MobileNavigationConfig;
  private touchStartTime: number = 0;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private isLongPress: boolean = false;
  private longPressTimer: number = 0;
  private pullToRefreshEnabled: boolean = false;
  private refreshThreshold: number = 80;

  constructor(config: Partial<MobileNavigationConfig> = {}) {
    this.config = {
      enableSwipeNavigation: true,
      enablePullToRefresh: true,
      enableTouchFeedback: true,
      swipeThreshold: 100,
      longPressDelay: 500,
      ...config
    };

    this.init();
  }

  /**
   * Initialize mobile PWA components
   */
  private init(): void {
    console.log('[Mobile PWA] Initializing mobile components...');

    // Add mobile-specific styles
    this.addMobileStyles();

    // Set up touch gestures
    if (this.config.enableSwipeNavigation) {
      this.setupSwipeNavigation();
    }

    // Set up pull-to-refresh
    if (this.config.enablePullToRefresh) {
      this.setupPullToRefresh();
    }

    // Set up touch feedback
    if (this.config.enableTouchFeedback) {
      this.setupTouchFeedback();
    }

    // Set up mobile navigation
    this.setupMobileNavigation();

    // Set up responsive layouts
    this.setupResponsiveLayouts();

    // Set up virtual keyboard handling
    this.setupVirtualKeyboardHandling();

    // Set up orientation change handling
    this.setupOrientationHandling();

    console.log('[Mobile PWA] Mobile components initialized');
  }

  /**
   * Add mobile-specific CSS styles
   */
  private addMobileStyles(): void {
    const styleId = 'mobile-pwa-styles';
    if (document.getElementById(styleId)) return;

    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
      /* Mobile PWA Styles */
      
      /* Touch-friendly interactive elements */
      .touch-target {
        min-height: 44px;
        min-width: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        -webkit-tap-highlight-color: transparent;
      }
      
      /* Touch feedback */
      .touch-feedback {
        position: relative;
        overflow: hidden;
      }
      
      .touch-feedback::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
        transform: scale(0);
        transition: transform 0.3s ease;
        pointer-events: none;
        z-index: 1;
      }
      
      .touch-feedback.active::before {
        transform: scale(1);
      }
      
      /* Mobile navigation */
      .mobile-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: white;
        border-top: 1px solid #e5e7eb;
        padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
        z-index: 1000;
        transform: translateY(0);
        transition: transform 0.3s ease;
      }
      
      .mobile-nav.hidden {
        transform: translateY(100%);
      }
      
      .mobile-nav-items {
        display: flex;
        justify-content: space-around;
        align-items: center;
      }
      
      .mobile-nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 8px 12px;
        text-decoration: none;
        color: #6b7280;
        transition: color 0.2s ease;
        min-width: 60px;
      }
      
      .mobile-nav-item.active {
        color: #2563eb;
      }
      
      .mobile-nav-icon {
        font-size: 20px;
      }
      
      .mobile-nav-label {
        font-size: 11px;
        font-weight: 500;
      }
      
      /* Pull to refresh */
      .pull-to-refresh {
        position: fixed;
        top: 0;
        left: 50%;
        transform: translateX(-50%) translateY(-100%);
        background: #2563eb;
        color: white;
        padding: 12px 24px;
        border-radius: 0 0 12px 12px;
        font-size: 14px;
        font-weight: 500;
        transition: transform 0.3s ease;
        z-index: 1001;
      }
      
      .pull-to-refresh.visible {
        transform: translateX(-50%) translateY(0);
      }
      
      /* Swipe indicators */
      .swipe-indicator {
        position: fixed;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 1002;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .swipe-indicator.left {
        left: 20px;
      }
      
      .swipe-indicator.right {
        right: 20px;
      }
      
      .swipe-indicator.visible {
        opacity: 1;
      }
      
      /* Mobile-specific layouts */
      @media (max-width: 768px) {
        body {
          padding-bottom: 70px; /* Space for mobile nav */
        }
        
        .container {
          padding: 16px;
        }
        
        .card-grid {
          grid-template-columns: 1fr;
          gap: 16px;
        }
        
        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        
        .button-group {
          flex-direction: column;
          gap: 12px;
        }
        
        .button-group .btn {
          width: 100%;
        }
        
        /* Form optimizations */
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-control {
          font-size: 16px; /* Prevent zoom on iOS */
          padding: 12px 16px;
          border-radius: 8px;
        }
        
        .select-input {
          font-size: 16px;
          padding: 12px 16px;
          border-radius: 8px;
        }
        
        /* Touch-friendly spacing */
        .touch-list {
          list-style: none;
          padding: 0;
        }
        
        .touch-list-item {
          display: flex;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #f3f4f6;
          min-height: 60px;
        }
        
        .touch-list-item:active {
          background: #f9fafb;
        }
      }
      
      /* Landscape orientation optimizations */
      @media (max-width: 768px) and (orientation: landscape) {
        .mobile-nav {
          position: fixed;
          top: 0;
          bottom: auto;
          padding: calc(8px + env(safe-area-inset-top)) 0 8px 0;
          border-top: none;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .mobile-nav.hidden {
          transform: translateY(-100%);
        }
        
        body {
          padding-top: 60px;
          padding-bottom: 0;
        }
      }
      
      /* Safe area handling */
      @supports (padding: env(safe-area-inset-bottom)) {
        .mobile-nav {
          padding-bottom: calc(8px + env(safe-area-inset-bottom));
        }
        
        body {
          padding-bottom: calc(70px + env(safe-area-inset-bottom));
        }
      }
      
      /* Dark mode support for mobile */
      @media (prefers-color-scheme: dark) {
        .mobile-nav {
          background: #1f2937;
          border-top-color: #374151;
          color: #f9fafb;
        }
        
        .mobile-nav-item {
          color: #9ca3af;
        }
        
        .mobile-nav-item.active {
          color: #60a5fa;
        }
        
        .touch-list-item {
          border-bottom-color: #374151;
        }
        
        .touch-list-item:active {
          background: #374151;
        }
      }
      
      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .touch-feedback::before,
        .mobile-nav,
        .pull-to-refresh,
        .swipe-indicator {
          transition: none;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Set up swipe navigation
   */
  private setupSwipeNavigation(): void {
    document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
  }

  /**
   * Handle touch start for gesture detection
   */
  private handleTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    this.touchStartTime = Date.now();
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.isLongPress = false;

    // Set up long press detection
    this.longPressTimer = window.setTimeout(() => {
      this.isLongPress = true;
      this.handleLongPress(touch.clientX, touch.clientY);
    }, this.config.longPressDelay);
  }

  /**
   * Handle touch end for gesture recognition
   */
  private handleTouchEnd(event: TouchEvent): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }

    if (event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const endTime = Date.now();
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    const duration = endTime - this.touchStartTime;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Create gesture event
    const gestureEvent: TouchGestureEvent = {
      startX: this.touchStartX,
      startY: this.touchStartY,
      endX: touch.clientX,
      endY: touch.clientY,
      deltaX,
      deltaY,
      duration,
      type: 'tap'
    };

    // Detect gesture type
    if (this.isLongPress) {
      gestureEvent.type = 'long-press';
    } else if (distance > this.config.swipeThreshold) {
      gestureEvent.type = 'swipe';
      
      // Determine swipe direction
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        gestureEvent.direction = deltaX > 0 ? 'right' : 'left';
      } else {
        gestureEvent.direction = deltaY > 0 ? 'down' : 'up';
      }
    }

    this.handleGesture(gestureEvent);
  }

  /**
   * Handle recognized gestures
   */
  private handleGesture(gesture: TouchGestureEvent): void {
    console.log('[Mobile PWA] Gesture detected:', gesture.type, gesture.direction);

    switch (gesture.type) {
      case 'swipe':
        this.handleSwipe(gesture);
        break;
      case 'long-press':
        // Already handled in handleLongPress
        break;
      case 'tap':
        this.handleTap(gesture);
        break;
    }

    // Emit custom event
    window.dispatchEvent(new CustomEvent('mobile-gesture', { detail: gesture }));
  }

  /**
   * Handle swipe gestures
   */
  private handleSwipe(gesture: TouchGestureEvent): void {
    const { direction } = gesture;

    // Show swipe indicator
    this.showSwipeIndicator(direction!);

    // Handle navigation swipes
    switch (direction) {
      case 'left':
        this.navigateNext();
        break;
      case 'right':
        this.navigatePrevious();
        break;
      case 'down':
        if (window.scrollY === 0 && this.config.enablePullToRefresh) {
          this.triggerPullToRefresh();
        }
        break;
    }
  }

  /**
   * Handle tap gestures
   */
  private handleTap(gesture: TouchGestureEvent): void {
    // Add touch feedback to tapped element
    const element = document.elementFromPoint(gesture.endX, gesture.endY);
    if (element && this.config.enableTouchFeedback) {
      this.addTouchFeedback(element as HTMLElement);
    }
  }

  /**
   * Handle long press gestures
   */
  private handleLongPress(x: number, y: number): void {
    console.log('[Mobile PWA] Long press detected');
    
    // Add haptic feedback if supported
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    // Show context menu or action sheet
    const element = document.elementFromPoint(x, y);
    if (element) {
      this.showContextMenu(element as HTMLElement, x, y);
    }
  }

  /**
   * Show swipe indicator
   */
  private showSwipeIndicator(direction: string): void {
    const indicator = document.createElement('div');
    indicator.className = `swipe-indicator ${direction}`;
    
    const messages = {
      left: '→ Next',
      right: '← Previous',
      up: '↑ Scroll up',
      down: '↓ Refresh'
    };
    
    indicator.textContent = messages[direction as keyof typeof messages] || '';
    document.body.appendChild(indicator);

    // Show and hide indicator
    setTimeout(() => indicator.classList.add('visible'), 10);
    setTimeout(() => {
      indicator.classList.remove('visible');
      setTimeout(() => document.body.removeChild(indicator), 300);
    }, 1000);
  }

  /**
   * Navigate to next page
   */
  private navigateNext(): void {
    const currentPage = window.location.pathname;
    const pages = [
      '/enhanced-dashboard.html',
      '/advanced-job-search.html',
      '/live-scraping.html',
      '/job-alerts.html',
      '/job-comparison.html'
    ];

    const currentIndex = pages.indexOf(currentPage);
    if (currentIndex !== -1 && currentIndex < pages.length - 1) {
      window.location.href = pages[currentIndex + 1];
    }
  }

  /**
   * Navigate to previous page
   */
  private navigatePrevious(): void {
    const currentPage = window.location.pathname;
    const pages = [
      '/enhanced-dashboard.html',
      '/advanced-job-search.html',
      '/live-scraping.html',
      '/job-alerts.html',
      '/job-comparison.html'
    ];

    const currentIndex = pages.indexOf(currentPage);
    if (currentIndex > 0) {
      window.location.href = pages[currentIndex - 1];
    }
  }

  /**
   * Set up pull-to-refresh
   */
  private setupPullToRefresh(): void {
    let startY = 0;
    let currentY = 0;
    let pulling = false;

    document.addEventListener('touchstart', (event) => {
      if (window.scrollY === 0) {
        startY = event.touches[0].clientY;
        pulling = false;
      }
    }, { passive: true });

    document.addEventListener('touchmove', (event) => {
      if (window.scrollY === 0 && startY > 0) {
        currentY = event.touches[0].clientY;
        const pullDistance = currentY - startY;

        if (pullDistance > 0) {
          pulling = true;
          this.showPullToRefreshIndicator(pullDistance);
        }
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (pulling) {
        const pullDistance = currentY - startY;
        if (pullDistance > this.refreshThreshold) {
          this.triggerPullToRefresh();
        }
        this.hidePullToRefreshIndicator();
        pulling = false;
      }
      startY = 0;
    }, { passive: true });
  }

  /**
   * Show pull-to-refresh indicator
   */
  private showPullToRefreshIndicator(distance: number): void {
    let indicator = document.querySelector('.pull-to-refresh') as HTMLElement;
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'pull-to-refresh';
      indicator.innerHTML = '↓ Pull to refresh';
      document.body.appendChild(indicator);
    }

    const progress = Math.min(distance / this.refreshThreshold, 1);
    indicator.style.transform = `translateX(-50%) translateY(${-100 + progress * 100}%)`;
    
    if (progress >= 1) {
      indicator.innerHTML = '↑ Release to refresh';
      indicator.classList.add('ready');
    } else {
      indicator.innerHTML = '↓ Pull to refresh';
      indicator.classList.remove('ready');
    }
  }

  /**
   * Hide pull-to-refresh indicator
   */
  private hidePullToRefreshIndicator(): void {
    const indicator = document.querySelector('.pull-to-refresh') as HTMLElement;
    if (indicator) {
      indicator.style.transform = 'translateX(-50%) translateY(-100%)';
    }
  }

  /**
   * Trigger pull-to-refresh action
   */
  private triggerPullToRefresh(): void {
    console.log('[Mobile PWA] Pull to refresh triggered');
    
    const indicator = document.querySelector('.pull-to-refresh') as HTMLElement;
    if (indicator) {
      indicator.innerHTML = '🔄 Refreshing...';
      indicator.classList.add('refreshing');
    }

    // Emit refresh event
    window.dispatchEvent(new CustomEvent('mobile-refresh'));

    // Hide indicator after refresh completes
    setTimeout(() => {
      this.hidePullToRefreshIndicator();
      const refreshIndicator = document.querySelector('.pull-to-refresh');
      if (refreshIndicator) {
        refreshIndicator.classList.remove('refreshing', 'ready');
      }
    }, 2000);
  }

  /**
   * Set up touch feedback
   */
  private setupTouchFeedback(): void {
    document.addEventListener('touchstart', (event) => {
      const target = event.target as HTMLElement;
      if (this.shouldAddTouchFeedback(target)) {
        this.addTouchFeedback(target);
      }
    }, { passive: true });
  }

  /**
   * Check if element should have touch feedback
   */
  private shouldAddTouchFeedback(element: HTMLElement): boolean {
    const touchElements = ['button', 'a', '.btn', '.card', '.touch-target'];
    
    return touchElements.some(selector => {
      if (selector.startsWith('.')) {
        return element.classList.contains(selector.substring(1));
      } else {
        return element.tagName.toLowerCase() === selector;
      }
    });
  }

  /**
   * Add touch feedback to element
   */
  private addTouchFeedback(element: HTMLElement): void {
    if (!element.classList.contains('touch-feedback')) {
      element.classList.add('touch-feedback');
    }

    element.classList.add('active');
    
    setTimeout(() => {
      element.classList.remove('active');
    }, 300);
  }

  /**
   * Set up mobile navigation
   */
  private setupMobileNavigation(): void {
    // Create mobile navigation if it doesn't exist
    if (!document.querySelector('.mobile-nav')) {
      this.createMobileNavigation();
    }

    // Handle scroll to hide/show navigation
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateNavVisibility = () => {
      const currentScrollY = window.scrollY;
      const nav = document.querySelector('.mobile-nav') as HTMLElement;
      
      if (nav) {
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          nav.classList.add('hidden');
        } else {
          nav.classList.remove('hidden');
        }
      }
      
      lastScrollY = currentScrollY;
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateNavVisibility);
        ticking = true;
      }
    }, { passive: true });
  }

  /**
   * Create mobile navigation
   */
  private createMobileNavigation(): void {
    const nav = document.createElement('nav');
    nav.className = 'mobile-nav';
    
    const navItems = [
      { href: '/enhanced-dashboard.html', icon: '📊', label: 'Dashboard' },
      { href: '/advanced-job-search.html', icon: '🔍', label: 'Search' },
      { href: '/live-scraping.html', icon: '⚡', label: 'Live' },
      { href: '/job-alerts.html', icon: '🔔', label: 'Alerts' },
      { href: '/job-comparison.html', icon: '⚖️', label: 'Compare' }
    ];

    const navItemsHtml = navItems.map(item => `
      <a href="${item.href}" class="mobile-nav-item ${window.location.pathname === item.href ? 'active' : ''}">
        <span class="mobile-nav-icon">${item.icon}</span>
        <span class="mobile-nav-label">${item.label}</span>
      </a>
    `).join('');

    nav.innerHTML = `<div class="mobile-nav-items">${navItemsHtml}</div>`;
    document.body.appendChild(nav);
  }

  /**
   * Set up responsive layouts
   */
  private setupResponsiveLayouts(): void {
    // Handle viewport changes
    const handleViewportChange = () => {
      const viewport = window.visualViewport;
      if (viewport) {
        document.documentElement.style.setProperty('--viewport-height', `${viewport.height}px`);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      handleViewportChange();
    }

    // Handle resize events
    window.addEventListener('resize', () => {
      this.updateResponsiveElements();
    });

    this.updateResponsiveElements();
  }

  /**
   * Update responsive elements
   */
  private updateResponsiveElements(): void {
    const isMobile = window.innerWidth <= 768;
    document.body.classList.toggle('mobile', isMobile);
    
    // Update charts for mobile
    if ((window as any).Chart) {
      (window as any).Chart.instances.forEach((chart: any) => {
        if (chart && chart.resize) {
          chart.resize();
        }
      });
    }
  }

  /**
   * Set up virtual keyboard handling
   */
  private setupVirtualKeyboardHandling(): void {
    const inputs = document.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        // Scroll element into view when focused
        setTimeout(() => {
          (input as HTMLElement).scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }, 300);
      });
    });
  }

  /**
   * Set up orientation change handling
   */
  private setupOrientationHandling(): void {
    window.addEventListener('orientationchange', () => {
      // Wait for orientation change to complete
      setTimeout(() => {
        this.updateResponsiveElements();
        
        // Trigger resize event for charts and other components
        window.dispatchEvent(new Event('resize'));
      }, 100);
    });
  }

  /**
   * Show context menu
   */
  private showContextMenu(element: HTMLElement, x: number, y: number): void {
    // Implementation depends on specific needs
    console.log('[Mobile PWA] Context menu for element:', element, 'at position:', x, y);
    
    // Could show action sheet, context menu, etc.
    // For now, just emit an event
    window.dispatchEvent(new CustomEvent('mobile-context-menu', {
      detail: { element, x, y }
    }));
  }

  /**
   * Get mobile status
   */
  public getStatus(): object {
    return {
      isMobile: window.innerWidth <= 768,
      orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
      hasTouch: 'ontouchstart' in window,
      hasVibration: 'vibrate' in navigator,
      viewportHeight: window.visualViewport ? window.visualViewport.height : window.innerHeight,
      safeArea: {
        top: getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)'),
        bottom: getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)')
      }
    };
  }
}

// Initialize mobile PWA components
const mobilePWA = new MobilePWAComponents();

// Export for global access
(window as any).mobilePWA = mobilePWA;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobilePWAComponents;
}
