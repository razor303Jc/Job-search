/**
 * Job Alert System Component
 * Phase 7 Stage 3: Real-time job matching and notifications
 */

class JobAlertSystem {
    constructor() {
        this.alerts = [];
        this.ws = null;
        this.isConnected = false;
        this.notificationPermission = 'default';
        
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.requestNotificationPermission();
        this.loadSavedAlerts();
        this.setupEventListeners();
        this.renderAlerts();
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Job Alert WebSocket connected');
            this.isConnected = true;
            this.updateConnectionStatus(true);
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('Job Alert WebSocket disconnected');
            this.isConnected = false;
            this.updateConnectionStatus(false);
        };
    }

    async requestNotificationPermission() {
        if ('Notification' in window) {
            this.notificationPermission = await Notification.requestPermission();
            this.updateNotificationStatus();
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'job-match':
                this.handleJobMatch(data.data);
                break;
            case 'alert-triggered':
                this.handleAlertTriggered(data.data);
                break;
            case 'new-job':
                this.checkJobAgainstAlerts(data.data);
                break;
            default:
                console.log('Unknown alert message type:', data.type);
        }
    }

    handleJobMatch(jobData) {
        console.log('Job match found:', jobData);
        
        // Show browser notification
        this.showNotification(
            `New Job Match: ${jobData.title}`,
            {
                body: `${jobData.company} - ${jobData.location}`,
                icon: '/static/notification-icon.png',
                tag: `job-${jobData.id}`,
                data: jobData
            }
        );

        // Add to recent matches
        this.addRecentMatch(jobData);
        
        // Update UI
        this.updateMatchCounter();
    }

    handleAlertTriggered(alertData) {
        console.log('Alert triggered:', alertData);
        
        // Find the alert and update its status
        const alert = this.alerts.find(a => a.id === alertData.alertId);
        if (alert) {
            alert.lastTriggered = new Date().toISOString();
            alert.matchCount = (alert.matchCount || 0) + 1;
            this.saveAlerts();
            this.renderAlerts();
        }
    }

    checkJobAgainstAlerts(job) {
        this.alerts.forEach(alert => {
            if (this.jobMatchesAlert(job, alert)) {
                this.handleJobMatch(job);
                this.handleAlertTriggered({ alertId: alert.id });
            }
        });
    }

    jobMatchesAlert(job, alert) {
        const criteria = alert.criteria;
        
        // Check keywords in title
        if (criteria.keywords && criteria.keywords.length > 0) {
            const titleMatch = criteria.keywords.some(keyword => 
                job.title.toLowerCase().includes(keyword.toLowerCase())
            );
            if (!titleMatch) return false;
        }

        // Check location
        if (criteria.location && criteria.location !== 'any') {
            if (criteria.location === 'remote') {
                if (!job.remote) return false;
            } else {
                if (!job.location.toLowerCase().includes(criteria.location.toLowerCase())) {
                    return false;
                }
            }
        }

        // Check salary range
        if (criteria.minSalary && job.salary?.min) {
            if (job.salary.min < criteria.minSalary) return false;
        }
        if (criteria.maxSalary && job.salary?.max) {
            if (job.salary.max > criteria.maxSalary) return false;
        }

        // Check employment type
        if (criteria.employmentType && criteria.employmentType !== 'any') {
            if (job.employmentType !== criteria.employmentType) return false;
        }

        // Check company
        if (criteria.company && criteria.company.length > 0) {
            const companyMatch = criteria.company.some(company =>
                job.company.toLowerCase().includes(company.toLowerCase())
            );
            if (!companyMatch) return false;
        }

        return true;
    }

    showNotification(title, options = {}) {
        if (this.notificationPermission === 'granted') {
            const notification = new Notification(title, options);
            
            notification.onclick = () => {
                window.focus();
                if (options.data) {
                    this.showJobDetails(options.data);
                }
                notification.close();
            };

            // Auto close after 10 seconds
            setTimeout(() => notification.close(), 10000);
        }
    }

    createAlert(criteria) {
        const alert = {
            id: this.generateId(),
            name: criteria.name || 'Unnamed Alert',
            criteria: criteria,
            active: true,
            created: new Date().toISOString(),
            lastTriggered: null,
            matchCount: 0
        };

        this.alerts.push(alert);
        this.saveAlerts();
        this.renderAlerts();
        
        // Send to server
        if (this.isConnected) {
            this.ws.send(JSON.stringify({
                type: 'create-alert',
                data: alert
            }));
        }

        return alert;
    }

    deleteAlert(alertId) {
        this.alerts = this.alerts.filter(alert => alert.id !== alertId);
        this.saveAlerts();
        this.renderAlerts();
        
        // Send to server
        if (this.isConnected) {
            this.ws.send(JSON.stringify({
                type: 'delete-alert',
                data: { alertId }
            }));
        }
    }

    toggleAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.active = !alert.active;
            this.saveAlerts();
            this.renderAlerts();
            
            // Send to server
            if (this.isConnected) {
                this.ws.send(JSON.stringify({
                    type: 'toggle-alert',
                    data: { alertId, active: alert.active }
                }));
            }
        }
    }

    setupEventListeners() {
        // Create alert form submission
        const createForm = document.getElementById('createAlertForm');
        if (createForm) {
            createForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateAlert(new FormData(createForm));
            });
        }

        // Keywords input handling
        const keywordsInput = document.getElementById('keywords');
        if (keywordsInput) {
            keywordsInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                    this.addKeywordTag(e.target.value.trim());
                    e.target.value = '';
                    e.preventDefault();
                }
            });
        }

        // Company input handling
        const companyInput = document.getElementById('company');
        if (companyInput) {
            companyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                    this.addCompanyTag(e.target.value.trim());
                    e.target.value = '';
                    e.preventDefault();
                }
            });
        }
    }

    handleCreateAlert(formData) {
        const criteria = {
            name: formData.get('alertName'),
            keywords: this.getKeywordTags(),
            location: formData.get('location'),
            minSalary: parseInt(formData.get('minSalary')) || null,
            maxSalary: parseInt(formData.get('maxSalary')) || null,
            employmentType: formData.get('employmentType'),
            company: this.getCompanyTags(),
            remote: formData.get('remote') === 'on'
        };

        this.createAlert(criteria);
        
        // Reset form
        document.getElementById('createAlertForm').reset();
        this.clearKeywordTags();
        this.clearCompanyTags();
        
        // Show success message
        this.showSuccessMessage('Alert created successfully!');
    }

    renderAlerts() {
        const container = document.getElementById('alertsList');
        if (!container) return;

        if (this.alerts.length === 0) {
            container.innerHTML = `
                <div class="no-alerts">
                    <p>No job alerts created yet.</p>
                    <p>Create your first alert to get notified about matching jobs!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.alerts.map(alert => `
            <div class="alert-item ${alert.active ? 'active' : 'inactive'}">
                <div class="alert-header">
                    <div class="alert-info">
                        <h3 class="alert-name">${alert.name}</h3>
                        <div class="alert-meta">
                            <span class="alert-status ${alert.active ? 'active' : 'inactive'}">
                                ${alert.active ? 'Active' : 'Inactive'}
                            </span>
                            <span class="alert-matches">${alert.matchCount || 0} matches</span>
                            <span class="alert-created">Created ${this.formatDate(alert.created)}</span>
                        </div>
                    </div>
                    <div class="alert-actions">
                        <button class="btn btn-small" onclick="jobAlertSystem.toggleAlert('${alert.id}')">
                            ${alert.active ? 'Pause' : 'Resume'}
                        </button>
                        <button class="btn btn-small btn-danger" onclick="jobAlertSystem.deleteAlert('${alert.id}')">
                            Delete
                        </button>
                    </div>
                </div>
                <div class="alert-criteria">
                    ${this.renderCriteria(alert.criteria)}
                </div>
                ${alert.lastTriggered ? `
                    <div class="alert-last-triggered">
                        Last triggered: ${this.formatDate(alert.lastTriggered)}
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    renderCriteria(criteria) {
        let html = '<div class="criteria-list">';
        
        if (criteria.keywords && criteria.keywords.length > 0) {
            html += `<div class="criteria-item">
                <strong>Keywords:</strong> ${criteria.keywords.join(', ')}
            </div>`;
        }
        
        if (criteria.location && criteria.location !== 'any') {
            html += `<div class="criteria-item">
                <strong>Location:</strong> ${criteria.location}
            </div>`;
        }
        
        if (criteria.minSalary || criteria.maxSalary) {
            const salaryRange = [];
            if (criteria.minSalary) salaryRange.push(`Min: $${criteria.minSalary.toLocaleString()}`);
            if (criteria.maxSalary) salaryRange.push(`Max: $${criteria.maxSalary.toLocaleString()}`);
            html += `<div class="criteria-item">
                <strong>Salary:</strong> ${salaryRange.join(', ')}
            </div>`;
        }
        
        if (criteria.employmentType && criteria.employmentType !== 'any') {
            html += `<div class="criteria-item">
                <strong>Type:</strong> ${criteria.employmentType}
            </div>`;
        }
        
        if (criteria.company && criteria.company.length > 0) {
            html += `<div class="criteria-item">
                <strong>Companies:</strong> ${criteria.company.join(', ')}
            </div>`;
        }
        
        html += '</div>';
        return html;
    }

    // Tag management methods
    addKeywordTag(keyword) {
        const container = document.getElementById('keywordTags');
        if (!container) return;

        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `
            ${keyword}
            <button type="button" class="tag-remove" onclick="this.parentElement.remove()">×</button>
        `;
        container.appendChild(tag);
    }

    addCompanyTag(company) {
        const container = document.getElementById('companyTags');
        if (!container) return;

        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `
            ${company}
            <button type="button" class="tag-remove" onclick="this.parentElement.remove()">×</button>
        `;
        container.appendChild(tag);
    }

    getKeywordTags() {
        const container = document.getElementById('keywordTags');
        if (!container) return [];
        return Array.from(container.children).map(tag => tag.textContent.replace('×', '').trim());
    }

    getCompanyTags() {
        const container = document.getElementById('companyTags');
        if (!container) return [];
        return Array.from(container.children).map(tag => tag.textContent.replace('×', '').trim());
    }

    clearKeywordTags() {
        const container = document.getElementById('keywordTags');
        if (container) container.innerHTML = '';
    }

    clearCompanyTags() {
        const container = document.getElementById('companyTags');
        if (container) container.innerHTML = '';
    }

    // Utility methods
    generateId() {
        return 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
        return date.toLocaleDateString();
    }

    saveAlerts() {
        localStorage.setItem('jobAlerts', JSON.stringify(this.alerts));
    }

    loadSavedAlerts() {
        const saved = localStorage.getItem('jobAlerts');
        if (saved) {
            try {
                this.alerts = JSON.parse(saved);
            } catch (error) {
                console.error('Error loading saved alerts:', error);
                this.alerts = [];
            }
        }
    }

    updateConnectionStatus(connected) {
        const indicator = document.getElementById('alertConnectionStatus');
        if (indicator) {
            indicator.className = `connection-indicator ${connected ? 'connected' : 'disconnected'}`;
            indicator.textContent = connected ? 'Connected' : 'Disconnected';
        }
    }

    updateNotificationStatus() {
        const status = document.getElementById('notificationStatus');
        if (status) {
            const statusText = {
                'granted': 'Enabled',
                'denied': 'Blocked',
                'default': 'Not set'
            };
            
            status.textContent = statusText[this.notificationPermission] || 'Unknown';
            status.className = `notification-status ${this.notificationPermission}`;
        }
    }

    showSuccessMessage(message) {
        const notification = document.createElement('div');
        notification.className = 'success-notification';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }

    addRecentMatch(job) {
        // This would add to a recent matches list - implementation depends on UI design
        console.log('Recent match added:', job);
    }

    updateMatchCounter() {
        // This would update a counter in the UI - implementation depends on design
        const totalMatches = this.alerts.reduce((sum, alert) => sum + (alert.matchCount || 0), 0);
        const counter = document.getElementById('totalMatches');
        if (counter) {
            counter.textContent = totalMatches.toString();
        }
    }

    showJobDetails(job) {
        // This would show job details in a modal or navigate to job page
        console.log('Show job details:', job);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JobAlertSystem;
}
