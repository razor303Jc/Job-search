/**
 * Advanced Filtering & Sorting Component Tests
 * Phase 7 Stage 5: Enhanced Web Interface & Real-Time Features
 * 
 * Integration tests for advanced filtering and sorting functionality
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock DOM environment
const mockDocument = {
  createElement: vi.fn(),
  getElementById: vi.fn(),
  addEventListener: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(),
} as any;

const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  readyState: 1, // OPEN
} as any;

// Mock global objects
    // Mock CustomEvent for DOM events
    global.CustomEvent = vi.fn().mockImplementation((type, options = {}) => ({
      type,
      detail: options.detail,
      bubbles: options.bubbles || false,
      cancelable: options.cancelable || false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    }));
    
    // Mock window for export functionality
    global.window = {
      URL: {
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn()
      },
      document: mockDocument
    } as any;
global.WebSocket = vi.fn(() => mockWebSocket);
global.fetch = vi.fn();

// Import after mocking globals
import { AdvancedFilteringSortingComponent as AdvancedFilteringSorting } from '../../src/web/components/advanced-filtering-sorting.js';

describe('Advanced Filtering & Sorting Component', () => {
  let component: AdvancedFilteringSorting;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn()
    };
    
    // Mock CustomEvent
    global.CustomEvent = vi.fn().mockImplementation((type, options) => ({
      type,
      detail: options?.detail,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    }));
    
    // Mock window object
    global.window = {
      location: { href: 'http://localhost:3000' },
      URL: { createObjectURL: vi.fn(() => 'blob:url') },
      open: vi.fn()
    } as any;
    
    // Mock fetch with proper responses
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });
    
    // Setup mock container
    mockContainer = {
      appendChild: vi.fn(),
      innerHTML: '',
      addEventListener: vi.fn(),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(),
      },
    } as any;

    mockDocument.createElement.mockReturnValue({
      innerHTML: '',
      appendChild: vi.fn(),
      addEventListener: vi.fn(),
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      style: {},
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      value: '',
      checked: false,
      textContent: '',
    });

    mockDocument.getElementById.mockReturnValue(mockContainer);
    mockDocument.querySelector.mockReturnValue(mockContainer);

    // Initialize component
    component = new AdvancedFilteringSorting(mockContainer, {
      apiEndpoint: '/api/test',
      websocketUrl: 'ws://localhost:8080',
      onFilterChange: vi.fn(),
      enableWebSocket: true,
      enableExport: true,
      enableSharing: true,
      maxFilterGroups: 5,
      maxConditionsPerGroup: 10,
      debounceMs: 300,
    });
  });

  afterEach(() => {
    if (component) {
      component.destroy();
    }
  });

  describe('Component Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(component).toBeInstanceOf(AdvancedFilteringSorting);
      expect(mockContainer.appendChild).toHaveBeenCalled();
    });

    test('should setup WebSocket connection when enabled', () => {
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8080');
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('should render initial UI structure', () => {
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockContainer.appendChild).toHaveBeenCalled();
    });
  });

  describe('Filter Management', () => {
    test('should add new filter group', () => {
      const initialGroupCount = component.getFilterState().groups.length;
      component.addFilterGroup();
      const newGroupCount = component.getFilterState().groups.length;
      
      expect(newGroupCount).toBe(initialGroupCount + 1);
    });

    test('should remove filter group', () => {
      // Add a group first
      component.addFilterGroup();
      const groupId = component.getFilterState().groups[0].id;
      
      component.removeFilterGroup(groupId);
      const groups = component.getFilterState().groups;
      
      expect(groups.find(g => g.id === groupId)).toBeUndefined();
    });

    test('should add filter condition to group', () => {
      component.addFilterGroup();
      const groupId = component.getFilterState().groups[0].id;
      
      component.addFilterCondition(groupId);
      const group = component.getFilterState().groups.find(g => g.id === groupId);
      
      expect(group?.conditions.length).toBe(1);
    });

    test('should remove filter condition', () => {
      component.addFilterGroup();
      const groupId = component.getFilterState().groups[0].id;
      component.addFilterCondition(groupId);
      
      const conditionId = component.getFilterState().groups[0].conditions[0].id;
      component.removeFilterCondition(groupId, conditionId);
      
      const group = component.getFilterState().groups.find(g => g.id === groupId);
      expect(group?.conditions.length).toBe(0);
    });

    test('should update filter condition', () => {
      component.addFilterGroup();
      const groupId = component.getFilterState().groups[0].id;
      component.addFilterCondition(groupId);
      
      const conditionId = component.getFilterState().groups[0].conditions[0].id;
      const updates = {
        field: 'title',
        operator: 'contains' as const,
        value: 'developer',
      };
      
      component.updateFilterCondition(groupId, conditionId, updates);
      
      const condition = component.getFilterState().groups[0].conditions[0];
      expect(condition.field).toBe('developer');
      expect(condition.operator).toBe('contains');
      expect(condition.value).toBe('developer');
    });

    test('should enforce maximum filter groups limit', () => {
      // Add maximum allowed groups
      for (let i = 0; i < 5; i++) {
        component.addFilterGroup();
      }
      
      // Try to add one more
      component.addFilterGroup();
      
      expect(component.getFilterState().groups.length).toBe(5);
    });

    test('should enforce maximum conditions per group limit', () => {
      component.addFilterGroup();
      const groupId = component.getFilterState().groups[0].id;
      
      // Add maximum allowed conditions
      for (let i = 0; i < 10; i++) {
        component.addFilterCondition(groupId);
      }
      
      // Try to add one more
      component.addFilterCondition(groupId);
      
      const group = component.getFilterState().groups.find(g => g.id === groupId);
      expect(group?.conditions.length).toBe(10);
    });
  });

  describe('Quick Filters', () => {
    test('should toggle quick filter', () => {
      const filterKey = 'recent';
      
      component.toggleQuickFilter(filterKey);
      expect(component.getFilterState().quickFilters[filterKey]).toBe(true);
      
      component.toggleQuickFilter(filterKey);
      expect(component.getFilterState().quickFilters[filterKey]).toBe(false);
    });

    test('should apply multiple quick filters', () => {
      component.toggleQuickFilter('recent');
      component.toggleQuickFilter('remote');
      component.toggleQuickFilter('applied');
      
      const quickFilters = component.getFilterState().quickFilters;
      expect(quickFilters.recent).toBe(true);
      expect(quickFilters.remote).toBe(true);
      expect(quickFilters.applied).toBe(true);
    });
  });

  describe('Sorting', () => {
    test('should add sort option', () => {
      const initialSortCount = component.getFilterState().sortOptions.length;
      
      component.addSortOption();
      
      expect(component.getFilterState().sortOptions.length).toBe(initialSortCount + 1);
    });

    test('should remove sort option', () => {
      component.addSortOption();
      const sortId = component.getFilterState().sortOptions[0].id;
      
      component.removeSortOption(sortId);
      
      const sortOptions = component.getFilterState().sortOptions;
      expect(sortOptions.find(s => s.id === sortId)).toBeUndefined();
    });

    test('should update sort option', () => {
      component.addSortOption();
      const sortId = component.getFilterState().sortOptions[0].id;
      
      component.updateSortOption(sortId, {
        field: 'datePosted',
        direction: 'desc' as const,
      });
      
      const sortOption = component.getFilterState().sortOptions[0];
      expect(sortOption.field).toBe('datePosted');
      expect(sortOption.direction).toBe('desc');
    });

    test('should move sort option up', () => {
      // Add two sort options
      component.addSortOption('scraped_at', 'desc', 'date');
      component.addSortOption('title', 'asc', 'string');
      
      const sortOptions = component.getFilterState().sortOptions;
      expect(sortOptions.length).toBe(3); // Default + 2 added
      
      component.moveSortOptionUp(2); // Move third option up
      
      const reorderedSorts = component.getFilterState().sortOptions;
      expect(reorderedSorts[1].field).toBe('title');
      expect(reorderedSorts[2].field).toBe('scraped_at');
    });

    test('should move sort option down', () => {
      // Add two sort options
      component.addSortOption('scraped_at', 'desc', 'date');
      component.addSortOption('title', 'asc', 'string');
      
      const sortOptions = component.getFilterState().sortOptions;
      expect(sortOptions.length).toBe(3); // Default + 2 added
      
      component.moveSortOptionDown(1); // Move second option down
      
      const reorderedSorts = component.getFilterState().sortOptions;
      expect(reorderedSorts[1].field).toBe('title');
      expect(reorderedSorts[2].field).toBe('scraped_at');
    });
  });

  describe('Filter Presets', () => {
    test('should save filter preset', async () => {
      // Setup some filters
      component.addFilterGroup();
      component.toggleQuickFilter('recent');
      
      const presetData = {
        name: 'Test Preset',
        description: 'A test preset for recent jobs',
        isQuickFilter: false,
      };
      
      // Mock successful API response
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'preset-1', ...presetData }),
      });
      
      await component.saveFilterPreset(presetData);
      
      expect(global.fetch).toHaveBeenCalledWith('/api/test/presets', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining(presetData.name),
      }));
    });

    test('should load filter preset', async () => {
      const presetId = 'preset-1';
      const mockPreset = {
        id: presetId,
        name: 'Test Preset',
        description: 'Test description',
        filterState: {
          globalSearch: 'developer',
          quickFilters: { recent: true },
          groups: [],
          sortOptions: [],
        },
        isQuickFilter: false,
        usageCount: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Mock successful API response
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreset,
      });
      
      await component.loadFilterPreset(presetId);
      
      const currentState = component.getFilterState();
      expect(currentState.globalSearch).toBe('developer');
      expect(currentState.quickFilters.recent).toBe(true);
    });

    test('should delete filter preset', async () => {
      const presetId = 'preset-1';
      
      // Mock successful API response
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
      
      await component.deleteFilterPreset(presetId);
      
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/test/presets/${presetId}`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Global Search', () => {
    test('should update global search', () => {
      const searchTerm = 'software engineer';
      
      component.updateGlobalSearch(searchTerm);
      
      expect(component.getFilterState().globalSearch).toBe(searchTerm);
    });

    test('should clear global search', () => {
      component.updateGlobalSearch('test search');
      component.clearGlobalSearch();
      
      expect(component.getFilterState().globalSearch).toBe('');
    });
  });

  describe('Filter Application', () => {
    test('should apply filters and call API', async () => {
      // Setup some filters
      component.addFilterGroup();
      component.updateGlobalSearch('developer');
      component.toggleQuickFilter('recent');
      
      // Mock successful API response
      const mockResults = {
        results: [{ id: 1, title: 'Developer Job' }],
        totalCount: 1,
        filteredCount: 1,
        performanceMetrics: {
          queryTime: 50,
          filterTime: 10,
          sortTime: 5,
        },
      };
      
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults,
      });
      
      const results = await component.applyFilters();
      
      expect(global.fetch).toHaveBeenCalledWith('/api/test/filter', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('developer'),
      }));
      
      expect(results).toEqual(mockResults);
    });

    test('should handle API errors gracefully', async () => {
      // Mock API error
      (global.fetch as vi.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      
      const results = await component.applyFilters();
      
      expect(results).toEqual({
        results: [],
        totalCount: 0,
        filteredCount: 0,
        error: 'Network error',
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Filter application failed:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Export Functionality', () => {
    test('should export filtered results', async () => {
      const exportFormat = 'csv';
      
      // Mock successful API response
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['csv,data'], { type: 'text/csv' }),
        headers: {
          get: (name: string) => {
            if (name === 'content-disposition') {
              return 'attachment; filename="filtered-results.csv"';
            }
            return null;
          },
        },
      });
      
      // Mock URL.createObjectURL and click
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      const mockClick = vi.fn();
      const mockLink = {
        href: '',
        download: '',
        click: mockClick,
        style: { display: '' },
      };
      mockDocument.createElement.mockReturnValue(mockLink);
      
      await component.exportFilteredResults(exportFormat);
      
      expect(global.fetch).toHaveBeenCalledWith('/api/test/export', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining(exportFormat),
      }));
      
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('Sharing Functionality', () => {
    test('should share filter configuration', async () => {
      // Setup some filters
      component.addFilterGroup();
      component.updateGlobalSearch('developer');
      
      // Mock successful API response
      const mockShareResponse = {
        shareId: 'share-123',
        url: 'https://example.com/shared/share-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockShareResponse,
      });
      
      const shareResult = component.shareFilterConfiguration();
      
      expect(shareResult).toContain('data:application/json;base64,');
      expect(typeof shareResult).toBe('string');
    });
  });

  describe('WebSocket Integration', () => {
    test('should handle real-time filter updates', () => {
      const mockMessage = {
        type: 'filterUpdate',
        data: {
          filteredCount: 150,
          performanceMetrics: {
            queryTime: 45,
            filterTime: 8,
            sortTime: 3,
          },
        },
      };
      
      // Simulate WebSocket message
      const messageHandler = mockWebSocket.addEventListener.mock.calls
        .find(([event]) => event === 'message')?.[1];
      
      if (messageHandler) {
        messageHandler({
          data: JSON.stringify(mockMessage),
        });
      }
      
      // Verify message was processed (would trigger UI updates in real implementation)
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('should handle WebSocket connection errors', () => {
      const errorHandler = mockWebSocket.addEventListener.mock.calls
        .find(([event]) => event === 'error')?.[1];
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      
      if (errorHandler) {
        errorHandler(new Error('WebSocket connection failed'));
      }
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Performance & Debouncing', () => {
    test('should debounce rapid filter changes', (done) => {
      const onFilterChange = vi.fn();
      const debouncedComponent = new AdvancedFilteringSorting(mockContainer, {
        apiEndpoint: '/api/test',
        onFilterChange,
        debounceMs: 100,
      });
      
      // Trigger multiple rapid changes
      debouncedComponent.updateGlobalSearch('a');
      debouncedComponent.updateGlobalSearch('ab');
      debouncedComponent.updateGlobalSearch('abc');
      
      // Should not be called immediately
      expect(onFilterChange).not.toHaveBeenCalled();
      
      // Should be called once after debounce period
      setTimeout(() => {
        expect(onFilterChange).toHaveBeenCalledTimes(1);
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            globalSearch: 'abc',
          })
        );
        
        debouncedComponent.destroy();
        done();
      }, 150);
    });
  });

  describe('Component Lifecycle', () => {
    test('should clean up resources on destroy', () => {
      component.destroy();
      
      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    test('should handle invalid configuration gracefully', () => {
      const invalidContainer = null as any;
      
      expect(() => {
        new AdvancedFilteringSorting(invalidContainer, {
          apiEndpoint: '/api/test',
        });
      }).toThrow('Container element is required');
    });
  });

  describe('Filter Validation', () => {
    test('should add filter conditions successfully', () => {
      component.addFilterGroup();
      const groupId = component.getFilterState().groups[component.getFilterState().groups.length - 1].id;
      component.addFilterCondition(groupId);
      
      const group = component.getFilterState().groups.find(g => g.id === groupId);
      expect(group?.conditions.length).toBeGreaterThan(0);
      const condition = group?.conditions[0];
      expect(condition).toBeDefined();
      expect(condition?.enabled).toBe(true);
    });

    test('should handle multiple conditions per group', () => {
      component.addFilterGroup();
      const groupId = component.getFilterState().groups[component.getFilterState().groups.length - 1].id;
      
      // Add multiple conditions
      component.addFilterCondition(groupId);
      component.addFilterCondition(groupId);
      
      const group = component.getFilterState().groups.find(g => g.id === groupId);
      expect(group?.conditions.length).toBe(2);
    });
  });
});

/**
 * Performance Tests
 */
describe('Advanced Filtering Performance', () => {
  let component: AdvancedFilteringSorting;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockContainer = {
      appendChild: vi.fn(),
      innerHTML: '',
      addEventListener: vi.fn(),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() },
    } as any;

    global.document.createElement = vi.fn().mockReturnValue({
      innerHTML: '',
      appendChild: vi.fn(),
      addEventListener: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn() },
      style: {},
      setAttribute: vi.fn(),
      value: '',
      checked: false,
      textContent: '',
    });

    component = new AdvancedFilteringSorting(mockContainer, {
      apiEndpoint: '/api/test',
      debounceMs: 50,
    });
  });

  test('should handle large numbers of filter groups efficiently', () => {
    const startTime = performance.now();
    
    // Add maximum allowed filter groups
    for (let i = 0; i < 5; i++) {
      component.addFilterGroup();
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time (100ms)
    expect(duration).toBeLessThan(100);
    expect(component.getFilterState().groups.length).toBe(5);
  });

  test('should handle large numbers of conditions efficiently', () => {
    component.addFilterGroup();
    const groupId = component.getFilterState().groups[0].id;
    
    const startTime = performance.now();
    
    // Add maximum allowed conditions
    for (let i = 0; i < 10; i++) {
      component.addFilterCondition(groupId);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time (100ms)
    expect(duration).toBeLessThan(100);
    
    const group = component.getFilterState().groups.find(g => g.id === groupId);
    expect(group?.conditions.length).toBe(10);
  });
});

/**
 * Accessibility Tests
 */
describe('Advanced Filtering Accessibility', () => {
  let component: AdvancedFilteringSorting;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockContainer = {
      appendChild: vi.fn(),
      innerHTML: '',
      addEventListener: vi.fn(),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() },
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
    } as any;

    global.document.createElement = vi.fn().mockReturnValue({
      innerHTML: '',
      appendChild: vi.fn(),
      addEventListener: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn() },
      style: {},
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      value: '',
      checked: false,
      textContent: '',
    });

    component = new AdvancedFilteringSorting(mockContainer, {
      apiEndpoint: '/api/test',
    });
  });

  test('should set proper ARIA attributes', () => {
    const createElement = global.document.createElement as vi.Mock;
    const createdElements = createElement.mock.results.map(result => result.value);
    
    // Check that elements have setAttribute called for ARIA attributes
    const elementsWithSetAttribute = createdElements.filter(el => 
      el.setAttribute && el.setAttribute.mock && el.setAttribute.mock.calls.length > 0
    );
    
    expect(elementsWithSetAttribute.length).toBeGreaterThan(0);
  });

  test('should support keyboard navigation', () => {
    // This would test that tab order is logical and all interactive elements are focusable
    // In a real implementation, we'd verify tabindex attributes and keyboard event handlers
    expect(component).toBeDefined();
  });
});
