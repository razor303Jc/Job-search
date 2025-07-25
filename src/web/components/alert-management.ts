// Alert Management Component - comprehensive user interface for managing job alerts
import type {
  Alert,
  AlertCriteria,
  AlertService,
  AlertStats,
} from '../../services/alert-service.js';
import type { User } from '../../services/email-service.js';

export class AlertManagementComponent {
  private alertService: AlertService;
  private currentUser: User | null = null;

  constructor(alertService: AlertService) {
    this.alertService = alertService;
  }

  setCurrentUser(user: User): void {
    this.currentUser = user;
  }

  async renderAlertDashboard(): Promise<string> {
    if (!this.currentUser) {
      return this.renderLoginPrompt();
    }

    const alerts = await this.alertService.getUserAlerts(this.currentUser.id);
    const stats = await this.alertService.getUserStats(this.currentUser.id);

    return `
      <div class="alert-dashboard">
        ${this.renderAlertStats(stats)}
        ${this.renderAlertList(alerts)}
        ${this.renderCreateAlertButton()}
      </div>
      ${this.renderAlertManagementStyles()}
      ${this.renderAlertManagementScripts()}
    `;
  }

  private renderAlertStats(stats: AlertStats): string {
    return `
      <div class="alert-stats">
        <h2>📊 Your Alert Statistics</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${stats.totalAlerts}</div>
            <div class="stat-label">Total Alerts</div>
          </div>
          <div class="stat-card active">
            <div class="stat-number">${stats.activeAlerts}</div>
            <div class="stat-label">Active Alerts</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.totalJobsFound}</div>
            <div class="stat-label">Jobs Found (30 days)</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.avgJobsPerAlert}</div>
            <div class="stat-label">Avg Jobs per Alert</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderAlertList(alerts: Alert[]): string {
    if (alerts.length === 0) {
      return this.renderEmptyState();
    }

    const alertItems = alerts.map((alert) => this.renderAlertCard(alert)).join('');

    return `
      <div class="alert-list-section">
        <div class="section-header">
          <h3>🔔 Your Job Alerts</h3>
          <button class="btn btn-primary" onclick="AlertManager.showCreateForm()">
            ➕ Create New Alert
          </button>
        </div>
        <div class="alert-list">
          ${alertItems}
        </div>
      </div>
    `;
  }

  private renderAlertCard(alert: Alert): string {
    const lastTriggered = alert.lastTriggered
      ? new Date(alert.lastTriggered).toLocaleDateString()
      : 'Never';

    const criteriaText = this.formatCriteria(alert.criteria);

    return `
      <div class="alert-card ${alert.isActive ? 'active' : 'inactive'}" data-alert-id="${alert.id}">
        <div class="alert-header">
          <div class="alert-title">
            <h4>${alert.name}</h4>
            <span class="alert-status ${alert.isActive ? 'active' : 'inactive'}">
              ${alert.isActive ? '🟢 Active' : '🔴 Inactive'}
            </span>
          </div>
          <div class="alert-actions">
            <button class="btn btn-sm btn-outline" onclick="AlertManager.toggleAlert('${alert.id}', ${!alert.isActive})">
              ${alert.isActive ? '⏸️ Pause' : '▶️ Resume'}
            </button>
            <button class="btn btn-sm btn-outline" onclick="AlertManager.showEditForm('${alert.id}')">
              ✏️ Edit
            </button>
            <button class="btn btn-sm btn-outline" onclick="AlertManager.previewAlert('${alert.id}')">
              👁️ Preview
            </button>
            <button class="btn btn-sm btn-danger" onclick="AlertManager.deleteAlert('${alert.id}')">
              🗑️ Delete
            </button>
          </div>
        </div>

        <div class="alert-details">
          <div class="alert-criteria">
            <strong>Criteria:</strong> ${criteriaText}
          </div>
          <div class="alert-meta">
            <span class="frequency">📅 ${this.capitalizeFirst(alert.frequency)}</span>
            <span class="last-triggered">🕐 Last: ${lastTriggered}</span>
            <span class="created">📆 Created: ${new Date(alert.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div class="alert-recent-activity" id="activity-${alert.id}">
          <button class="btn btn-sm btn-text" onclick="AlertManager.loadRecentActivity('${alert.id}')">
            📊 View Recent Activity
          </button>
        </div>
      </div>
    `;
  }

  private formatCriteria(criteria: AlertCriteria): string {
    const parts: string[] = [];

    if (criteria.keywords && criteria.keywords.length > 0) {
      parts.push(`Keywords: ${criteria.keywords.join(', ')}`);
    }

    if (criteria.location) {
      parts.push(`Location: ${criteria.location}`);
    }

    if (criteria.salaryMin || criteria.salaryMax) {
      const min = criteria.salaryMin ? `$${criteria.salaryMin.toLocaleString()}` : '0';
      const max = criteria.salaryMax ? `$${criteria.salaryMax.toLocaleString()}` : '∞';
      parts.push(`Salary: ${min} - ${max}`);
    }

    if (criteria.companies && criteria.companies.length > 0) {
      parts.push(
        `Companies: ${criteria.companies.slice(0, 3).join(', ')}${criteria.companies.length > 3 ? '...' : ''}`,
      );
    }

    if (criteria.jobTypes && criteria.jobTypes.length > 0) {
      parts.push(`Types: ${criteria.jobTypes.join(', ')}`);
    }

    return parts.length > 0 ? parts.join(' • ') : 'Any job';
  }

  private renderEmptyState(): string {
    return `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>No Job Alerts Yet</h3>
        <p>Create your first job alert to get notified when new opportunities matching your criteria are found!</p>
        <button class="btn btn-primary btn-large" onclick="AlertManager.showCreateForm()">
          🔔 Create Your First Alert
        </button>
      </div>
    `;
  }

  private renderCreateAlertButton(): string {
    return `
      <div class="floating-create-btn">
        <button class="btn btn-floating" onclick="AlertManager.showCreateForm()" title="Create New Alert">
          ➕
        </button>
      </div>
    `;
  }

  async renderCreateAlertForm(): Promise<string> {
    return `
      <div class="alert-form-modal" id="createAlertModal">
        <div class="modal-backdrop" onclick="AlertManager.hideCreateForm()"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3>🔔 Create New Job Alert</h3>
            <button class="modal-close" onclick="AlertManager.hideCreateForm()">✕</button>
          </div>
          
          <form id="createAlertForm" onsubmit="AlertManager.submitCreateForm(event)">
            <div class="form-section">
              <h4>Alert Information</h4>
              <div class="form-group">
                <label for="alertName">Alert Name *</label>
                <input type="text" id="alertName" name="name" required 
                       placeholder="e.g., Senior Developer Jobs">
                <small>Give your alert a memorable name</small>
              </div>

              <div class="form-group">
                <label for="alertFrequency">Notification Frequency</label>
                <select id="alertFrequency" name="frequency">
                  <option value="immediate">Immediate (as jobs are found)</option>
                  <option value="hourly">Hourly digest</option>
                  <option value="daily" selected>Daily digest</option>
                  <option value="weekly">Weekly digest</option>
                </select>
              </div>
            </div>

            <div class="form-section">
              <h4>Job Criteria</h4>
              
              <div class="form-group">
                <label for="keywords">Keywords</label>
                <input type="text" id="keywords" name="keywords" 
                       placeholder="e.g., javascript, react, node.js">
                <small>Separate multiple keywords with commas</small>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="location">Location</label>
                  <input type="text" id="location" name="location" 
                         placeholder="e.g., San Francisco, Remote">
                </div>
                
                <div class="form-group">
                  <label for="companies">Companies</label>
                  <input type="text" id="companies" name="companies" 
                         placeholder="e.g., Google, Microsoft, Apple">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="salaryMin">Min Salary ($)</label>
                  <input type="number" id="salaryMin" name="salaryMin" 
                         placeholder="80000" min="0" step="1000">
                </div>
                
                <div class="form-group">
                  <label for="salaryMax">Max Salary ($)</label>
                  <input type="number" id="salaryMax" name="salaryMax" 
                         placeholder="150000" min="0" step="1000">
                </div>
              </div>

              <div class="form-group">
                <label>Job Types</label>
                <div class="checkbox-group">
                  <label class="checkbox-label">
                    <input type="checkbox" name="jobTypes" value="full-time"> Full-time
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" name="jobTypes" value="part-time"> Part-time
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" name="jobTypes" value="contract"> Contract
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" name="jobTypes" value="remote"> Remote
                  </label>
                </div>
              </div>

              <div class="form-group">
                <label>Experience Level</label>
                <div class="checkbox-group">
                  <label class="checkbox-label">
                    <input type="checkbox" name="experienceLevel" value="entry"> Entry Level
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" name="experienceLevel" value="mid"> Mid Level
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" name="experienceLevel" value="senior"> Senior Level
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" name="experienceLevel" value="executive"> Executive
                  </label>
                </div>
              </div>

              <div class="form-group">
                <label for="excludeKeywords">Exclude Keywords</label>
                <input type="text" id="excludeKeywords" name="excludeKeywords" 
                       placeholder="e.g., intern, unpaid">
                <small>Jobs containing these keywords will be excluded</small>
              </div>
            </div>

            <div class="form-section">
              <div class="form-actions">
                <button type="button" class="btn btn-outline" onclick="AlertManager.previewAlertCriteria()">
                  👁️ Preview Jobs
                </button>
                <button type="button" class="btn btn-secondary" onclick="AlertManager.hideCreateForm()">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary">
                  🔔 Create Alert
                </button>
              </div>
            </div>
          </form>

          <div id="alertPreview" class="alert-preview" style="display: none;">
            <!-- Preview content will be loaded here -->
          </div>
        </div>
      </div>
    `;
  }

  async renderEditAlertForm(alertId: string): Promise<string> {
    const alert = await this.alertService.getAlert(alertId);
    if (!alert) {
      return '<div class="error">Alert not found</div>';
    }

    // Similar to create form but pre-populated with alert data
    return `
      <div class="alert-form-modal" id="editAlertModal">
        <div class="modal-backdrop" onclick="AlertManager.hideEditForm()"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3>✏️ Edit Job Alert</h3>
            <button class="modal-close" onclick="AlertManager.hideEditForm()">✕</button>
          </div>
          
          <form id="editAlertForm" onsubmit="AlertManager.submitEditForm(event, '${alertId}')">
            <!-- Similar form structure to create form, but pre-populated -->
            <input type="hidden" name="alertId" value="${alertId}">
            
            <div class="form-section">
              <div class="form-group">
                <label for="editAlertName">Alert Name *</label>
                <input type="text" id="editAlertName" name="name" required 
                       value="${alert.name}">
              </div>

              <div class="form-group">
                <label for="editAlertFrequency">Notification Frequency</label>
                <select id="editAlertFrequency" name="frequency">
                  <option value="immediate" ${alert.frequency === 'immediate' ? 'selected' : ''}>Immediate</option>
                  <option value="hourly" ${alert.frequency === 'hourly' ? 'selected' : ''}>Hourly digest</option>
                  <option value="daily" ${alert.frequency === 'daily' ? 'selected' : ''}>Daily digest</option>
                  <option value="weekly" ${alert.frequency === 'weekly' ? 'selected' : ''}>Weekly digest</option>
                </select>
              </div>
            </div>

            <div class="form-actions">
              <button type="button" class="btn btn-secondary" onclick="AlertManager.hideEditForm()">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary">
                💾 Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private renderLoginPrompt(): string {
    return `
      <div class="login-prompt">
        <div class="login-card">
          <h2>🔔 Job Alerts</h2>
          <p>Create personalized job alerts to get notified when new opportunities matching your criteria are found!</p>
          
          <form id="loginForm" onsubmit="AlertManager.handleLogin(event)">
            <div class="form-group">
              <label for="userEmail">Email Address</label>
              <input type="email" id="userEmail" name="email" required 
                     placeholder="your.email@example.com">
            </div>
            
            <div class="form-group">
              <label for="userName">Name (Optional)</label>
              <input type="text" id="userName" name="name" 
                     placeholder="Your Name">
            </div>
            
            <button type="submit" class="btn btn-primary btn-large">
              🚀 Get Started
            </button>
          </form>
          
          <p class="login-note">
            We'll create your account automatically. No password needed!
          </p>
        </div>
      </div>
    `;
  }

  private renderAlertManagementStyles(): string {
    return `
      <style>
        .alert-dashboard {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .alert-stats {
          margin-bottom: 32px;
        }

        .alert-stats h2 {
          color: #1f2937;
          margin-bottom: 16px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .stat-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .stat-card.active {
          border-color: #2563eb;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        }

        .stat-number {
          font-size: 2.5rem;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 8px;
        }

        .stat-label {
          color: #6b7280;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .alert-list-section {
          margin-bottom: 32px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .section-header h3 {
          color: #1f2937;
          margin: 0;
        }

        .alert-list {
          display: grid;
          gap: 16px;
        }

        .alert-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 24px;
          transition: all 0.2s;
        }

        .alert-card:hover {
          border-color: #2563eb;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
        }

        .alert-card.inactive {
          opacity: 0.7;
          background: #f9fafb;
        }

        .alert-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .alert-title h4 {
          margin: 0 0 8px 0;
          color: #1f2937;
          font-size: 1.25rem;
        }

        .alert-status {
          font-size: 0.875rem;
          font-weight: 500;
          padding: 4px 8px;
          border-radius: 12px;
        }

        .alert-status.active {
          background: #dcfce7;
          color: #166534;
        }

        .alert-status.inactive {
          background: #fee2e2;
          color: #991b1b;
        }

        .alert-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .alert-details {
          margin-bottom: 16px;
        }

        .alert-criteria {
          color: #4b5563;
          margin-bottom: 12px;
          line-height: 1.5;
        }

        .alert-meta {
          display: flex;
          gap: 20px;
          font-size: 0.875rem;
          color: #6b7280;
          flex-wrap: wrap;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
          font-size: 0.875rem;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
        }

        .btn-primary:hover {
          background: #1d4ed8;
        }

        .btn-secondary {
          background: #6b7280;
          color: white;
        }

        .btn-outline {
          background: white;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .btn-outline:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .btn-danger {
          background: #dc2626;
          color: white;
        }

        .btn-danger:hover {
          background: #b91c1c;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 0.75rem;
        }

        .btn-large {
          padding: 12px 24px;
          font-size: 1rem;
        }

        .btn-text {
          background: none;
          color: #2563eb;
          padding: 4px 8px;
        }

        .btn-floating {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #2563eb;
          color: white;
          font-size: 1.5rem;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
          z-index: 100;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
        }

        .empty-icon {
          font-size: 4rem;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          color: #1f2937;
          margin-bottom: 12px;
        }

        .empty-state p {
          color: #6b7280;
          margin-bottom: 24px;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }

        .alert-form-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
          z-index: 1;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 24px 0 24px;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 24px;
        }

        .modal-header h3 {
          margin: 0;
          color: #1f2937;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #6b7280;
          padding: 8px;
          border-radius: 4px;
        }

        .modal-close:hover {
          background: #f3f4f6;
        }

        .form-section {
          padding: 0 24px 24px 24px;
        }

        .form-section h4 {
          color: #1f2937;
          margin: 0 0 16px 0;
          font-size: 1.125rem;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #374151;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
          transition: border-color 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .form-group small {
          color: #6b7280;
          font-size: 0.75rem;
          margin-top: 4px;
          display: block;
        }

        .checkbox-group {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-top: 8px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: normal;
          cursor: pointer;
          margin-bottom: 0 !important;
        }

        .checkbox-label input[type="checkbox"] {
          width: auto;
          margin: 0;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
        }

        .login-prompt {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          padding: 20px;
        }

        .login-card {
          background: white;
          border-radius: 12px;
          padding: 32px;
          max-width: 400px;
          width: 100%;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          text-align: center;
        }

        .login-card h2 {
          color: #1f2937;
          margin-bottom: 16px;
        }

        .login-card p {
          color: #6b7280;
          margin-bottom: 24px;
        }

        .login-note {
          font-size: 0.875rem;
          color: #9ca3af;
          margin-top: 16px;
          margin-bottom: 0;
        }

        .alert-preview {
          margin-top: 24px;
          padding: 20px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        @media (max-width: 768px) {
          .alert-dashboard {
            padding: 16px;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .section-header {
            flex-direction: column;
            gap: 12px;
            align-items: stretch;
          }

          .alert-header {
            flex-direction: column;
            gap: 16px;
            align-items: stretch;
          }

          .alert-actions {
            justify-content: flex-start;
          }

          .alert-meta {
            flex-direction: column;
            gap: 8px;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .modal-content {
            margin: 10px;
            max-height: calc(100vh - 20px);
          }

          .checkbox-group {
            grid-template-columns: 1fr;
          }
        }
      </style>
    `;
  }

  private renderAlertManagementScripts(): string {
    return `
      <script>
        class AlertManager {
          static currentUser = null;

          static setUser(user) {
            this.currentUser = user;
          }

          static async showCreateForm() {
            const formHtml = await this.getCreateFormHtml();
            this.showModal(formHtml);
          }

          static hideCreateForm() {
            this.hideModal('createAlertModal');
          }

          static async showEditForm(alertId) {
            const formHtml = await this.getEditFormHtml(alertId);
            this.showModal(formHtml);
          }

          static hideEditForm() {
            this.hideModal('editAlertModal');
          }

          static showModal(html) {
            const existingModal = document.querySelector('.alert-form-modal');
            if (existingModal) {
              existingModal.remove();
            }

            document.body.insertAdjacentHTML('beforeend', html);
            document.body.style.overflow = 'hidden';
          }

          static hideModal(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
              modal.remove();
              document.body.style.overflow = '';
            }
          }

          static async submitCreateForm(event) {
            event.preventDefault();
            
            const formData = new FormData(event.target);
            const alertData = this.extractFormData(formData);

            try {
              const response = await fetch('/api/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alertData)
              });

              if (response.ok) {
                this.hideCreateForm();
                this.showSuccess('Alert created successfully!');
                location.reload(); // Reload to show new alert
              } else {
                const error = await response.text();
                this.showError('Failed to create alert: ' + error);
              }
            } catch (error) {
              this.showError('Failed to create alert: ' + error.message);
            }
          }

          static async submitEditForm(event, alertId) {
            event.preventDefault();
            
            const formData = new FormData(event.target);
            const alertData = this.extractFormData(formData);

            try {
              const response = await fetch(\`/api/alerts/\${alertId}\`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alertData)
              });

              if (response.ok) {
                this.hideEditForm();
                this.showSuccess('Alert updated successfully!');
                location.reload();
              } else {
                const error = await response.text();
                this.showError('Failed to update alert: ' + error);
              }
            } catch (error) {
              this.showError('Failed to update alert: ' + error.message);
            }
          }

          static extractFormData(formData) {
            const data = {
              name: formData.get('name'),
              frequency: formData.get('frequency'),
              criteria: {}
            };

            // Extract keywords
            const keywords = formData.get('keywords');
            if (keywords) {
              data.criteria.keywords = keywords.split(',').map(k => k.trim()).filter(k => k);
            }

            // Extract other fields
            const fields = ['location', 'companies', 'excludeKeywords'];
            fields.forEach(field => {
              const value = formData.get(field);
              if (value) {
                if (field === 'companies' || field === 'excludeKeywords') {
                  data.criteria[field] = value.split(',').map(v => v.trim()).filter(v => v);
                } else {
                  data.criteria[field] = value;
                }
              }
            });

            // Extract salary range
            const salaryMin = formData.get('salaryMin');
            const salaryMax = formData.get('salaryMax');
            if (salaryMin) data.criteria.salaryMin = parseInt(salaryMin);
            if (salaryMax) data.criteria.salaryMax = parseInt(salaryMax);

            // Extract multi-select fields
            const jobTypes = formData.getAll('jobTypes');
            if (jobTypes.length > 0) data.criteria.jobTypes = jobTypes;

            const experienceLevel = formData.getAll('experienceLevel');
            if (experienceLevel.length > 0) data.criteria.experienceLevel = experienceLevel;

            return data;
          }

          static async toggleAlert(alertId, isActive) {
            try {
              const response = await fetch(\`/api/alerts/\${alertId}/toggle\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive })
              });

              if (response.ok) {
                this.showSuccess(\`Alert \${isActive ? 'activated' : 'paused'} successfully!\`);
                location.reload();
              } else {
                this.showError('Failed to toggle alert');
              }
            } catch (error) {
              this.showError('Failed to toggle alert: ' + error.message);
            }
          }

          static async deleteAlert(alertId) {
            if (!confirm('Are you sure you want to delete this alert? This action cannot be undone.')) {
              return;
            }

            try {
              const response = await fetch(\`/api/alerts/\${alertId}\`, {
                method: 'DELETE'
              });

              if (response.ok) {
                this.showSuccess('Alert deleted successfully!');
                location.reload();
              } else {
                this.showError('Failed to delete alert');
              }
            } catch (error) {
              this.showError('Failed to delete alert: ' + error.message);
            }
          }

          static async previewAlert(alertId) {
            try {
              const response = await fetch(\`/api/alerts/\${alertId}/preview\`);
              if (response.ok) {
                const jobs = await response.json();
                this.showPreviewModal(jobs);
              } else {
                this.showError('Failed to load alert preview');
              }
            } catch (error) {
              this.showError('Failed to load alert preview: ' + error.message);
            }
          }

          static async previewAlertCriteria() {
            const form = document.getElementById('createAlertForm');
            const formData = new FormData(form);
            const alertData = this.extractFormData(formData);

            try {
              const response = await fetch('/api/alerts/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ criteria: alertData.criteria })
              });

              if (response.ok) {
                const jobs = await response.json();
                this.showInlinePreview(jobs);
              } else {
                this.showError('Failed to load preview');
              }
            } catch (error) {
              this.showError('Failed to load preview: ' + error.message);
            }
          }

          static showPreviewModal(jobs) {
            const jobsHtml = jobs.slice(0, 10).map(job => \`
              <div class="job-preview-item">
                <h4><a href="\${job.url}" target="_blank">\${job.title}</a></h4>
                <p><strong>\${job.company}</strong> \${job.location ? '• ' + job.location : ''}</p>
                \${job.salary ? \`<p class="salary">\${job.salary}</p>\` : ''}
              </div>
            \`).join('');

            const modalHtml = \`
              <div class="alert-form-modal" id="previewModal">
                <div class="modal-backdrop" onclick="AlertManager.hidePreviewModal()"></div>
                <div class="modal-content">
                  <div class="modal-header">
                    <h3>👁️ Alert Preview (\${jobs.length} jobs found)</h3>
                    <button class="modal-close" onclick="AlertManager.hidePreviewModal()">✕</button>
                  </div>
                  <div class="form-section">
                    \${jobsHtml || '<p>No jobs found matching your criteria.</p>'}
                  </div>
                </div>
              </div>
            \`;

            this.showModal(modalHtml);
          }

          static hidePreviewModal() {
            this.hideModal('previewModal');
          }

          static showInlinePreview(jobs) {
            const previewDiv = document.getElementById('alertPreview');
            if (!previewDiv) return;

            const jobsHtml = jobs.slice(0, 5).map(job => \`
              <div class="job-preview-item">
                <h5>\${job.title}</h5>
                <p>\${job.company} \${job.location ? '• ' + job.location : ''}</p>
              </div>
            \`).join('');

            previewDiv.innerHTML = \`
              <h4>Preview: \${jobs.length} jobs found</h4>
              \${jobsHtml || '<p>No jobs found matching your criteria.</p>'}
            \`;
            previewDiv.style.display = 'block';
          }

          static async loadRecentActivity(alertId) {
            const activityDiv = document.getElementById(\`activity-\${alertId}\`);
            if (!activityDiv) return;

            try {
              const response = await fetch(\`/api/alerts/\${alertId}/deliveries\`);
              if (response.ok) {
                const deliveries = await response.json();
                this.showRecentActivity(activityDiv, deliveries);
              }
            } catch (error) {
              console.error('Failed to load activity:', error);
            }
          }

          static showRecentActivity(container, deliveries) {
            const activityHtml = deliveries.slice(0, 5).map(delivery => \`
              <div class="activity-item">
                <span class="activity-date">\${new Date(delivery.deliveredAt).toLocaleDateString()}</span>
                <span class="activity-jobs">\${delivery.jobsFound} jobs found</span>
                <span class="activity-status \${delivery.deliveryStatus}">\${delivery.deliveryStatus}</span>
              </div>
            \`).join('');

            container.innerHTML = \`
              <div class="recent-activity">
                <h5>Recent Activity</h5>
                \${activityHtml || '<p>No recent activity</p>'}
              </div>
            \`;
          }

          static async handleLogin(event) {
            event.preventDefault();
            
            const formData = new FormData(event.target);
            const userData = {
              email: formData.get('email'),
              name: formData.get('name')
            };

            try {
              const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
              });

              if (response.ok) {
                const user = await response.json();
                this.setUser(user);
                this.showSuccess('Welcome! Redirecting to your dashboard...');
                setTimeout(() => location.reload(), 1000);
              } else {
                this.showError('Failed to create account');
              }
            } catch (error) {
              this.showError('Failed to create account: ' + error.message);
            }
          }

          static showSuccess(message) {
            this.showNotification(message, 'success');
          }

          static showError(message) {
            this.showNotification(message, 'error');
          }

          static showNotification(message, type) {
            const notification = document.createElement('div');
            notification.className = \`notification notification-\${type}\`;
            notification.textContent = message;
            
            Object.assign(notification.style, {
              position: 'fixed',
              top: '20px',
              right: '20px',
              padding: '12px 20px',
              borderRadius: '6px',
              color: 'white',
              background: type === 'success' ? '#059669' : '#dc2626',
              zIndex: '10000',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
            });

            document.body.appendChild(notification);

            setTimeout(() => {
              notification.remove();
            }, 5000);
          }

          // Placeholder methods for API calls
          static async getCreateFormHtml() {
            return '<!-- Create form HTML would be generated here -->';
          }

          static async getEditFormHtml(alertId) {
            return '<!-- Edit form HTML would be generated here -->';
          }
        }

        // Initialize on page load
        document.addEventListener('DOMContentLoaded', () => {
          console.log('Alert Management initialized');
        });
      </script>
    `;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export const alertManagementComponent = new AlertManagementComponent(
  // alertService would be injected here
  null as any,
);
