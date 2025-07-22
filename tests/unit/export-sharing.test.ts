/**
 * Export & Sharing Features Unit Tests
 * Phase 7 Stage 4: Advanced UI Features & UX
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportSharingComponent } from '../../src/web/components/export-sharing';

// Mock DOM environment
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
});

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
}));

// Mock Chart.js
vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn(),
  },
  defaults: {
    plugins: {
      legend: {},
      tooltip: {},
    },
  },
}));

describe('ExportSharingComponent', () => {
  let component: ExportSharingComponent;
  let mockContainer: HTMLDivElement;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '';
    mockContainer = document.createElement('div');
    mockContainer.id = 'export-sharing-container';
    document.body.appendChild(mockContainer);

    // Create other required elements
    const queueList = document.createElement('div');
    queueList.id = 'queue-list';
    document.body.appendChild(queueList);

    const reportTemplates = document.createElement('div');
    reportTemplates.id = 'report-templates';
    document.body.appendChild(reportTemplates);

    const jobCollections = document.createElement('div');
    jobCollections.id = 'job-collections';
    document.body.appendChild(jobCollections);

    // Clear localStorage mock calls
    (localStorage.setItem as jest.Mock).mockClear();
    (localStorage.getItem as jest.Mock).mockClear();

    component = new ExportSharingComponent(mockContainer);
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(component).toBeDefined();
      expect(component.exportFormats).toContain('csv');
      expect(component.exportFormats).toContain('json');
      expect(component.exportFormats).toContain('pdf');
      expect(component.exportFormats).toContain('xlsx');
    });

    it('should setup WebSocket connection', () => {
      expect(WebSocket).toHaveBeenCalled();
    });

    it('should load cached data on initialization', () => {
      expect(localStorage.getItem).toHaveBeenCalledWith('exportSharing_templates');
      expect(localStorage.getItem).toHaveBeenCalledWith('exportSharing_collections');
    });
  });

  describe('Quick Export', () => {
    const mockJobData = [
      {
        id: '1',
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        salary: '$120,000',
        description: 'Great opportunity',
        posted_date: '2024-01-15',
      },
      {
        id: '2',
        title: 'Data Scientist',
        company: 'Data Inc',
        location: 'New York, NY',
        salary: '$130,000',
        description: 'Exciting role',
        posted_date: '2024-01-16',
      },
    ];

    beforeEach(() => {
      // Mock currentJobData
      (component as any).currentJobData = mockJobData;
    });

    it('should export CSV format correctly', async () => {
      const result = await component.quickExport('csv');

      expect(result).toBeDefined();
      expect(result.format).toBe('csv');
      expect(result.filename).toContain('.csv');
    });

    it('should export JSON format correctly', async () => {
      const result = await component.quickExport('json');

      expect(result).toBeDefined();
      expect(result.format).toBe('json');
      expect(result.filename).toContain('.json');
    });

    it('should export PDF format correctly', async () => {
      const result = await component.quickExport('pdf');

      expect(result).toBeDefined();
      expect(result.format).toBe('pdf');
      expect(result.filename).toContain('.pdf');
    });

    it('should export XLSX format correctly', async () => {
      const result = await component.quickExport('xlsx');

      expect(result).toBeDefined();
      expect(result.format).toBe('xlsx');
      expect(result.filename).toContain('.xlsx');
    });

    it('should handle empty data gracefully', async () => {
      (component as any).currentJobData = [];

      const result = await component.quickExport('csv');
      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });

    it('should validate export format', async () => {
      await expect(component.quickExport('invalid' as any)).rejects.toThrow(
        'Unsupported export format',
      );
    });
  });

  describe('Custom Export', () => {
    const mockExportOptions = {
      format: 'csv' as const,
      filename: 'custom-export',
      fields: ['title', 'company', 'location', 'salary'],
      limit: 100,
      sortBy: 'posted_date',
      dateRange: {
        from: '2024-01-01',
        to: '2024-01-31',
      },
      notes: 'Custom export for analysis',
    };

    it('should create custom export with specified options', async () => {
      const result = await component.createCustomExport(mockExportOptions);

      expect(result).toBeDefined();
      expect(result.format).toBe('csv');
      expect(result.filename).toBe('custom-export.csv');
      expect(result.options).toEqual(mockExportOptions);
    });

    it('should validate custom export options', async () => {
      const invalidOptions = {
        ...mockExportOptions,
        format: 'invalid' as any,
      };

      await expect(component.createCustomExport(invalidOptions)).rejects.toThrow(
        'Invalid export format',
      );
    });

    it('should apply field filters correctly', async () => {
      const options = {
        ...mockExportOptions,
        fields: ['title', 'company'],
      };

      const result = await component.createCustomExport(options);
      expect(result.fields).toEqual(['title', 'company']);
    });

    it('should apply date range filter', async () => {
      const options = {
        ...mockExportOptions,
        dateRange: {
          from: '2024-01-01',
          to: '2024-01-15',
        },
      };

      const result = await component.createCustomExport(options);
      expect(result.dateRange).toEqual(options.dateRange);
    });

    it('should handle limit parameter', async () => {
      const options = {
        ...mockExportOptions,
        limit: 50,
      };

      const result = await component.createCustomExport(options);
      expect(result.limit).toBe(50);
    });
  });

  describe('Export Queue Management', () => {
    it('should add export to queue', () => {
      const exportItem = {
        id: 'export_1',
        format: 'csv',
        status: 'pending',
        progress: 0,
        createdAt: new Date().toISOString(),
      };

      component.addToExportQueue(exportItem);

      const queue = component.getExportQueue();
      expect(queue).toContainEqual(exportItem);
    });

    it('should update export progress', () => {
      const exportId = 'export_1';
      component.addToExportQueue({
        id: exportId,
        format: 'csv',
        status: 'pending',
        progress: 0,
        createdAt: new Date().toISOString(),
      });

      component.updateExportProgress(exportId, 50, 'processing');

      const queue = component.getExportQueue();
      const updatedExport = queue.find((item) => item.id === exportId);

      expect(updatedExport?.progress).toBe(50);
      expect(updatedExport?.status).toBe('processing');
    });

    it('should complete export', () => {
      const exportId = 'export_1';
      component.addToExportQueue({
        id: exportId,
        format: 'csv',
        status: 'pending',
        progress: 0,
        createdAt: new Date().toISOString(),
      });

      component.completeExport(exportId, 'http://example.com/download');

      const queue = component.getExportQueue();
      const completedExport = queue.find((item) => item.id === exportId);

      expect(completedExport?.status).toBe('completed');
      expect(completedExport?.progress).toBe(100);
      expect(completedExport?.downloadUrl).toBe('http://example.com/download');
    });

    it('should cancel export', () => {
      const exportId = 'export_1';
      component.addToExportQueue({
        id: exportId,
        format: 'csv',
        status: 'processing',
        progress: 30,
        createdAt: new Date().toISOString(),
      });

      component.cancelExport(exportId);

      const queue = component.getExportQueue();
      const cancelledExport = queue.find((item) => item.id === exportId);

      expect(cancelledExport?.status).toBe('cancelled');
    });

    it('should remove completed exports older than 7 days', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8);

      component.addToExportQueue({
        id: 'old_export',
        format: 'csv',
        status: 'completed',
        progress: 100,
        createdAt: oldDate.toISOString(),
      });

      component.cleanupExpiredExports();

      const queue = component.getExportQueue();
      expect(queue.find((item) => item.id === 'old_export')).toBeUndefined();
    });
  });

  describe('Sharing Features', () => {
    it('should generate shareable link', async () => {
      const result = await component.generateShareLink();

      expect(result).toBeDefined();
      expect(result.url).toMatch(/^https?:\/\//);
      expect(result.expires).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should generate link with privacy settings', async () => {
      const options = {
        privacy: 'password' as const,
        password: 'test123',
        expiresIn: 24, // hours
      };

      const result = await component.generateShareLink(options);

      expect(result.privacy).toBe('password');
      expect(result.password).toBe('test123');
    });

    it('should share to social media', async () => {
      const shareUrl = 'https://example.com/share/123';

      const result = await component.shareToSocial('linkedin', shareUrl);
      expect(result.platform).toBe('linkedin');
      expect(result.shareUrl).toBe(shareUrl);
    });

    it('should generate embed code', async () => {
      const shareUrl = 'https://example.com/share/123';

      const result = await component.generateEmbedCode(shareUrl);
      expect(result).toContain('<iframe');
      expect(result).toContain(shareUrl);
    });

    it('should track shared link access', () => {
      const linkId = 'share_123';
      const accessData = {
        timestamp: new Date().toISOString(),
        userAgent: 'Test Browser',
        referrer: 'https://example.com',
      };

      component.trackLinkAccess(linkId, accessData);

      const analytics = component.getLinkAnalytics(linkId);
      expect(analytics.totalViews).toBe(1);
      expect(analytics.recentAccess).toContainEqual(accessData);
    });
  });

  describe('Report Templates', () => {
    const mockTemplate = {
      id: 'template_1',
      name: 'Weekly Report',
      description: 'Standard weekly job search report',
      format: 'pdf' as const,
      fields: ['title', 'company', 'location', 'salary'],
      category: 'reporting' as const,
      isScheduled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should create report template', () => {
      component.createTemplate(mockTemplate);

      const templates = component.getReportTemplates();
      expect(templates).toContainEqual(mockTemplate);
    });

    it('should save template to localStorage', () => {
      component.createTemplate(mockTemplate);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'exportSharing_templates',
        expect.any(String),
      );
    });

    it('should update existing template', () => {
      component.createTemplate(mockTemplate);

      const updatedTemplate = {
        ...mockTemplate,
        name: 'Updated Weekly Report',
        description: 'Updated description',
      };

      component.updateTemplate(updatedTemplate);

      const templates = component.getReportTemplates();
      const template = templates.find((t) => t.id === mockTemplate.id);

      expect(template?.name).toBe('Updated Weekly Report');
      expect(template?.description).toBe('Updated description');
    });

    it('should delete template', () => {
      component.createTemplate(mockTemplate);
      component.deleteTemplate(mockTemplate.id);

      const templates = component.getReportTemplates();
      expect(templates.find((t) => t.id === mockTemplate.id)).toBeUndefined();
    });

    it('should export using template', async () => {
      component.createTemplate(mockTemplate);

      const result = await component.exportWithTemplate(mockTemplate.id);

      expect(result.format).toBe('pdf');
      expect(result.fields).toEqual(['title', 'company', 'location', 'salary']);
      expect(result.templateId).toBe(mockTemplate.id);
    });

    it('should schedule template export', () => {
      const schedule = {
        templateId: mockTemplate.id,
        frequency: 'weekly' as const,
        time: '09:00',
        email: 'user@example.com',
        enabled: true,
      };

      component.scheduleTemplateExport(schedule);

      const schedules = component.getScheduledExports();
      expect(schedules).toContainEqual(schedule);
    });
  });

  describe('Job Collections', () => {
    const mockCollection = {
      id: 'collection_1',
      name: 'Senior Roles',
      description: 'Senior software engineering positions',
      jobs: ['job_1', 'job_2', 'job_3'],
      tags: ['senior', 'engineering', 'remote'],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should create job collection', () => {
      component.createCollection(
        mockCollection.name,
        mockCollection.description,
        mockCollection.jobs,
      );

      const collections = component.getJobCollections();
      expect(collections).toHaveLength(1);
      expect(collections[0].name).toBe(mockCollection.name);
      expect(collections[0].jobs).toEqual(mockCollection.jobs);
    });

    it('should add job to collection', () => {
      component.createCollection('Test Collection', 'Test description');
      const collections = component.getJobCollections();
      const collectionId = collections[0].id;

      component.addJobToCollection(collectionId, 'new_job_id');

      const updatedCollections = component.getJobCollections();
      const collection = updatedCollections.find((c) => c.id === collectionId);

      expect(collection?.jobs).toContain('new_job_id');
    });

    it('should remove job from collection', () => {
      component.createCollection('Test Collection', 'Test description', ['job_1', 'job_2']);
      const collections = component.getJobCollections();
      const collectionId = collections[0].id;

      component.removeJobFromCollection(collectionId, 'job_1');

      const updatedCollections = component.getJobCollections();
      const collection = updatedCollections.find((c) => c.id === collectionId);

      expect(collection?.jobs).not.toContain('job_1');
      expect(collection?.jobs).toContain('job_2');
    });

    it('should delete collection', () => {
      component.createCollection('Test Collection', 'Test description');
      const collections = component.getJobCollections();
      const collectionId = collections[0].id;

      component.deleteCollection(collectionId);

      const updatedCollections = component.getJobCollections();
      expect(updatedCollections).toHaveLength(0);
    });

    it('should make collection public', () => {
      component.createCollection('Test Collection', 'Test description');
      const collections = component.getJobCollections();
      const collectionId = collections[0].id;

      component.makeCollectionPublic(collectionId);

      const updatedCollections = component.getJobCollections();
      const collection = updatedCollections.find((c) => c.id === collectionId);

      expect(collection?.isPublic).toBe(true);
    });

    it('should export collection', async () => {
      component.createCollection('Test Collection', 'Test description', ['job_1', 'job_2']);
      const collections = component.getJobCollections();
      const collectionId = collections[0].id;

      const result = await component.exportCollection(collectionId, 'json');

      expect(result.format).toBe('json');
      expect(result.collectionId).toBe(collectionId);
    });
  });

  describe('WebSocket Integration', () => {
    let mockWebSocket: any;

    beforeEach(() => {
      mockWebSocket = new WebSocket('ws://localhost:8080');
      (component as any).ws = mockWebSocket;
    });

    it('should handle export progress updates', () => {
      const progressData = {
        type: 'export_progress',
        exportId: 'export_1',
        progress: 75,
        status: 'processing',
      };

      // Add export to queue first
      component.addToExportQueue({
        id: 'export_1',
        format: 'csv',
        status: 'pending',
        progress: 0,
        createdAt: new Date().toISOString(),
      });

      // Simulate WebSocket message
      (component as any).handleWebSocketMessage(progressData);

      const queue = component.getExportQueue();
      const exportItem = queue.find((item) => item.id === 'export_1');

      expect(exportItem?.progress).toBe(75);
      expect(exportItem?.status).toBe('processing');
    });

    it('should handle export completion', () => {
      const completionData = {
        type: 'export_complete',
        exportId: 'export_1',
        downloadUrl: 'https://example.com/download/export_1.csv',
      };

      component.addToExportQueue({
        id: 'export_1',
        format: 'csv',
        status: 'processing',
        progress: 90,
        createdAt: new Date().toISOString(),
      });

      (component as any).handleWebSocketMessage(completionData);

      const queue = component.getExportQueue();
      const exportItem = queue.find((item) => item.id === 'export_1');

      expect(exportItem?.status).toBe('completed');
      expect(exportItem?.progress).toBe(100);
      expect(exportItem?.downloadUrl).toBe(completionData.downloadUrl);
    });

    it('should handle share notifications', () => {
      const shareData = {
        type: 'share_notification',
        action: 'viewed',
        linkId: 'share_123',
        timestamp: new Date().toISOString(),
      };

      const spy = jest.spyOn(component as any, 'handleShareNotification');
      (component as any).handleWebSocketMessage(shareData);

      expect(spy).toHaveBeenCalledWith(shareData);
    });

    it('should handle collection updates', () => {
      const collectionData = {
        type: 'collection_update',
        collectionId: 'collection_1',
        action: 'job_added',
        jobId: 'new_job_123',
      };

      const spy = jest.spyOn(component as any, 'handleCollectionUpdate');
      (component as any).handleWebSocketMessage(collectionData);

      expect(spy).toHaveBeenCalledWith(collectionData);
    });
  });

  describe('Error Handling', () => {
    it('should handle export errors gracefully', async () => {
      // Mock a failing export
      const originalMethod = (component as any).processExport;
      (component as any).processExport = jest.fn().mockRejectedValue(new Error('Export failed'));

      const result = await component.quickExport('csv');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Export failed');

      // Restore original method
      (component as any).processExport = originalMethod;
    });

    it('should handle WebSocket connection errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Simulate WebSocket error
      const mockError = new Error('WebSocket connection failed');
      (component as any).handleWebSocketError(mockError);

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket error:', mockError);

      consoleSpy.mockRestore();
    });

    it('should handle localStorage errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (localStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      component.createTemplate({
        id: 'test',
        name: 'Test Template',
        description: 'Test',
        format: 'csv',
        fields: ['title'],
        category: 'general',
        isScheduled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to save templates:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('UI Interaction', () => {
    it('should copy text to clipboard', async () => {
      const testText = 'https://example.com/share/123';

      await component.copyToClipboard(testText);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testText);
    });

    it('should fallback to execCommand for clipboard', async () => {
      // Mock clipboard failure
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(
        new Error('Clipboard unavailable'),
      );

      const execCommandSpy = jest.spyOn(document, 'execCommand').mockReturnValue(true);

      await component.copyToClipboard('test text');

      expect(execCommandSpy).toHaveBeenCalledWith('copy');

      execCommandSpy.mockRestore();
    });

    it('should show and hide modals', () => {
      const modal = document.createElement('div');
      modal.id = 'test-modal';
      modal.style.display = 'none';
      document.body.appendChild(modal);

      // Show modal
      component.showModal('test-modal');
      expect(modal.style.display).toBe('flex');
      expect(modal.classList.contains('active')).toBe(true);

      // Hide modal
      component.closeModal('test-modal');
      expect(modal.style.display).toBe('none');
      expect(modal.classList.contains('active')).toBe(false);
    });

    it('should display notifications', () => {
      (component as any).showNotification('Test message', 'success');

      const notification = document.querySelector('.notification-success');
      expect(notification).toBeDefined();
      expect(notification?.textContent).toBe('Test message');
    });
  });

  describe('Data Validation', () => {
    it('should validate export options', () => {
      const invalidOptions = {
        format: 'invalid' as any,
        fields: [],
        limit: -1,
      };

      const validationResult = (component as any).validateExportOptions(invalidOptions);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContain('Invalid format');
      expect(validationResult.errors).toContain('No fields selected');
      expect(validationResult.errors).toContain('Invalid limit value');
    });

    it('should validate template data', () => {
      const invalidTemplate = {
        name: '',
        format: 'invalid' as any,
        fields: [],
      };

      const validationResult = (component as any).validateTemplate(invalidTemplate);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContain('Name is required');
      expect(validationResult.errors).toContain('Invalid format');
      expect(validationResult.errors).toContain('At least one field is required');
    });

    it('should validate collection data', () => {
      const invalidCollection = {
        name: '',
        jobs: [],
      };

      const validationResult = (component as any).validateCollection(invalidCollection);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContain('Name is required');
    });
  });

  describe('Performance', () => {
    it('should handle large export datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `job_${i}`,
        title: `Job Title ${i}`,
        company: `Company ${i}`,
        location: 'Test Location',
        salary: '$100,000',
        description: 'Test description',
        posted_date: '2024-01-15',
      }));

      (component as any).currentJobData = largeDataset;

      const startTime = performance.now();
      await component.quickExport('csv');
      const endTime = performance.now();

      // Should complete within reasonable time (adjust as needed)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
    });

    it('should batch process WebSocket messages', () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        type: 'export_progress',
        exportId: `export_${i}`,
        progress: 50,
        status: 'processing',
      }));

      // Add exports to queue
      messages.forEach((_, i) => {
        component.addToExportQueue({
          id: `export_${i}`,
          format: 'csv',
          status: 'pending',
          progress: 0,
          createdAt: new Date().toISOString(),
        });
      });

      const startTime = performance.now();
      messages.forEach((message) => {
        (component as any).handleWebSocketMessage(message);
      });
      const endTime = performance.now();

      // Should process messages efficiently
      expect(endTime - startTime).toBeLessThan(1000); // 1 second
    });
  });
});

// Integration tests with DOM
describe('ExportSharingComponent DOM Integration', () => {
  let component: ExportSharingComponent;

  beforeEach(() => {
    // Setup more complete DOM
    document.body.innerHTML = `
      <div id="export-sharing-container"></div>
      <div id="queue-list"></div>
      <div id="report-templates"></div>
      <div id="job-collections"></div>
      <div id="export-form">
        <select id="export-format">
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
        <input id="export-filename" value="test-export" />
        <input type="checkbox" name="fields" value="title" checked />
        <input type="checkbox" name="fields" value="company" checked />
      </div>
    `;

    const container = document.getElementById('export-sharing-container')!;
    component = new ExportSharingComponent(container);
  });

  it('should render export queue in DOM', () => {
    component.addToExportQueue({
      id: 'export_test',
      format: 'csv',
      status: 'completed',
      progress: 100,
      createdAt: new Date().toISOString(),
      downloadUrl: 'https://example.com/download.csv',
    });

    (component as any).renderExportQueue();

    const queueList = document.getElementById('queue-list');
    expect(queueList?.children.length).toBeGreaterThan(0);

    const exportItem = queueList?.querySelector('.queue-item');
    expect(exportItem).toBeDefined();
    expect(exportItem?.textContent).toContain('export_test');
  });

  it('should handle form submission', () => {
    const form = document.getElementById('export-form') as HTMLFormElement;
    const submitEvent = new Event('submit');

    const spy = jest.spyOn(component, 'createCustomExport');
    form.dispatchEvent(submitEvent);

    // Should collect form data and call createCustomExport
    expect(spy).toHaveBeenCalled();
  });
});
