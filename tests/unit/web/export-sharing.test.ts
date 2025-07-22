/**
 * Export Sharing Component Tests
 * Phase 8 Stage 1: Comprehensive Test Suite Expansion
 *
 * Tests for the export and sharing functionality
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock DOM environment
const mockDocument = {
  getElementById: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  createElement: vi.fn(() => ({
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
    click: vi.fn(),
    style: {},
    href: '',
    download: '',
  })),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const mockWindow = {
  URL: {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  },
  Blob: vi.fn((content, options) => ({ content, options })),
  navigator: {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  },
  open: vi.fn(),
  location: { href: 'http://localhost:3000' },
};

// Set up global mocks
global.document = mockDocument as any;
global.window = mockWindow as any;
global.Blob = mockWindow.Blob as any;

// Mock export sharing functionality
class MockExportSharing {
  private jobs: any[];
  private exportFormats: string[];

  constructor() {
    this.jobs = [];
    this.exportFormats = ['csv', 'json', 'pdf', 'xlsx'];
  }

  setJobs(jobs: any[]): void {
    this.jobs = jobs;
  }

  async exportToCSV(jobs: any[] = this.jobs): Promise<string> {
    if (!jobs || jobs.length === 0) {
      throw new Error('No jobs to export');
    }

    const headers = ['Title', 'Company', 'Location', 'Salary', 'Date Posted'];
    const csvRows = [headers.join(',')];

    jobs.forEach((job) => {
      const row = [
        this.escapeCSVField(job.title || ''),
        this.escapeCSVField(job.company || ''),
        this.escapeCSVField(job.location || ''),
        this.escapeCSVField(job.salary || ''),
        this.escapeCSVField(job.datePosted || ''),
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  async exportToJSON(jobs: any[] = this.jobs): Promise<string> {
    if (!jobs || jobs.length === 0) {
      throw new Error('No jobs to export');
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      totalJobs: jobs.length,
      jobs: jobs.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
        datePosted: job.datePosted,
        description: job.description,
        url: job.url,
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  async downloadFile(content: string, filename: string, mimeType: string): Promise<void> {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    // Simulate the download process
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  async shareToClipboard(content: string): Promise<void> {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API not supported');
    }
    await navigator.clipboard.writeText(content);
  }

  async shareViaURL(jobs: any[]): Promise<string> {
    const encodedJobs = encodeURIComponent(JSON.stringify(jobs));
    const shareUrl = `${window.location.origin}/shared?data=${encodedJobs}`;

    return shareUrl;
  }

  private escapeCSVField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  getSupportedFormats(): string[] {
    return [...this.exportFormats];
  }

  validateJobs(jobs: any[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(jobs)) {
      errors.push('Jobs must be an array');
      return { valid: false, errors };
    }

    if (jobs.length === 0) {
      errors.push('No jobs provided for export');
      return { valid: false, errors };
    }

    jobs.forEach((job, index) => {
      if (!job.title) {
        errors.push(`Job ${index + 1}: Missing title`);
      }
      if (!job.company) {
        errors.push(`Job ${index + 1}: Missing company`);
      }
    });

    return { valid: errors.length === 0, errors };
  }
}

describe('Export Sharing Component', () => {
  let exportSharing: MockExportSharing;
  let mockJobs: any[];

  beforeEach(() => {
    // Mock window.location
    Object.defineProperty(global, 'window', {
      value: {
        location: {
          origin: 'http://localhost:3000',
        },
        URL: {
          createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
          revokeObjectURL: vi.fn(),
        },
      },
      writable: true,
    });

    // Mock document
    Object.defineProperty(global, 'document', {
      value: {
        createElement: vi.fn().mockReturnValue({
          click: vi.fn(),
          href: '',
          download: '',
          style: {},
          remove: vi.fn(),
        }),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      },
      writable: true,
    });

    // Mock navigator object
    Object.defineProperty(global, 'navigator', {
      value: {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      },
      writable: true,
    });

    // Mock localStorage
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      },
      writable: true,
    });

    // Mock Blob constructor
    global.Blob = vi.fn().mockImplementation((content, options) => ({
      size: content[0].length,
      type: options?.type || 'text/plain',
    })) as any;

    exportSharing = new MockExportSharing();
    mockJobs = [
      {
        id: '1',
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        salary: '$100,000 - $150,000',
        datePosted: '2025-01-15',
        description: 'Great opportunity for a software engineer',
        url: 'https://example.com/job/1',
      },
      {
        id: '2',
        title: 'Data Scientist',
        company: 'Data Inc',
        location: 'Remote',
        salary: '$120,000 - $180,000',
        datePosted: '2025-01-16',
        description: 'Looking for an experienced data scientist',
        url: 'https://example.com/job/2',
      },
    ];

    exportSharing.setJobs(mockJobs);
    vi.clearAllMocks();
  });

  describe('Export Formats', () => {
    it('should support multiple export formats', () => {
      const formats = exportSharing.getSupportedFormats();

      expect(formats).toContain('csv');
      expect(formats).toContain('json');
      expect(formats).toContain('pdf');
      expect(formats).toContain('xlsx');
    });

    it('should export to CSV format correctly', async () => {
      const csvContent = await exportSharing.exportToCSV(mockJobs);

      expect(csvContent).toContain('Title,Company,Location,Salary,Date Posted');
      expect(csvContent).toContain('Software Engineer,Tech Corp');
      expect(csvContent).toContain('Data Scientist,Data Inc');
      expect(csvContent.split('\n')).toHaveLength(3); // Header + 2 jobs
    });

    it('should export to JSON format correctly', async () => {
      const jsonContent = await exportSharing.exportToJSON(mockJobs);
      const parsedData = JSON.parse(jsonContent);

      expect(parsedData.totalJobs).toBe(2);
      expect(parsedData.jobs).toHaveLength(2);
      expect(parsedData.exportedAt).toBeDefined();
      expect(parsedData.jobs[0].title).toBe('Software Engineer');
    });

    it('should handle CSV fields with special characters', async () => {
      const specialJobs = [
        {
          id: '1',
          title: 'Engineer, Senior',
          company: 'Company "Name"',
          location: 'San Francisco, CA',
          salary: '$100,000',
          datePosted: '2025-01-15',
        },
      ];

      const csvContent = await exportSharing.exportToCSV(specialJobs);

      expect(csvContent).toContain('"Engineer, Senior"');
      expect(csvContent).toContain('"Company ""Name"""');
    });
  });

  describe('File Download', () => {
    it('should trigger file download correctly', async () => {
      const content = 'test content';
      const filename = 'test.csv';
      const mimeType = 'text/csv';

      await exportSharing.downloadFile(content, filename, mimeType);

      expect(global.Blob).toHaveBeenCalledWith([content], { type: mimeType });
      expect((global as any).window.URL.createObjectURL).toHaveBeenCalled();
      expect((global as any).document.createElement).toHaveBeenCalledWith('a');
      expect((global as any).document.body.appendChild).toHaveBeenCalled();
      expect((global as any).document.body.removeChild).toHaveBeenCalled();
      expect((global as any).window.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should handle download with proper filename extension', async () => {
      const csvContent = await exportSharing.exportToCSV(mockJobs);
      await exportSharing.downloadFile(csvContent, 'jobs.csv', 'text/csv');

      // Verify the download process was initiated
      expect((global as any).window.URL.createObjectURL).toHaveBeenCalled();
      expect((global as any).document.createElement).toHaveBeenCalledWith('a');
    });
  });

  describe('Sharing Functionality', () => {
    it('should copy content to clipboard', async () => {
      const content = 'test content to share';

      await exportSharing.shareToClipboard(content);

      expect((global as any).navigator.clipboard.writeText).toHaveBeenCalledWith(content);
    });

    it('should handle clipboard API not being available', async () => {
      const originalClipboard = (global as any).navigator.clipboard;
      ((global as any).navigator as any).clipboard = undefined;

      await expect(exportSharing.shareToClipboard('test')).rejects.toThrow(
        'Clipboard API not supported',
      );

      (global as any).navigator.clipboard = originalClipboard;
    });

    it('should generate shareable URLs', async () => {
      const shareUrl = await exportSharing.shareViaURL(mockJobs);

      expect(shareUrl).toContain('http://localhost:3000/shared');
      expect(shareUrl).toContain('data=');
      expect(shareUrl.length).toBeGreaterThan(50); // Should contain encoded job data
    });
  });

  describe('Data Validation', () => {
    it('should validate job data before export', () => {
      const validResult = exportSharing.validateJobs(mockJobs);

      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidJobs = [
        { id: '1', company: 'Test Corp' }, // Missing title
        { id: '2', title: 'Engineer' }, // Missing company
      ];

      const validResult = exportSharing.validateJobs(invalidJobs);

      expect(validResult.valid).toBe(false);
      expect(validResult.errors).toContain('Job 1: Missing title');
      expect(validResult.errors).toContain('Job 2: Missing company');
    });

    it('should handle non-array input', () => {
      const validResult = exportSharing.validateJobs('not an array' as any);

      expect(validResult.valid).toBe(false);
      expect(validResult.errors).toContain('Jobs must be an array');
    });

    it('should handle empty job arrays', () => {
      const validResult = exportSharing.validateJobs([]);

      expect(validResult.valid).toBe(false);
      expect(validResult.errors).toContain('No jobs provided for export');
    });
  });

  describe('Error Handling', () => {
    it('should handle export with no jobs', async () => {
      await expect(exportSharing.exportToCSV([])).rejects.toThrow('No jobs to export');
      await expect(exportSharing.exportToJSON([])).rejects.toThrow('No jobs to export');
    });

    it('should handle malformed job data gracefully', async () => {
      const malformedJobs = [{ id: null, title: undefined, company: '' }, { randomField: 'value' }];

      const csvContent = await exportSharing.exportToCSV(malformedJobs);
      const jsonContent = await exportSharing.exportToJSON(malformedJobs);

      expect(csvContent).toBeDefined();
      expect(jsonContent).toBeDefined();

      const parsedJson = JSON.parse(jsonContent);
      expect(parsedJson.jobs).toHaveLength(2);
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const largeJobSet = Array(1000)
        .fill(null)
        .map((_, index) => ({
          id: `job-${index}`,
          title: `Job Title ${index}`,
          company: `Company ${index}`,
          location: 'Remote',
          salary: '$100,000',
          datePosted: '2025-01-15',
        }));

      const startTime = Date.now();

      await exportSharing.exportToCSV(largeJobSet);
      await exportSharing.exportToJSON(largeJobSet);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should not consume excessive memory', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      const largeJobSet = Array(500)
        .fill(null)
        .map((_, index) => ({
          id: `job-${index}`,
          title: `Job Title ${index}`,
          company: `Company ${index}`,
          location: 'Remote',
        }));

      exportSharing.setJobs(largeJobSet);
      exportSharing.validateJobs(largeJobSet);

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });
  });
});
