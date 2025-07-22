/**
 * Export & Sharing Features Component
 * Phase 7 Stage 4: Advanced UI Features & UX
 */

// Export & Sharing Types
interface ExportOptions {
  format: 'csv' | 'json' | 'pdf' | 'xlsx';
  filename?: string;
  includeFields: string[];
  includeAnalytics: boolean;
  includeFilters: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  compression?: boolean;
}

interface ShareOptions {
  type: 'link' | 'email' | 'social';
  recipients?: string[];
  message?: string;
  expiryDays?: number;
  permissions: 'view' | 'edit';
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  format: ExportOptions['format'];
  fields: string[];
  analytics: boolean;
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
  };
  createdAt: string;
  lastUsed?: string;
}

interface JobCollection {
  id: string;
  name: string;
  description: string;
  jobs: string[]; // Job IDs
  tags: string[];
  isPublic: boolean;
  shareUrl?: string;
  createdAt: string;
  updatedAt: string;
}

class ExportSharingComponent {
  private ws: WebSocket | null = null;
  private reportTemplates: ReportTemplate[] = [];
  private jobCollections: JobCollection[] = [];
  private exportQueue: Array<{ id: string; status: 'pending' | 'processing' | 'completed' | 'failed'; progress: number }> = [];

  constructor() {
    this.loadSavedTemplates();
    this.loadSavedCollections();
    this.initializeEventListeners();
    this.renderExportInterface();
    this.renderSharingInterface();
    this.renderReportTemplates();
    this.renderJobCollections();
  }

  /**
   * Set WebSocket connection for real-time updates
   */
  setWebSocket(ws: WebSocket): void {
    this.ws = ws;
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(data: any): void {
    switch (data.type) {
      case 'export-progress':
        this.updateExportProgress(data.exportId, data.progress);
        break;
      case 'export-completed':
        this.handleExportCompleted(data.exportId, data.downloadUrl);
        break;
      case 'share-notification':
        this.handleShareNotification(data);
        break;
      case 'collection-updated':
        this.handleCollectionUpdate(data);
        break;
    }
  }

  /**
   * Initialize event listeners
   */
  private initializeEventListeners(): void {
    // Export form submission
    document.getElementById('export-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleExportSubmission();
    });

    // Quick export buttons
    document.querySelectorAll('[data-export-format]').forEach(button => {
      button.addEventListener('click', (e) => {
        const format = (e.target as HTMLElement).dataset.exportFormat as ExportOptions['format'];
        this.quickExport(format);
      });
    });

    // Share buttons
    document.getElementById('share-link-btn')?.addEventListener('click', () => {
      this.createShareLink();
    });

    document.getElementById('share-email-btn')?.addEventListener('click', () => {
      this.openEmailShareDialog();
    });

    // Template management
    document.getElementById('save-template-btn')?.addEventListener('click', () => {
      this.saveCurrentAsTemplate();
    });

    document.getElementById('schedule-report-btn')?.addEventListener('click', () => {
      this.showScheduleDialog();
    });

    // Collection management
    document.getElementById('create-collection-btn')?.addEventListener('click', () => {
      this.showCreateCollectionDialog();
    });

    // Drag and drop for job collections
    this.initializeDragAndDrop();
  }

  /**
   * Render export interface
   */
  private renderExportInterface(): void {
    const container = document.getElementById('export-interface');
    if (!container) return;

    const html = `
      <div class="export-section">
        <div class="section-header">
          <h3>📁 Export Results</h3>
          <p>Export your search results in various formats</p>
        </div>
        
        <div class="quick-export">
          <h4>Quick Export</h4>
          <div class="quick-export-buttons">
            <button class="export-btn" data-export-format="csv">
              <span class="btn-icon">📊</span>
              CSV
            </button>
            <button class="export-btn" data-export-format="json">
              <span class="btn-icon">🔗</span>
              JSON
            </button>
            <button class="export-btn" data-export-format="pdf">
              <span class="btn-icon">📄</span>
              PDF
            </button>
            <button class="export-btn" data-export-format="xlsx">
              <span class="btn-icon">📈</span>
              Excel
            </button>
          </div>
        </div>

        <div class="custom-export">
          <h4>Custom Export</h4>
          <form id="export-form" class="export-form">
            <div class="form-row">
              <div class="form-group">
                <label for="export-format">Format</label>
                <select id="export-format" name="format" required>
                  <option value="csv">CSV Spreadsheet</option>
                  <option value="json">JSON Data</option>
                  <option value="pdf">PDF Report</option>
                  <option value="xlsx">Excel Workbook</option>
                </select>
              </div>
              <div class="form-group">
                <label for="export-filename">Filename</label>
                <input type="text" id="export-filename" name="filename" placeholder="job-search-results">
              </div>
            </div>

            <div class="form-group">
              <label>Include Fields</label>
              <div class="field-checkboxes">
                <label><input type="checkbox" name="fields" value="title" checked> Job Title</label>
                <label><input type="checkbox" name="fields" value="company" checked> Company</label>
                <label><input type="checkbox" name="fields" value="location" checked> Location</label>
                <label><input type="checkbox" name="fields" value="salary" checked> Salary</label>
                <label><input type="checkbox" name="fields" value="description"> Description</label>
                <label><input type="checkbox" name="fields" value="requirements"> Requirements</label>
                <label><input type="checkbox" name="fields" value="benefits"> Benefits</label>
                <label><input type="checkbox" name="fields" value="posted"> Posted Date</label>
                <label><input type="checkbox" name="fields" value="url"> Application URL</label>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>
                  <input type="checkbox" id="include-analytics" name="analytics">
                  Include Analytics & Statistics
                </label>
              </div>
              <div class="form-group">
                <label>
                  <input type="checkbox" id="include-filters" name="filters">
                  Include Applied Filters
                </label>
              </div>
            </div>

            <div class="form-group">
              <label for="date-range">Date Range</label>
              <div class="date-range">
                <input type="date" id="date-start" name="dateStart">
                <span>to</span>
                <input type="date" id="date-end" name="dateEnd">
              </div>
            </div>

            <div class="form-actions">
              <button type="button" id="save-template-btn" class="btn-secondary">
                💾 Save as Template
              </button>
              <button type="submit" class="btn-primary">
                📁 Export Now
              </button>
            </div>
          </form>
        </div>

        <div class="export-queue" id="export-queue">
          <h4>Export Queue</h4>
          <div class="queue-list" id="queue-list">
            <div class="empty-state">
              <p>No exports in progress</p>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Render sharing interface
   */
  private renderSharingInterface(): void {
    const container = document.getElementById('sharing-interface');
    if (!container) return;

    const html = `
      <div class="sharing-section">
        <div class="section-header">
          <h3>🔗 Share Results</h3>
          <p>Share your search results and collections with others</p>
        </div>

        <div class="share-options">
          <div class="share-option">
            <div class="share-icon">🔗</div>
            <div class="share-content">
              <h4>Share Link</h4>
              <p>Create a shareable link to your current search results</p>
              <button id="share-link-btn" class="btn-primary">Create Link</button>
            </div>
          </div>

          <div class="share-option">
            <div class="share-icon">📧</div>
            <div class="share-content">
              <h4>Email Share</h4>
              <p>Send results directly to email addresses</p>
              <button id="share-email-btn" class="btn-primary">Send Email</button>
            </div>
          </div>

          <div class="share-option">
            <div class="share-icon">📱</div>
            <div class="share-content">
              <h4>Social Share</h4>
              <p>Share on social media platforms</p>
              <div class="social-buttons">
                <button class="social-btn" data-platform="linkedin">LinkedIn</button>
                <button class="social-btn" data-platform="twitter">Twitter</button>
                <button class="social-btn" data-platform="facebook">Facebook</button>
              </div>
            </div>
          </div>
        </div>

        <div class="shared-links" id="shared-links">
          <h4>Active Shared Links</h4>
          <div class="links-list" id="links-list">
            <div class="empty-state">
              <p>No shared links created yet</p>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Render report templates
   */
  private renderReportTemplates(): void {
    const container = document.getElementById('report-templates');
    if (!container) return;

    if (this.reportTemplates.length === 0) {
      container.innerHTML = `
        <div class="templates-section">
          <div class="section-header">
            <h3>📋 Report Templates</h3>
            <p>Save and reuse custom export configurations</p>
          </div>
          <div class="empty-state">
            <p>No templates saved yet. Create a custom export and save it as a template.</p>
          </div>
        </div>
      `;
      return;
    }

    const html = `
      <div class="templates-section">
        <div class="section-header">
          <h3>📋 Report Templates</h3>
          <p>Save and reuse custom export configurations</p>
        </div>
        
        <div class="templates-grid">
          ${this.reportTemplates.map(template => `
            <div class="template-card" data-template-id="${template.id}">
              <div class="template-header">
                <h4>${template.name}</h4>
                <div class="template-actions">
                  <button class="btn-icon use-template" title="Use Template">
                    ▶️
                  </button>
                  <button class="btn-icon edit-template" title="Edit Template">
                    ✏️
                  </button>
                  <button class="btn-icon delete-template" title="Delete Template">
                    🗑️
                  </button>
                </div>
              </div>
              <p class="template-description">${template.description}</p>
              <div class="template-details">
                <span class="template-format">${template.format.toUpperCase()}</span>
                <span class="template-fields">${template.fields.length} fields</span>
                ${template.schedule ? '<span class="template-scheduled">📅 Scheduled</span>' : ''}
              </div>
              <div class="template-meta">
                <small>Created: ${this.formatDate(template.createdAt)}</small>
                ${template.lastUsed ? `<small>Last used: ${this.formatDate(template.lastUsed)}</small>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="template-actions">
          <button id="schedule-report-btn" class="btn-secondary">
            📅 Schedule Report
          </button>
        </div>
      </div>
    `;

    // Clear existing content safely
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    
    // Use safe DOM manipulation
    container.insertAdjacentHTML('afterbegin', html);
    this.attachTemplateListeners();
  }

  /**
   * Render job collections
   */
  private renderJobCollections(): void {
    const container = document.getElementById('job-collections');
    if (!container) return;

    if (this.jobCollections.length === 0) {
      container.innerHTML = `
        <div class="collections-section">
          <div class="section-header">
            <h3>📚 Job Collections</h3>
            <p>Organize and share curated job lists</p>
          </div>
          <div class="empty-state">
            <p>No collections created yet.</p>
            <button id="create-collection-btn" class="btn-primary">
              ➕ Create Collection
            </button>
          </div>
        </div>
      `;
      return;
    }

    const html = `
      <div class="collections-section">
        <div class="section-header">
          <h3>📚 Job Collections</h3>
          <p>Organize and share curated job lists</p>
          <button id="create-collection-btn" class="btn-primary">
            ➕ Create Collection
          </button>
        </div>
        
        <div class="collections-grid">
          ${this.jobCollections.map(collection => `
            <div class="collection-card" data-collection-id="${collection.id}">
              <div class="collection-header">
                <h4>${collection.name}</h4>
                <div class="collection-actions">
                  <button class="btn-icon view-collection" title="View Collection">
                    👁️
                  </button>
                  <button class="btn-icon share-collection" title="Share Collection">
                    🔗
                  </button>
                  <button class="btn-icon edit-collection" title="Edit Collection">
                    ✏️
                  </button>
                  <button class="btn-icon delete-collection" title="Delete Collection">
                    🗑️
                  </button>
                </div>
              </div>
              <p class="collection-description">${collection.description}</p>
              <div class="collection-stats">
                <span class="job-count">${collection.jobs.length} jobs</span>
                <span class="visibility ${collection.isPublic ? 'public' : 'private'}">
                  ${collection.isPublic ? '🌐 Public' : '🔒 Private'}
                </span>
              </div>
              <div class="collection-tags">
                ${collection.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
              </div>
              <div class="collection-meta">
                <small>Created: ${this.formatDate(collection.createdAt)}</small>
                <small>Updated: ${this.formatDate(collection.updatedAt)}</small>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Clear existing content safely
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    
    // Use safe DOM manipulation
    container.insertAdjacentHTML('afterbegin', html);
    this.attachCollectionListeners();
  }

  /**
   * Handle export form submission
   */
  private async handleExportSubmission(): Promise<void> {
    const form = document.getElementById('export-form') as HTMLFormElement;
    const formData = new FormData(form);
    
    const options: ExportOptions = {
      format: formData.get('format') as ExportOptions['format'],
      filename: formData.get('filename') as string || 'job-search-results',
      includeFields: Array.from(formData.getAll('fields')) as string[],
      includeAnalytics: formData.has('analytics'),
      includeFilters: formData.has('filters'),
      compression: true
    };

    const dateStart = formData.get('dateStart') as string;
    const dateEnd = formData.get('dateEnd') as string;
    
    if (dateStart && dateEnd) {
      options.dateRange = {
        start: dateStart,
        end: dateEnd
      };
    }

    try {
      const exportId = await this.initiateExport(options);
      this.addToExportQueue(exportId);
      this.showNotification('Export started successfully', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('Export failed. Please try again.', 'error');
    }
  }

  /**
   * Quick export with default settings
   */
  private async quickExport(format: ExportOptions['format']): Promise<void> {
    const options: ExportOptions = {
      format,
      filename: `job-search-${format}-${Date.now()}`,
      includeFields: ['title', 'company', 'location', 'salary'],
      includeAnalytics: false,
      includeFilters: true
    };

    try {
      const exportId = await this.initiateExport(options);
      this.addToExportQueue(exportId);
      this.showNotification(`${format.toUpperCase()} export started`, 'success');
    } catch (error) {
      console.error('Quick export failed:', error);
      this.showNotification('Export failed. Please try again.', 'error');
    }
  }

  /**
   * Initiate export process
   */
  private async initiateExport(options: ExportOptions): Promise<string> {
    const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Send export request via WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'start-export',
        exportId,
        options
      }));
    } else {
      // Fallback to HTTP API
      const response = await fetch('/api/v2/export/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ exportId, options })
      });
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
    }

    return exportId;
  }

  /**
   * Add export to queue display
   */
  private addToExportQueue(exportId: string): void {
    this.exportQueue.push({
      id: exportId,
      status: 'pending',
      progress: 0
    });
    
    this.renderExportQueue();
  }

  /**
   * Render export queue
   */
  private renderExportQueue(): void {
    const container = document.getElementById('queue-list');
    if (!container) return;

    if (this.exportQueue.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No exports in progress</p></div>';
      return;
    }

    const html = this.exportQueue.map(item => `
      <div class="queue-item" data-export-id="${item.id}">
        <div class="queue-info">
          <span class="export-id">${item.id.split('_')[2]}</span>
          <span class="export-status status-${item.status}">${item.status}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${item.progress}%"></div>
        </div>
        <div class="queue-actions">
          ${item.status === 'completed' ? 
            '<button class="btn-download">📥 Download</button>' : 
            '<button class="btn-cancel">❌ Cancel</button>'
          }
        </div>
      </div>
    `).join('');

    container.innerHTML = html;
  }

  /**
   * Update export progress
   */
  private updateExportProgress(exportId: string, progress: number): void {
    const queueItem = this.exportQueue.find(item => item.id === exportId);
    if (queueItem) {
      queueItem.progress = progress;
      queueItem.status = progress < 100 ? 'processing' : 'completed';
      this.renderExportQueue();
    }
  }

  /**
   * Handle export completion
   */
  private handleExportCompleted(exportId: string, downloadUrl: string): void {
    const queueItem = this.exportQueue.find(item => item.id === exportId);
    if (queueItem) {
      queueItem.status = 'completed';
      queueItem.progress = 100;
      this.renderExportQueue();
      
      // Auto-download if enabled
      if (this.shouldAutoDownload()) {
        window.open(downloadUrl, '_blank');
      }
      
      this.showNotification('Export completed successfully!', 'success');
    }
  }

  /**
   * Create shareable link
   */
  private async createShareLink(): Promise<void> {
    try {
      const currentFilters = this.getCurrentFilters();
      const shareOptions: ShareOptions = {
        type: 'link',
        permissions: 'view',
        expiryDays: 7
      };

      const response = await fetch('/api/v2/share/create-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filters: currentFilters,
          options: shareOptions
        })
      });

      if (response.ok) {
        const result = await response.json();
        this.showShareLinkDialog(result.shareUrl);
      } else {
        throw new Error('Failed to create share link');
      }
    } catch (error) {
      console.error('Share link creation failed:', error);
      this.showNotification('Failed to create share link', 'error');
    }
  }

  /**
   * Open email share dialog
   */
  private openEmailShareDialog(): void {
    const modal = this.createModal('email-share-modal', 'Share via Email');
    modal.innerHTML += `
      <div class="modal-content">
        <form id="email-share-form">
          <div class="form-group">
            <label for="email-recipients">Email Addresses</label>
            <textarea id="email-recipients" placeholder="Enter email addresses separated by commas" required></textarea>
          </div>
          <div class="form-group">
            <label for="email-message">Message (Optional)</label>
            <textarea id="email-message" placeholder="Add a personal message..."></textarea>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="include-summary" checked>
              Include search summary
            </label>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-cancel">Cancel</button>
            <button type="submit" class="btn-primary">📧 Send Email</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    this.showModal('email-share-modal');
  }

  /**
   * Save current export settings as template
   */
  private saveCurrentAsTemplate(): void {
    const form = document.getElementById('export-form') as HTMLFormElement;
    const formData = new FormData(form);
    
    const templateName = prompt('Enter a name for this template:');
    if (!templateName) return;

    const template: ReportTemplate = {
      id: `template_${Date.now()}`,
      name: templateName,
      description: `Custom ${formData.get('format')} export template`,
      format: formData.get('format') as ExportOptions['format'],
      fields: Array.from(formData.getAll('fields')) as string[],
      analytics: formData.has('analytics'),
      createdAt: new Date().toISOString()
    };

    this.reportTemplates.push(template);
    this.saveCachedTemplates();
    this.renderReportTemplates();
    this.showNotification('Template saved successfully!', 'success');
  }

  /**
   * Show schedule dialog
   */
  private showScheduleDialog(): void {
    const modal = this.createModal('schedule-dialog', 'Schedule Report');
    modal.innerHTML += `
      <div class="modal-content">
        <form id="schedule-form">
          <div class="form-group">
            <label for="schedule-frequency">Frequency</label>
            <select id="schedule-frequency" required>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div class="form-group">
            <label for="schedule-time">Time</label>
            <input type="time" id="schedule-time" value="09:00" required>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-cancel">Cancel</button>
            <button type="submit" class="btn-primary">📅 Schedule</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    this.showModal('schedule-dialog');
  }

  /**
   * Show create collection dialog
   */
  private showCreateCollectionDialog(): void {
    const modal = this.createModal('create-collection-dialog', 'Create Job Collection');
    modal.innerHTML += `
      <div class="modal-content">
        <form id="create-collection-form">
          <div class="form-group">
            <label for="collection-name">Collection Name</label>
            <input type="text" id="collection-name" placeholder="e.g., Frontend Jobs" required>
          </div>
          <div class="form-group">
            <label for="collection-description">Description</label>
            <textarea id="collection-description" placeholder="Describe this collection..."></textarea>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="collection-public">
              Make this collection public
            </label>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-cancel">Cancel</button>
            <button type="submit" class="btn-primary">📚 Create</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    this.showModal('create-collection-dialog');
  }

  /**
   * Create job collection (public method)
   */
  public createCollection(name: string, description: string, jobIds: string[] = []): void {
    this.createJobCollection(name, description, jobIds);
  }

  /**
   * Create job collection (used internally)
   */
  private createJobCollection(name: string, description: string, jobIds: string[]): void {
    const collection: JobCollection = {
      id: `collection_${Date.now()}`,
      name,
      description,
      jobs: jobIds,
      tags: [],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.jobCollections.push(collection);
    this.saveCachedCollections();
    this.renderJobCollections();
  }

  /**
   * Initialize drag and drop for job collections
   */
  private initializeDragAndDrop(): void {
    // Implement drag and drop functionality for adding jobs to collections
    document.addEventListener('dragstart', (e) => {
      if ((e.target as Element).classList.contains('job-item')) {
        const jobId = (e.target as Element).getAttribute('data-job-id');
        if (e.dataTransfer && jobId) {
          e.dataTransfer.setData('text/plain', jobId);
        }
      }
    });

    document.addEventListener('dragover', (e) => {
      if ((e.target as Element).classList.contains('collection-card')) {
        e.preventDefault();
      }
    });

    document.addEventListener('drop', (e) => {
      if ((e.target as Element).classList.contains('collection-card')) {
        e.preventDefault();
        const jobId = e.dataTransfer?.getData('text/plain');
        const collectionId = (e.target as Element).getAttribute('data-collection-id');
        
        if (jobId && collectionId) {
          this.addJobToCollection(collectionId, jobId);
        }
      }
    });
  }

  /**
   * Add job to collection
   */
  private addJobToCollection(collectionId: string, jobId: string): void {
    const collection = this.jobCollections.find(c => c.id === collectionId);
    if (collection && !collection.jobs.includes(jobId)) {
      collection.jobs.push(jobId);
      collection.updatedAt = new Date().toISOString();
      this.saveCachedCollections();
      this.renderJobCollections();
      this.showNotification('Job added to collection', 'success');
    }
  }

  /**
   * Attach template event listeners
   */
  private attachTemplateListeners(): void {
    document.querySelectorAll('.use-template').forEach(button => {
      button.addEventListener('click', (e) => {
        const templateId = (e.target as Element).closest('.template-card')?.getAttribute('data-template-id');
        if (templateId) {
          this.useTemplate(templateId);
        }
      });
    });

    document.querySelectorAll('.delete-template').forEach(button => {
      button.addEventListener('click', (e) => {
        const templateId = (e.target as Element).closest('.template-card')?.getAttribute('data-template-id');
        if (templateId && confirm('Delete this template?')) {
          this.deleteTemplate(templateId);
        }
      });
    });
  }

  /**
   * Attach collection event listeners
   */
  private attachCollectionListeners(): void {
    document.querySelectorAll('.share-collection').forEach(button => {
      button.addEventListener('click', (e) => {
        const collectionId = (e.target as Element).closest('.collection-card')?.getAttribute('data-collection-id');
        if (collectionId) {
          this.shareCollection(collectionId);
        }
      });
    });

    document.querySelectorAll('.delete-collection').forEach(button => {
      button.addEventListener('click', (e) => {
        const collectionId = (e.target as Element).closest('.collection-card')?.getAttribute('data-collection-id');
        if (collectionId && confirm('Delete this collection?')) {
          this.deleteCollection(collectionId);
        }
      });
    });
  }

  /**
   * Use template to populate form
   */
  private useTemplate(templateId: string): void {
    const template = this.reportTemplates.find(t => t.id === templateId);
    if (!template) return;

    // Populate form with template values
    const form = document.getElementById('export-form') as HTMLFormElement;
    (form.querySelector('[name="format"]') as HTMLSelectElement).value = template.format;
    
    // Update last used timestamp
    template.lastUsed = new Date().toISOString();
    this.saveCachedTemplates();
    this.renderReportTemplates();
    
    this.showNotification('Template applied successfully!', 'success');
  }

  /**
   * Delete template
   */
  private deleteTemplate(templateId: string): void {
    this.reportTemplates = this.reportTemplates.filter(t => t.id !== templateId);
    this.saveCachedTemplates();
    this.renderReportTemplates();
    this.showNotification('Template deleted', 'success');
  }

  /**
   * Share collection
   */
  private async shareCollection(collectionId: string): Promise<void> {
    const collection = this.jobCollections.find(c => c.id === collectionId);
    if (!collection) return;

    try {
      const response = await fetch('/api/v2/collections/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ collectionId })
      });

      if (response.ok) {
        const result = await response.json();
        collection.shareUrl = result.shareUrl;
        collection.isPublic = true;
        this.saveCachedCollections();
        this.renderJobCollections();
        this.showShareLinkDialog(result.shareUrl);
      }
    } catch (error) {
      console.error('Failed to share collection:', error);
      this.showNotification('Failed to share collection', 'error');
    }
  }

  /**
   * Delete collection
   */
  private deleteCollection(collectionId: string): void {
    this.jobCollections = this.jobCollections.filter(c => c.id !== collectionId);
    this.saveCachedCollections();
    this.renderJobCollections();
    this.showNotification('Collection deleted', 'success');
  }

  /**
   * Utility methods
   */
  private getCurrentFilters(): any {
    // Get current search filters from the page
    return {
      query: (document.getElementById('quick-search') as HTMLInputElement)?.value || '',
      location: '',
      salary: null
    };
  }

  private shouldAutoDownload(): boolean {
    return localStorage.getItem('auto-download') === 'true';
  }

  private formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  private loadSavedTemplates(): void {
    try {
      const saved = localStorage.getItem('reportTemplates');
      if (saved) {
        this.reportTemplates = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load report templates:', error);
    }
  }

  private saveCachedTemplates(): void {
    try {
      localStorage.setItem('reportTemplates', JSON.stringify(this.reportTemplates));
    } catch (error) {
      console.error('Failed to save report templates:', error);
    }
  }

  private loadSavedCollections(): void {
    try {
      const saved = localStorage.getItem('jobCollections');
      if (saved) {
        this.jobCollections = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load job collections:', error);
    }
  }

  private saveCachedCollections(): void {
    try {
      localStorage.setItem('jobCollections', JSON.stringify(this.jobCollections));
    } catch (error) {
      console.error('Failed to save job collections:', error);
    }
  }

  private createModal(id: string, title: string): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = id;
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close">&times;</button>
          </div>
        </div>
      </div>
    `;
    return modal;
  }

  private showModal(id: string): void {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
    }
  }

  private showShareLinkDialog(shareUrl: string): void {
    const modal = this.createModal('share-link-modal', 'Share Link Created');
    
    const content = document.createElement('div');
    content.className = 'modal-content';
    
    const description = document.createElement('p');
    description.textContent = 'Your shareable link has been created:';
    
    const shareDiv = document.createElement('div');
    shareDiv.className = 'share-url';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = this.sanitizeUrl(shareUrl);
    input.readOnly = true;
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-copy';
    copyBtn.textContent = '📋 Copy';
    copyBtn.onclick = () => {
      // Use safe clipboard API directly
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          this.showNotification('Copied to clipboard!', 'success');
        }).catch(() => {
          this.showNotification('Failed to copy to clipboard', 'error');
        });
      } else {
        this.showNotification('Clipboard not available', 'error');
      }
    };
    
    const expires = document.createElement('p');
    expires.className = 'share-expires';
    expires.textContent = 'This link will expire in 7 days.';
    
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    
    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn-primary';
    doneBtn.textContent = 'Done';
    doneBtn.onclick = () => this.closeModal('share-link-modal');
    
    shareDiv.appendChild(input);
    shareDiv.appendChild(copyBtn);
    actions.appendChild(doneBtn);
    
    content.appendChild(description);
    content.appendChild(shareDiv);
    content.appendChild(expires);
    content.appendChild(actions);
    
    modal.appendChild(content);
    
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active');
    }
  }

  public closeModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
  }

  public copyToClipboard(text: string): void {
    this.safeCopyToClipboard(text);
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  private handleShareNotification(data: any): void {
    this.showNotification(`Someone ${data.action} your shared content`, 'info');
  }

  private handleCollectionUpdate(data: any): void {
    // Handle collection updates from other users
    const collection = this.jobCollections.find(c => c.id === data.collectionId);
    if (collection) {
      Object.assign(collection, data.updates);
      this.renderJobCollections();
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Sanitize URL to prevent XSS
   */
  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Only allow http and https protocols
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return '';
      }
      return urlObj.toString();
    } catch {
      return '';
    }
  }

  /**
   * Safely copy text to clipboard with validation
   */
  private safeCopyToClipboard(text: string): void {
    // Use modern clipboard API only for security
    if (navigator.clipboard && window.isSecureContext) {
      // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally removing control characters for security
      const sanitizedText = text.replace(/[\x00-\x1F\x7F-\x9F]/g, ''); // Remove control characters
      
      navigator.clipboard.writeText(sanitizedText).then(() => {
        this.showNotification('Copied to clipboard!', 'success');
      }).catch(() => {
        this.showNotification('Failed to copy to clipboard', 'error');
      });
    } else {
      this.showNotification('Clipboard not available in this context', 'error');
    }
  }
}

// Export for module systems and global access
if (typeof window !== 'undefined') {
  (window as any).ExportSharingComponent = ExportSharingComponent;
}

// ES6 module export
export { ExportSharingComponent };
export default ExportSharingComponent;
