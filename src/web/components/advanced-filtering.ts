/**
 * Advanced Filtering & Sorting System
 * Phase 7 Stage 4: Advanced UI Features & UX
 * Builds upon the basic advanced-search component with enhanced filtering capabilities
 */

import { SecurityUtils } from '../utils/security-utils.js';

// Extended filter types
interface AdvancedFilters extends SearchFilters {
  experience?: string[];
  companySize?: string[];
  industry?: string[];
  benefits?: string[];
  salaryRange?: 'below_50k' | '50k_100k' | '100k_150k' | 'above_150k';
  postedDate?: Date[];
  workLifeBalance?: number; // 1-5 rating
  jobType?: string[]; // full-time, part-time, contract, internship
  educationLevel?: string[];
  requirements?: string[];
}

interface SortOption {
  field: string;
  label: string;
  direction: 'asc' | 'desc';
}

interface FilterPreset {
  id: string;
  name: string;
  description: string;
  filters: AdvancedFilters;
  createdAt: Date;
  isDefault: boolean;
}

interface FilterAnalytics {
  totalJobs: number;
  filteredJobs: number;
  reductionPercentage: number;
  mostCommonCompanies: Array<{ company: string; count: number }>;
  salaryDistribution: Array<{ range: string; count: number }>;
  locationDistribution: Array<{ location: string; count: number }>;
  skillDemand: Array<{ skill: string; count: number }>;
}

interface SearchFilters {
  query?: string;
  location?: string;
  company?: string;
  minSalary?: number;
  maxSalary?: number;
  employmentType?: string;
  remote?: boolean;
  skills?: string[];
  postedWithin?: string;
}

/**
 * Advanced Filtering & Sorting Component
 * Provides comprehensive job filtering with presets, analytics, and multi-dimensional sorting
 */
export class AdvancedFilteringComponent {
  private ws: WebSocket | null = null;
  private currentFilters: AdvancedFilters = {};
  private savedPresets: FilterPreset[] = [];
  private sortOptions: SortOption[] = [
    { field: 'relevance', label: 'Relevance', direction: 'desc' },
    { field: 'postedDate', label: 'Date Posted', direction: 'desc' },
    { field: 'salary', label: 'Salary (High to Low)', direction: 'desc' },
    { field: 'salary', label: 'Salary (Low to High)', direction: 'asc' },
    { field: 'company', label: 'Company A-Z', direction: 'asc' },
    { field: 'title', label: 'Job Title A-Z', direction: 'asc' },
    { field: 'location', label: 'Location A-Z', direction: 'asc' },
    { field: 'experienceLevel', label: 'Experience Level', direction: 'asc' },
  ];
  private currentSort: SortOption;

  constructor() {
    this.currentSort = this.sortOptions[0] || {
      field: 'relevance',
      label: 'Relevance',
      direction: 'desc',
    };
    this.loadSavedPresets();
    this.initializeEventListeners();
  }

  /**
   * Initialize WebSocket connection for real-time filtering
   */
  setWebSocket(ws: WebSocket): void {
    this.ws = ws;

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'filter_results') {
          this.handleFilterResults(data.payload);
        } else if (data.type === 'filter_analytics') {
          this.updateFilterAnalytics(data.payload);
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };
  }

  /**
   * Initialize the advanced filtering interface
   */
  init(): void {
    this.renderFilterInterface();
    this.renderPresetManager();
    this.renderSortingControls();
    this.renderFilterAnalytics();
    this.loadDefaultPresets();
  }

  /**
   * Render the main filtering interface
   */
  private renderFilterInterface(): void {
    const filterContainer = document.getElementById('advanced-filters');
    if (!filterContainer) return;

    const html = `
      <div class="filter-panel">
        <div class="filter-header">
          <h3>🔍 Advanced Filters</h3>
          <div class="filter-actions">
            <button id="clear-filters" class="btn-secondary">Clear All</button>
            <button id="save-preset" class="btn-primary">Save Preset</button>
          </div>
        </div>
        
        <div class="filter-categories">
          ${this.renderBasicFilters()}
          ${this.renderSalaryFilters()}
          ${this.renderJobTypeFilters()}
          ${this.renderCompanyFilters()}
          ${this.renderSkillsFilters()}
          ${this.renderLocationFilters()}
          ${this.renderExperienceFilters()}
        </div>
        
        <div class="filter-summary">
          <div id="filter-count">0 filters active</div>
          <div id="results-count">0 jobs match your criteria</div>
        </div>
      </div>
    `;

    SecurityUtils.setSecureHTML(filterContainer, html);
    this.attachFilterListeners();
  }

  /**
   * Render basic search filters
   */
  private renderBasicFilters(): string {
    return `
      <div class="filter-category">
        <h4>📝 Basic Search</h4>
        <div class="filter-group">
          <input type="text" id="job-query" placeholder="Job title, skills, or keywords..." 
                 value="${this.currentFilters.query || ''}" />
          <select id="posted-within">
            <option value="">Any time</option>
            <option value="1d" ${this.currentFilters.postedWithin === '1d' ? 'selected' : ''}>Past 24 hours</option>
            <option value="3d" ${this.currentFilters.postedWithin === '3d' ? 'selected' : ''}>Past 3 days</option>
            <option value="1w" ${this.currentFilters.postedWithin === '1w' ? 'selected' : ''}>Past week</option>
            <option value="1m" ${this.currentFilters.postedWithin === '1m' ? 'selected' : ''}>Past month</option>
          </select>
        </div>
      </div>
    `;
  }

  /**
   * Render salary filtering controls
   */
  private renderSalaryFilters(): string {
    return `
      <div class="filter-category">
        <h4>💰 Salary Range</h4>
        <div class="filter-group salary-filters">
          <div class="salary-range">
            <label>Min Salary</label>
            <input type="number" id="min-salary" placeholder="0" step="5000" 
                   value="${this.currentFilters.minSalary || ''}" />
          </div>
          <div class="salary-range">
            <label>Max Salary</label>
            <input type="number" id="max-salary" placeholder="200000" step="5000" 
                   value="${this.currentFilters.maxSalary || ''}" />
          </div>
          <div class="salary-presets">
            <button class="salary-preset" data-range="below_50k">Under $50K</button>
            <button class="salary-preset" data-range="50k_100k">$50K - $100K</button>
            <button class="salary-preset" data-range="100k_150k">$100K - $150K</button>
            <button class="salary-preset" data-range="above_150k">$150K+</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render job type and employment filters
   */
  private renderJobTypeFilters(): string {
    const jobTypes = ['full-time', 'part-time', 'contract', 'internship', 'temporary'];
    const experienceLevels = ['entry', 'mid', 'senior', 'lead', 'executive'];

    return `
      <div class="filter-category">
        <h4>👔 Job Type & Experience</h4>
        <div class="filter-group">
          <div class="checkbox-group">
            <label>Employment Type:</label>
            ${jobTypes
              .map(
                (type) => `
              <label class="checkbox-label">
                <input type="checkbox" name="job-type" value="${type}" 
                       ${this.currentFilters.jobType?.includes(type) ? 'checked' : ''} />
                ${type.charAt(0).toUpperCase() + type.slice(1)}
              </label>
            `,
              )
              .join('')}
          </div>
          
          <div class="checkbox-group">
            <label>Experience Level:</label>
            ${experienceLevels
              .map(
                (level) => `
              <label class="checkbox-label">
                <input type="checkbox" name="experience" value="${level}" 
                       ${this.currentFilters.experience?.includes(level) ? 'checked' : ''} />
                ${level.charAt(0).toUpperCase() + level.slice(1)}
              </label>
            `,
              )
              .join('')}
          </div>
          
          <label class="checkbox-label remote-toggle">
            <input type="checkbox" id="remote-only" 
                   ${this.currentFilters.remote ? 'checked' : ''} />
            Remote Work Only
          </label>
        </div>
      </div>
    `;
  }

  /**
   * Render company and industry filters
   */
  private renderCompanyFilters(): string {
    const companySizes = ['startup', 'small', 'medium', 'large', 'enterprise'];
    const industries = [
      'technology',
      'finance',
      'healthcare',
      'education',
      'retail',
      'manufacturing',
    ];

    return `
      <div class="filter-category">
        <h4>🏢 Company & Industry</h4>
        <div class="filter-group">
          <input type="text" id="company-name" placeholder="Company name..." 
                 value="${this.currentFilters.company || ''}" />
          
          <div class="checkbox-group">
            <label>Company Size:</label>
            ${companySizes
              .map(
                (size) => `
              <label class="checkbox-label">
                <input type="checkbox" name="company-size" value="${size}" 
                       ${this.currentFilters.companySize?.includes(size) ? 'checked' : ''} />
                ${size.charAt(0).toUpperCase() + size.slice(1)}
              </label>
            `,
              )
              .join('')}
          </div>
          
          <div class="checkbox-group">
            <label>Industry:</label>
            ${industries
              .map(
                (industry) => `
              <label class="checkbox-label">
                <input type="checkbox" name="industry" value="${industry}" 
                       ${this.currentFilters.industry?.includes(industry) ? 'checked' : ''} />
                ${industry.charAt(0).toUpperCase() + industry.slice(1)}
              </label>
            `,
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render skills filtering interface
   */
  private renderSkillsFilters(): string {
    const popularSkills = [
      'JavaScript',
      'TypeScript',
      'React',
      'Node.js',
      'Python',
      'Java',
      'AWS',
      'Docker',
      'Kubernetes',
      'MongoDB',
      'PostgreSQL',
      'GraphQL',
      'REST API',
    ];

    return `
      <div class="filter-category">
        <h4>🛠️ Skills & Requirements</h4>
        <div class="filter-group">
          <div class="skills-input">
            <input type="text" id="skills-search" placeholder="Search skills..." />
            <div class="skills-suggestions" id="skills-suggestions"></div>
          </div>
          
          <div class="selected-skills" id="selected-skills">
            ${(this.currentFilters.skills || [])
              .map(
                (skill) => `
              <span class="skill-tag">
                ${skill}
                <button class="remove-skill" data-skill="${skill}">×</button>
              </span>
            `,
              )
              .join('')}
          </div>
          
          <div class="popular-skills">
            <label>Popular Skills:</label>
            <div class="skills-grid">
              ${popularSkills
                .map(
                  (skill) => `
                <button class="skill-button" data-skill="${skill}">
                  ${skill}
                </button>
              `,
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render location filtering controls
   */
  private renderLocationFilters(): string {
    const popularLocations = [
      'San Francisco, CA',
      'New York, NY',
      'Seattle, WA',
      'Austin, TX',
      'Boston, MA',
      'Los Angeles, CA',
      'Chicago, IL',
      'Remote',
    ];

    return `
      <div class="filter-category">
        <h4>📍 Location</h4>
        <div class="filter-group">
          <input type="text" id="location-search" placeholder="City, state, or country..." 
                 value="${this.currentFilters.location || ''}" />
          
          <div class="location-presets">
            ${popularLocations
              .map(
                (location) => `
              <button class="location-preset" data-location="${location}">
                ${location}
              </button>
            `,
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render experience and education filters
   */
  private renderExperienceFilters(): string {
    const educationLevels = ['high-school', 'associate', 'bachelor', 'master', 'phd'];

    return `
      <div class="filter-category">
        <h4>🎓 Experience & Education</h4>
        <div class="filter-group">
          <div class="checkbox-group">
            <label>Education Level:</label>
            ${educationLevels
              .map(
                (level) => `
              <label class="checkbox-label">
                <input type="checkbox" name="education" value="${level}" 
                       ${this.currentFilters.educationLevel?.includes(level) ? 'checked' : ''} />
                ${level
                  .split('-')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ')}
              </label>
            `,
              )
              .join('')}
          </div>
          
          <div class="work-life-balance">
            <label>Min Work-Life Balance Rating:</label>
            <input type="range" id="work-life-balance" min="1" max="5" step="1" 
                   value="${this.currentFilters.workLifeBalance || 3}" />
            <span id="balance-value">${this.currentFilters.workLifeBalance || 3}/5</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render preset manager interface
   */
  private renderPresetManager(): void {
    const presetContainer = document.getElementById('filter-presets');
    if (!presetContainer) return;

    const html = `
      <div class="preset-manager">
        <h3>💾 Filter Presets</h3>
        <div class="presets-grid">
          ${this.savedPresets
            .map(
              (preset) => `
            <div class="preset-card ${preset.isDefault ? 'default' : ''}" data-preset-id="${preset.id}">
              <div class="preset-header">
                <h4>${preset.name}</h4>
                <div class="preset-actions">
                  <button class="apply-preset" title="Apply">▶</button>
                  <button class="edit-preset" title="Edit">✏</button>
                  <button class="delete-preset" title="Delete">🗑</button>
                </div>
              </div>
              <p class="preset-description">${preset.description}</p>
              <div class="preset-stats">
                ${this.getPresetFilterCount(preset.filters)} filters
              </div>
            </div>
          `,
            )
            .join('')}
          
          <div class="preset-card add-new" id="add-preset">
            <div class="add-preset-content">
              <span class="plus-icon">+</span>
              <span>Create New Preset</span>
            </div>
          </div>
        </div>
      </div>
    `;

    SecurityUtils.setSecureHTML(presetContainer, html);
    this.attachPresetListeners();
  }

  /**
   * Render sorting controls
   */
  private renderSortingControls(): void {
    const sortContainer = document.getElementById('sort-controls');
    if (!sortContainer) return;

    const html = `
      <div class="sort-controls">
        <label for="sort-by">Sort by:</label>
        <select id="sort-by">
          ${this.sortOptions
            .map(
              (option) => `
            <option value="${option.field}-${option.direction}" 
                    ${this.currentSort.field === option.field && this.currentSort.direction === option.direction ? 'selected' : ''}>
              ${option.label}
            </option>
          `,
            )
            .join('')}
        </select>
        
        <div class="sort-actions">
          <button id="toggle-sort-direction" class="btn-secondary">
            ${this.currentSort.direction === 'asc' ? '↑' : '↓'}
          </button>
          <button id="add-secondary-sort" class="btn-secondary" title="Add secondary sort">+</button>
        </div>
      </div>
    `;

    SecurityUtils.setSecureHTML(sortContainer, html);
    this.attachSortingListeners();
  }

  /**
   * Render filter analytics panel
   */
  private renderFilterAnalytics(): void {
    const analyticsContainer = document.getElementById('filter-analytics');
    if (!analyticsContainer) return;

    // Mock analytics data - in real implementation, this would come from server
    const analytics: FilterAnalytics = {
      totalJobs: 15420,
      filteredJobs: 0,
      reductionPercentage: 0,
      mostCommonCompanies: [],
      salaryDistribution: [],
      locationDistribution: [],
      skillDemand: [],
    };

    const html = `
      <div class="analytics-panel">
        <h3>📊 Filter Analytics</h3>
        <div class="analytics-summary">
          <div class="stat-card">
            <span class="stat-number" id="total-jobs">${analytics.totalJobs.toLocaleString()}</span>
            <span class="stat-label">Total Jobs</span>
          </div>
          <div class="stat-card">
            <span class="stat-number" id="filtered-jobs">${analytics.filteredJobs.toLocaleString()}</span>
            <span class="stat-label">Matching Jobs</span>
          </div>
          <div class="stat-card">
            <span class="stat-number" id="reduction-percent">${analytics.reductionPercentage}%</span>
            <span class="stat-label">Filtered Out</span>
          </div>
        </div>
        
        <div class="analytics-charts">
          <div class="chart-container">
            <canvas id="company-distribution-chart"></canvas>
          </div>
          <div class="chart-container">
            <canvas id="salary-distribution-chart"></canvas>
          </div>
        </div>
      </div>
    `;

    SecurityUtils.setSecureHTML(analyticsContainer, html);
    this.initializeAnalyticsCharts();
  }

  /**
   * Initialize Chart.js analytics charts
   */
  private initializeAnalyticsCharts(): void {
    // Company distribution chart
    const companyCtx = document.getElementById('company-distribution-chart') as HTMLCanvasElement;
    if (companyCtx && typeof window !== 'undefined' && (window as any).Chart) {
      const Chart = (window as any).Chart;
      new Chart(companyCtx, {
        type: 'doughnut',
        data: {
          labels: ['Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Others'],
          datasets: [
            {
              data: [1200, 800, 600, 900, 500, 2400],
              backgroundColor: ['#4285f4', '#00a1f1', '#007aff', '#ff9900', '#1877f2', '#6c757d'],
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Top Companies',
            },
            legend: {
              position: 'bottom',
            },
          },
        },
      });
    }

    // Salary distribution chart
    const salaryCtx = document.getElementById('salary-distribution-chart') as HTMLCanvasElement;
    if (salaryCtx && typeof window !== 'undefined' && (window as any).Chart) {
      const Chart = (window as any).Chart;
      new Chart(salaryCtx, {
        type: 'bar',
        data: {
          labels: ['$0-50K', '$50-100K', '$100-150K', '$150-200K', '$200K+'],
          datasets: [
            {
              label: 'Job Count',
              data: [800, 3200, 4100, 2800, 1200],
              backgroundColor: '#28a745',
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Salary Distribution',
            },
          },
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        },
      });
    }
  }

  /**
   * Attach event listeners to filter controls
   */
  private attachFilterListeners(): void {
    // Basic filters
    const queryInput = document.getElementById('job-query');
    const postedWithinSelect = document.getElementById('posted-within');

    if (queryInput) {
      queryInput.addEventListener('input', () => this.handleFilterChange());
    }

    if (postedWithinSelect) {
      postedWithinSelect.addEventListener('change', () => this.handleFilterChange());
    }

    // Salary filters
    const minSalaryInput = document.getElementById('min-salary');
    const maxSalaryInput = document.getElementById('max-salary');

    if (minSalaryInput) {
      minSalaryInput.addEventListener('input', () => this.handleFilterChange());
    }

    if (maxSalaryInput) {
      maxSalaryInput.addEventListener('input', () => this.handleFilterChange());
    }

    // Salary presets
    document.querySelectorAll('.salary-preset').forEach((button) => {
      button.addEventListener('click', (e) => {
        const range = (e.target as HTMLElement).dataset.range;
        this.applySalaryRange(range);
      });
    });

    // Checkbox filters
    document.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => this.handleFilterChange());
    });

    // Skills management
    this.attachSkillsListeners();

    // Location presets
    document.querySelectorAll('.location-preset').forEach((button) => {
      button.addEventListener('click', (e) => {
        const location = (e.target as HTMLElement).dataset.location;
        this.setLocation(location);
      });
    });

    // Work-life balance slider
    const balanceSlider = document.getElementById('work-life-balance');
    const balanceValue = document.getElementById('balance-value');

    if (balanceSlider && balanceValue) {
      balanceSlider.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        balanceValue.textContent = `${value}/5`;
        this.handleFilterChange();
      });
    }

    // Action buttons
    const clearFiltersBtn = document.getElementById('clear-filters');
    const savePresetBtn = document.getElementById('save-preset');

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => this.clearAllFilters());
    }

    if (savePresetBtn) {
      savePresetBtn.addEventListener('click', () => this.showSavePresetDialog());
    }
  }

  /**
   * Attach event listeners for skills management
   */
  private attachSkillsListeners(): void {
    const skillsSearch = document.getElementById('skills-search') as HTMLInputElement;
    if (skillsSearch) {
      skillsSearch.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value;
        this.showSkillsSuggestions(query);
      });
    }

    // Skill buttons
    document.querySelectorAll('.skill-button').forEach((button) => {
      button.addEventListener('click', (e) => {
        const skill = (e.target as HTMLElement).dataset.skill;
        if (skill) {
          this.addSkill(skill);
        }
      });
    });

    // Remove skill buttons
    document.querySelectorAll('.remove-skill').forEach((button) => {
      button.addEventListener('click', (e) => {
        const skill = (e.target as HTMLElement).dataset.skill;
        if (skill) {
          this.removeSkill(skill);
        }
      });
    });
  }

  /**
   * Attach event listeners for preset management
   */
  private attachPresetListeners(): void {
    document.querySelectorAll('.apply-preset').forEach((button) => {
      button.addEventListener('click', (e) => {
        const presetCard = (e.target as HTMLElement).closest('.preset-card') as HTMLElement;
        const presetId = presetCard?.dataset.presetId;
        if (presetId) {
          this.applyPreset(presetId);
        }
      });
    });

    document.querySelectorAll('.edit-preset').forEach((button) => {
      button.addEventListener('click', (e) => {
        const presetCard = (e.target as HTMLElement).closest('.preset-card') as HTMLElement;
        const presetId = presetCard?.dataset.presetId;
        if (presetId) {
          this.editPreset(presetId);
        }
      });
    });

    document.querySelectorAll('.delete-preset').forEach((button) => {
      button.addEventListener('click', (e) => {
        const presetCard = (e.target as HTMLElement).closest('.preset-card') as HTMLElement;
        const presetId = presetCard?.dataset.presetId;
        if (presetId) {
          this.deletePreset(presetId);
        }
      });
    });

    const addPresetBtn = document.getElementById('add-preset');
    if (addPresetBtn) {
      addPresetBtn.addEventListener('click', () => this.showSavePresetDialog());
    }
  }

  /**
   * Attach event listeners for sorting controls
   */
  private attachSortingListeners(): void {
    const sortSelect = document.getElementById('sort-by') as HTMLSelectElement;
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const value = (e.target as HTMLSelectElement).value;
        const [field, direction] = value.split('-');
        if (field) {
          this.currentSort = {
            field,
            label: '',
            direction: (direction || 'asc') as 'asc' | 'desc',
          };
          this.applySorting();
        }
      });
    }

    const toggleDirectionBtn = document.getElementById('toggle-sort-direction');
    if (toggleDirectionBtn) {
      toggleDirectionBtn.addEventListener('click', () => {
        this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        this.applySorting();
        this.renderSortingControls(); // Re-render to update button
      });
    }
  }

  /**
   * Initialize default event listeners
   */
  private initializeEventListeners(): void {
    // This will be called after DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
      this.init();
    });
  }

  /**
   * Handle filter changes and apply them
   */
  private handleFilterChange(): void {
    this.collectCurrentFilters();
    this.applyFilters();
    this.updateFilterSummary();
  }

  /**
   * Collect current filter values from the UI
   */
  private collectCurrentFilters(): void {
    const queryInput = document.getElementById('job-query') as HTMLInputElement;
    const postedWithinSelect = document.getElementById('posted-within') as HTMLSelectElement;
    const minSalaryInput = document.getElementById('min-salary') as HTMLInputElement;
    const maxSalaryInput = document.getElementById('max-salary') as HTMLInputElement;
    const companyInput = document.getElementById('company-name') as HTMLInputElement;
    const locationInput = document.getElementById('location-search') as HTMLInputElement;
    const remoteCheckbox = document.getElementById('remote-only') as HTMLInputElement;
    const balanceSlider = document.getElementById('work-life-balance') as HTMLInputElement;

    this.currentFilters = {};

    if (queryInput?.value) this.currentFilters.query = queryInput.value;
    if (postedWithinSelect?.value) this.currentFilters.postedWithin = postedWithinSelect.value;
    if (minSalaryInput?.value)
      this.currentFilters.minSalary = Number.parseInt(minSalaryInput.value);
    if (maxSalaryInput?.value)
      this.currentFilters.maxSalary = Number.parseInt(maxSalaryInput.value);
    if (companyInput?.value) this.currentFilters.company = companyInput.value;
    if (locationInput?.value) this.currentFilters.location = locationInput.value;
    if (remoteCheckbox?.checked) this.currentFilters.remote = true;
    if (balanceSlider?.value)
      this.currentFilters.workLifeBalance = Number.parseInt(balanceSlider.value);

    // Collect checkbox arrays
    this.currentFilters.jobType = this.getCheckedValues('job-type');
    this.currentFilters.experience = this.getCheckedValues('experience');
    this.currentFilters.companySize = this.getCheckedValues('company-size');
    this.currentFilters.industry = this.getCheckedValues('industry');
    this.currentFilters.educationLevel = this.getCheckedValues('education');
  }

  /**
   * Get checked values for a checkbox group
   */
  private getCheckedValues(name: string): string[] {
    const checkboxes = document.querySelectorAll(
      `input[name="${name}"]:checked`,
    ) as NodeListOf<HTMLInputElement>;
    return Array.from(checkboxes).map((cb) => cb.value);
  }

  /**
   * Apply current filters
   */
  private applyFilters(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'apply_filters',
          payload: {
            filters: this.currentFilters,
            sort: this.currentSort,
          },
        }),
      );
    }
  }

  /**
   * Apply sorting
   */
  private applySorting(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'apply_sorting',
          payload: {
            sort: this.currentSort,
            filters: this.currentFilters,
          },
        }),
      );
    }
  }

  /**
   * Update filter summary display
   */
  private updateFilterSummary(): void {
    const filterCount = this.getActiveFilterCount();
    const filterCountEl = document.getElementById('filter-count');

    if (filterCountEl) {
      filterCountEl.textContent = `${filterCount} filter${filterCount !== 1 ? 's' : ''} active`;
    }
  }

  /**
   * Get count of active filters
   */
  private getActiveFilterCount(): number {
    let count = 0;

    if (this.currentFilters.query) count++;
    if (this.currentFilters.location) count++;
    if (this.currentFilters.company) count++;
    if (this.currentFilters.minSalary) count++;
    if (this.currentFilters.maxSalary) count++;
    if (this.currentFilters.postedWithin) count++;
    if (this.currentFilters.remote) count++;
    if (this.currentFilters.workLifeBalance) count++;

    if (this.currentFilters.jobType?.length) count++;
    if (this.currentFilters.experience?.length) count++;
    if (this.currentFilters.companySize?.length) count++;
    if (this.currentFilters.industry?.length) count++;
    if (this.currentFilters.educationLevel?.length) count++;
    if (this.currentFilters.skills?.length) count++;

    return count;
  }

  /**
   * Clear all filters
   */
  private clearAllFilters(): void {
    this.currentFilters = {};
    this.renderFilterInterface();
    this.applyFilters();
  }

  /**
   * Apply salary range preset
   */
  private applySalaryRange(range: string | undefined): void {
    const minSalaryInput = document.getElementById('min-salary') as HTMLInputElement;
    const maxSalaryInput = document.getElementById('max-salary') as HTMLInputElement;

    if (!minSalaryInput || !maxSalaryInput) return;

    switch (range) {
      case 'below_50k':
        minSalaryInput.value = '0';
        maxSalaryInput.value = '50000';
        break;
      case '50k_100k':
        minSalaryInput.value = '50000';
        maxSalaryInput.value = '100000';
        break;
      case '100k_150k':
        minSalaryInput.value = '100000';
        maxSalaryInput.value = '150000';
        break;
      case 'above_150k':
        minSalaryInput.value = '150000';
        maxSalaryInput.value = '';
        break;
    }

    this.handleFilterChange();
  }

  /**
   * Set location filter
   */
  private setLocation(location: string | undefined): void {
    const locationInput = document.getElementById('location-search') as HTMLInputElement;
    if (locationInput && location) {
      locationInput.value = location;
      this.handleFilterChange();
    }
  }

  /**
   * Show skills suggestions
   */
  private showSkillsSuggestions(query: string): void {
    if (!query || query.length < 2) {
      const suggestions = document.getElementById('skills-suggestions');
      if (suggestions) {
        suggestions.style.display = 'none';
      }
      return;
    }

    // Mock suggestions - in real app, fetch from API
    const allSkills = [
      'JavaScript',
      'TypeScript',
      'React',
      'Vue.js',
      'Angular',
      'Node.js',
      'Python',
      'Java',
      'C#',
      'PHP',
      'Ruby',
      'Go',
      'Rust',
      'Swift',
      'AWS',
      'Azure',
      'Google Cloud',
      'Docker',
      'Kubernetes',
      'Jenkins',
      'MongoDB',
      'PostgreSQL',
      'MySQL',
      'Redis',
      'Elasticsearch',
      'GraphQL',
      'REST API',
      'Microservices',
      'DevOps',
      'CI/CD',
    ];

    const filteredSkills = allSkills
      .filter((skill) => skill.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10);

    const suggestions = document.getElementById('skills-suggestions');
    if (suggestions) {
      const skillsHtml = filteredSkills
        .map(
          (skill) => `
        <div class="skill-suggestion" data-skill="${SecurityUtils.escapeHTML(skill)}">${SecurityUtils.escapeHTML(skill)}</div>
      `,
        )
        .join('');
      SecurityUtils.setSecureHTML(suggestions, skillsHtml);
      suggestions.style.display = filteredSkills.length ? 'block' : 'none';

      // Add click listeners to suggestions
      suggestions.querySelectorAll('.skill-suggestion').forEach((suggestion) => {
        suggestion.addEventListener('click', (e) => {
          const skill = (e.target as HTMLElement).dataset.skill;
          if (skill) {
            this.addSkill(skill);
            suggestions.style.display = 'none';
            (document.getElementById('skills-search') as HTMLInputElement).value = '';
          }
        });
      });
    }
  }

  /**
   * Add skill to filter
   */
  private addSkill(skill: string): void {
    if (!this.currentFilters.skills) {
      this.currentFilters.skills = [];
    }

    if (!this.currentFilters.skills.includes(skill)) {
      this.currentFilters.skills.push(skill);
      this.renderSelectedSkills();
      this.handleFilterChange();
    }
  }

  /**
   * Remove skill from filter
   */
  private removeSkill(skill: string): void {
    if (this.currentFilters.skills) {
      this.currentFilters.skills = this.currentFilters.skills.filter((s) => s !== skill);
      this.renderSelectedSkills();
      this.handleFilterChange();
    }
  }

  /**
   * Render selected skills
   */
  private renderSelectedSkills(): void {
    const selectedSkillsEl = document.getElementById('selected-skills');
    if (selectedSkillsEl) {
      const skillsHtml = (this.currentFilters.skills || [])
        .map(
          (skill) => `
        <span class="skill-tag">
          ${SecurityUtils.escapeHTML(skill)}
          <button class="remove-skill" data-skill="${SecurityUtils.escapeHTML(skill)}">×</button>
        </span>
      `,
        )
        .join('');
      SecurityUtils.setSecureHTML(selectedSkillsEl, skillsHtml);

      // Reattach listeners to remove buttons
      selectedSkillsEl.querySelectorAll('.remove-skill').forEach((button) => {
        button.addEventListener('click', (e) => {
          const skill = (e.target as HTMLElement).dataset.skill;
          if (skill) {
            this.removeSkill(skill);
          }
        });
      });
    }
  }

  /**
   * Show save preset dialog
   */
  private showSavePresetDialog(): void {
    const name = prompt('Preset name:');
    const description = prompt('Preset description (optional):') || '';

    if (name) {
      this.savePreset(name, description);
    }
  }

  /**
   * Save current filters as preset
   */
  private savePreset(name: string, description: string): void {
    const preset: FilterPreset = {
      id: `preset_${Date.now()}`,
      name,
      description,
      filters: { ...this.currentFilters },
      createdAt: new Date(),
      isDefault: false,
    };

    this.savedPresets.push(preset);
    this.savePersistentData();
    this.renderPresetManager();
  }

  /**
   * Apply a saved preset
   */
  private applyPreset(presetId: string): void {
    const preset = this.savedPresets.find((p) => p.id === presetId);
    if (preset) {
      this.currentFilters = { ...preset.filters };
      this.renderFilterInterface();
      this.applyFilters();
    }
  }

  /**
   * Edit a preset
   */
  private editPreset(presetId: string): void {
    const preset = this.savedPresets.find((p) => p.id === presetId);
    if (preset) {
      const name = prompt('Preset name:', preset.name);
      const description = prompt('Preset description:', preset.description);

      if (name) {
        preset.name = name;
        preset.description = description || '';
        this.savePersistentData();
        this.renderPresetManager();
      }
    }
  }

  /**
   * Delete a preset
   */
  private deletePreset(presetId: string): void {
    if (confirm('Delete this preset?')) {
      this.savedPresets = this.savedPresets.filter((p) => p.id !== presetId);
      this.savePersistentData();
      this.renderPresetManager();
    }
  }

  /**
   * Get count of filters in a preset
   */
  private getPresetFilterCount(filters: AdvancedFilters): number {
    let count = 0;

    Object.values(filters).forEach((value) => {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          if (value.length > 0) count++;
        } else {
          count++;
        }
      }
    });

    return count;
  }

  /**
   * Load default presets
   */
  private loadDefaultPresets(): void {
    if (this.savedPresets.length === 0) {
      this.savedPresets = [
        {
          id: 'remote_tech',
          name: 'Remote Tech Jobs',
          description: 'High-paying remote technology positions',
          filters: {
            remote: true,
            minSalary: 80000,
            industry: ['technology'],
            skills: ['JavaScript', 'React', 'Node.js'],
          },
          createdAt: new Date(),
          isDefault: true,
        },
        {
          id: 'entry_level',
          name: 'Entry Level',
          description: 'Jobs suitable for new graduates',
          filters: {
            experience: ['entry'],
            postedWithin: '1w',
          },
          createdAt: new Date(),
          isDefault: true,
        },
        {
          id: 'senior_dev',
          name: 'Senior Developer',
          description: 'Senior software development roles',
          filters: {
            experience: ['senior', 'lead'],
            minSalary: 120000,
            skills: ['Architecture', 'Leadership'],
          },
          createdAt: new Date(),
          isDefault: true,
        },
      ];
      this.savePersistentData();
    }
  }

  /**
   * Load saved presets from localStorage
   */
  private loadSavedPresets(): void {
    try {
      const saved = localStorage.getItem('job-search-presets');
      if (saved) {
        this.savedPresets = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading saved presets:', error);
      this.savedPresets = [];
    }
  }

  /**
   * Save presets to localStorage
   */
  private savePersistentData(): void {
    try {
      localStorage.setItem('job-search-presets', JSON.stringify(this.savedPresets));
    } catch (error) {
      console.error('Error saving presets:', error);
    }
  }

  /**
   * Handle filter results from WebSocket
   */
  private handleFilterResults(payload: any): void {
    const resultsCountEl = document.getElementById('results-count');
    if (resultsCountEl && payload.count !== undefined) {
      resultsCountEl.textContent = `${payload.count} jobs match your criteria`;
    }
  }

  /**
   * Update filter analytics
   */
  private updateFilterAnalytics(analytics: FilterAnalytics): void {
    const totalJobsEl = document.getElementById('total-jobs');
    const filteredJobsEl = document.getElementById('filtered-jobs');
    const reductionPercentEl = document.getElementById('reduction-percent');

    if (totalJobsEl) totalJobsEl.textContent = analytics.totalJobs.toLocaleString();
    if (filteredJobsEl) filteredJobsEl.textContent = analytics.filteredJobs.toLocaleString();
    if (reductionPercentEl) reductionPercentEl.textContent = `${analytics.reductionPercentage}%`;
  }

  /**
   * Export current filters configuration
   */
  exportFiltersConfiguration(): string {
    return JSON.stringify(
      {
        filters: this.currentFilters,
        sort: this.currentSort,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  /**
   * Import filters configuration
   */
  importFiltersConfiguration(configJson: string): void {
    try {
      const config = JSON.parse(configJson);
      if (config.filters) {
        this.currentFilters = config.filters;
        this.renderFilterInterface();
      }
      if (config.sort) {
        this.currentSort = config.sort;
        this.renderSortingControls();
      }
      this.applyFilters();
    } catch (error) {
      console.error('Error importing filters configuration:', error);
    }
  }

  /**
   * Get current filter state for external use
   */
  getCurrentFilters(): AdvancedFilters {
    return { ...this.currentFilters };
  }

  /**
   * Set filters programmatically
   */
  setFilters(filters: AdvancedFilters): void {
    this.currentFilters = { ...filters };
    this.renderFilterInterface();
    this.applyFilters();
  }
}

// Export for global use
(window as any).AdvancedFilteringComponent = AdvancedFilteringComponent;
