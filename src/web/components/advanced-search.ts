/**
 * Job Search Components and Advanced Filtering System
 * Phase 7 Stage 2: Interactive Dashboard Frontend
 */

// Search Filter Types
interface SearchFilters {
  query?: string;
  location?: string;
  company?: string;
  minSalary?: number;
  maxSalary?: number;
  employmentType?: string;
  remote?: boolean;
  skills?: string[];
  postedWithin?: string; // '1d', '3d', '1w', '1m'
}

interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: {
    min: number;
    max: number;
    currency: string;
  };
  remote: boolean;
  employmentType: string;
  description: string;
  skills: string[];
  postedDate: string;
}

interface SearchState {
  filters: SearchFilters;
  results: JobResult[];
  loading: boolean;
  error: string | null;
  totalResults: number;
  searchTime: number;
}

class AdvancedSearchComponent {
  private state: SearchState = {
    filters: {},
    results: [],
    loading: false,
    error: null,
    totalResults: 0,
    searchTime: 0,
  };

  private debounceTimeout: NodeJS.Timeout | null = null;
  private onSearchCallback: ((filters: SearchFilters) => void) | null = null;

  constructor(private container: HTMLElement) {
    this.init();
  }

  private init(): void {
    this.renderSearchInterface();
    this.setupEventListeners();
  }

  public onSearch(callback: (filters: SearchFilters) => void): void {
    this.onSearchCallback = callback;
  }

  public updateResults(results: JobResult[], totalResults: number, searchTime: number): void {
    this.state.results = results;
    this.state.totalResults = totalResults;
    this.state.searchTime = searchTime;
    this.state.loading = false;
    this.state.error = null;

    this.renderResults();
    this.renderSearchStats();
  }

  public setLoading(loading: boolean): void {
    this.state.loading = loading;
    if (loading) {
      this.renderLoadingState();
    }
  }

  public setError(error: string): void {
    this.state.error = error;
    this.state.loading = false;
    this.renderError();
  }

  private renderSearchInterface(): void {
    this.container.innerHTML = `
      <div class="advanced-search-container">
        <!-- Search Header -->
        <div class="search-header">
          <h2>🔍 Advanced Job Search</h2>
          <p class="search-subtitle">Find your perfect job with powerful filtering and real-time results</p>
        </div>

        <!-- Main Search Input -->
        <div class="search-main">
          <div class="search-input-group">
            <input 
              type="text" 
              id="mainSearchInput" 
              class="search-input-main" 
              placeholder="Search jobs, companies, or skills..."
              autocomplete="off"
            >
            <button id="searchButton" class="btn-search">
              <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              Search
            </button>
          </div>
        </div>

        <!-- Advanced Filters -->
        <div class="filters-container" id="filtersContainer">
          <div class="filters-toggle">
            <button id="toggleFilters" class="btn-toggle-filters">
              <svg class="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              Advanced Filters
            </button>
            <span class="active-filters-count" id="activeFiltersCount" style="display: none;">0 active</span>
          </div>

          <div class="filters-panel" id="filtersPanel" style="display: none;">
            <div class="filters-grid">
              <!-- Location Filter -->
              <div class="filter-group">
                <label for="locationFilter">📍 Location</label>
                <select id="locationFilter" class="filter-select">
                  <option value="">All Locations</option>
                  <option value="remote">Remote</option>
                  <option value="san francisco">San Francisco, CA</option>
                  <option value="new york">New York, NY</option>
                  <option value="seattle">Seattle, WA</option>
                  <option value="austin">Austin, TX</option>
                  <option value="boston">Boston, MA</option>
                  <option value="los angeles">Los Angeles, CA</option>
                </select>
              </div>

              <!-- Company Filter -->
              <div class="filter-group">
                <label for="companyFilter">🏢 Company</label>
                <input type="text" id="companyFilter" class="filter-input" placeholder="Company name...">
              </div>

              <!-- Employment Type -->
              <div class="filter-group">
                <label for="employmentTypeFilter">⏰ Employment Type</label>
                <select id="employmentTypeFilter" class="filter-select">
                  <option value="">All Types</option>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="freelance">Freelance</option>
                  <option value="internship">Internship</option>
                </select>
              </div>

              <!-- Salary Range -->
              <div class="filter-group salary-range">
                <label>💰 Salary Range</label>
                <div class="salary-inputs">
                  <input type="number" id="minSalary" class="filter-input salary-input" placeholder="Min" step="5000">
                  <span class="salary-separator">to</span>
                  <input type="number" id="maxSalary" class="filter-input salary-input" placeholder="Max" step="5000">
                </div>
              </div>

              <!-- Remote Work -->
              <div class="filter-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="remoteFilter" class="filter-checkbox">
                  <span class="checkbox-custom"></span>
                  🌐 Remote Work Only
                </label>
              </div>

              <!-- Posted Date -->
              <div class="filter-group">
                <label for="postedWithinFilter">📅 Posted Within</label>
                <select id="postedWithinFilter" class="filter-select">
                  <option value="">Any time</option>
                  <option value="1d">Past 24 hours</option>
                  <option value="3d">Past 3 days</option>
                  <option value="1w">Past week</option>
                  <option value="1m">Past month</option>
                </select>
              </div>
            </div>

            <div class="filters-actions">
              <button id="clearFilters" class="btn-clear">Clear All</button>
              <button id="applyFilters" class="btn-apply">Apply Filters</button>
            </div>
          </div>
        </div>

        <!-- Active Filter Tags -->
        <div class="active-filters" id="activeFilters"></div>

        <!-- Search Stats -->
        <div class="search-stats" id="searchStats" style="display: none;"></div>

        <!-- Results Container -->
        <div class="search-results" id="searchResults">
          <div class="no-results-state">
            <div class="no-results-icon">🔍</div>
            <h3>Ready to search</h3>
            <p>Enter your search criteria to find amazing job opportunities</p>
          </div>
        </div>
      </div>
    `;
  }

  private setupEventListeners(): void {
    // Main search input
    const mainInput = document.getElementById('mainSearchInput') as HTMLInputElement;
    mainInput?.addEventListener('input', () => this.debounceSearch());
    mainInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.performSearch();
    });

    // Search button
    document.getElementById('searchButton')?.addEventListener('click', () => this.performSearch());

    // Toggle filters
    document.getElementById('toggleFilters')?.addEventListener('click', () => this.toggleFilters());

    // Filter inputs
    const filterInputs = [
      'locationFilter',
      'companyFilter',
      'employmentTypeFilter',
      'minSalary',
      'maxSalary',
      'remoteFilter',
      'postedWithinFilter',
    ];

    filterInputs.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', () => {
          this.updateActiveFilters();
          this.debounceSearch();
        });
      }
    });

    // Filter actions
    document
      .getElementById('clearFilters')
      ?.addEventListener('click', () => this.clearAllFilters());
    document.getElementById('applyFilters')?.addEventListener('click', () => this.performSearch());
  }

  private debounceSearch(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(() => {
      this.performSearch();
    }, 300);
  }

  private performSearch(): void {
    this.collectFilters();
    this.setLoading(true);

    if (this.onSearchCallback) {
      this.onSearchCallback(this.state.filters);
    }
  }

  private collectFilters(): void {
    const mainInput = document.getElementById('mainSearchInput') as HTMLInputElement;
    const locationFilter = document.getElementById('locationFilter') as HTMLSelectElement;
    const companyFilter = document.getElementById('companyFilter') as HTMLInputElement;
    const employmentTypeFilter = document.getElementById(
      'employmentTypeFilter',
    ) as HTMLSelectElement;
    const minSalaryInput = document.getElementById('minSalary') as HTMLInputElement;
    const maxSalaryInput = document.getElementById('maxSalary') as HTMLInputElement;
    const remoteFilter = document.getElementById('remoteFilter') as HTMLInputElement;
    const postedWithinFilter = document.getElementById('postedWithinFilter') as HTMLSelectElement;

    const filters: SearchFilters = {};

    const queryValue = mainInput?.value?.trim();
    if (queryValue) filters.query = queryValue;

    const locationValue = locationFilter?.value;
    if (locationValue) filters.location = locationValue;

    const companyValue = companyFilter?.value?.trim();
    if (companyValue) filters.company = companyValue;

    const employmentTypeValue = employmentTypeFilter?.value;
    if (employmentTypeValue) filters.employmentType = employmentTypeValue;

    if (remoteFilter?.checked) filters.remote = true;

    const postedWithinValue = postedWithinFilter?.value;
    if (postedWithinValue) filters.postedWithin = postedWithinValue;

    if (minSalaryInput?.value) {
      filters.minSalary = Number.parseInt(minSalaryInput.value);
    }

    if (maxSalaryInput?.value) {
      filters.maxSalary = Number.parseInt(maxSalaryInput.value);
    }

    this.state.filters = filters;
  }

  private toggleFilters(): void {
    const filtersPanel = document.getElementById('filtersPanel');
    const toggleButton = document.getElementById('toggleFilters');

    if (filtersPanel && toggleButton) {
      const isVisible = filtersPanel.style.display !== 'none';
      filtersPanel.style.display = isVisible ? 'none' : 'block';
      toggleButton.textContent = isVisible ? '🔽 Show Filters' : '🔼 Hide Filters';
    }
  }

  private updateActiveFilters(): void {
    this.collectFilters();
    const activeFiltersContainer = document.getElementById('activeFilters');
    const activeFiltersCount = document.getElementById('activeFiltersCount');

    if (!activeFiltersContainer || !activeFiltersCount) return;

    const activeFilters: string[] = [];

    Object.entries(this.state.filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== false) {
        let filterText = '';
        switch (key) {
          case 'query':
            filterText = `Search: "${value}"`;
            break;
          case 'location':
            filterText = `Location: ${value}`;
            break;
          case 'company':
            filterText = `Company: ${value}`;
            break;
          case 'employmentType':
            filterText = `Type: ${value}`;
            break;
          case 'minSalary':
            filterText = `Min Salary: $${(value as number).toLocaleString()}`;
            break;
          case 'maxSalary':
            filterText = `Max Salary: $${(value as number).toLocaleString()}`;
            break;
          case 'remote':
            filterText = 'Remote Only';
            break;
          case 'postedWithin':
            filterText = `Posted: ${value}`;
            break;
        }
        if (filterText) activeFilters.push(filterText);
      }
    });

    // Update active filters display
    if (activeFilters.length > 0) {
      activeFiltersContainer.innerHTML = activeFilters
        .map((filter) => `<span class="filter-tag">${filter}</span>`)
        .join('');
      activeFiltersCount.textContent = `${activeFilters.length} active`;
      activeFiltersCount.style.display = 'inline';
    } else {
      activeFiltersContainer.innerHTML = '';
      activeFiltersCount.style.display = 'none';
    }
  }

  private clearAllFilters(): void {
    // Clear all filter inputs
    (document.getElementById('mainSearchInput') as HTMLInputElement).value = '';
    (document.getElementById('locationFilter') as HTMLSelectElement).selectedIndex = 0;
    (document.getElementById('companyFilter') as HTMLInputElement).value = '';
    (document.getElementById('employmentTypeFilter') as HTMLSelectElement).selectedIndex = 0;
    (document.getElementById('minSalary') as HTMLInputElement).value = '';
    (document.getElementById('maxSalary') as HTMLInputElement).value = '';
    (document.getElementById('remoteFilter') as HTMLInputElement).checked = false;
    (document.getElementById('postedWithinFilter') as HTMLSelectElement).selectedIndex = 0;

    this.state.filters = {};
    this.updateActiveFilters();
    this.performSearch();
  }

  private renderResults(): void {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;

    if (this.state.results.length === 0) {
      resultsContainer.innerHTML = `
        <div class="no-results-state">
          <div class="no-results-icon">😔</div>
          <h3>No jobs found</h3>
          <p>Try adjusting your search criteria or filters</p>
        </div>
      `;
      return;
    }

    const resultsHtml = this.state.results
      .map(
        (job) => `
      <div class="job-result-card" data-job-id="${job.id}">
        <div class="job-header">
          <h3 class="job-title">${job.title}</h3>
          <div class="job-company">
            <span class="company-name">${job.company}</span>
            ${job.remote ? '<span class="remote-badge">Remote</span>' : ''}
          </div>
        </div>
        
        <div class="job-details">
          <div class="job-location">📍 ${job.location}</div>
          ${
            job.salary
              ? `
            <div class="job-salary">
              💰 $${job.salary.min.toLocaleString()} - $${job.salary.max.toLocaleString()}
            </div>
          `
              : ''
          }
          <div class="job-type">⏰ ${job.employmentType}</div>
          <div class="job-posted">📅 ${this.formatDate(job.postedDate)}</div>
        </div>
        
        <div class="job-description">
          ${job.description}
        </div>
        
        <div class="job-skills">
          ${job.skills.map((skill) => `<span class="skill-tag">${skill}</span>`).join('')}
        </div>
        
        <div class="job-actions">
          <button class="btn-view-job" data-job-id="${job.id}">View Details</button>
          <button class="btn-save-job" data-job-id="${job.id}">Save Job</button>
        </div>
      </div>
    `,
      )
      .join('');

    resultsContainer.innerHTML = resultsHtml;

    // Add event listeners to job cards
    this.setupJobCardListeners();
  }

  private renderSearchStats(): void {
    const searchStatsContainer = document.getElementById('searchStats');
    if (!searchStatsContainer) return;

    if (this.state.totalResults > 0) {
      searchStatsContainer.innerHTML = `
        <div class="stats-summary">
          <span class="results-count">${this.state.totalResults.toLocaleString()} jobs found</span>
          <span class="search-time">in ${this.state.searchTime}ms</span>
        </div>
      `;
      searchStatsContainer.style.display = 'block';
    } else {
      searchStatsContainer.style.display = 'none';
    }
  }

  private renderLoadingState(): void {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <h3>Searching jobs...</h3>
        <p>Please wait while we find the perfect opportunities for you</p>
      </div>
    `;
  }

  private renderError(): void {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Search Error</h3>
        <p>${this.state.error}</p>
        <button class="btn-retry" onclick="this.performSearch()">Try Again</button>
      </div>
    `;
  }

  private setupJobCardListeners(): void {
    // View job details
    document.querySelectorAll('.btn-view-job').forEach((button) => {
      button.addEventListener('click', (e) => {
        const jobId = (e.target as HTMLElement).dataset.jobId;
        if (jobId) {
          this.viewJobDetails(jobId);
        }
      });
    });

    // Save job
    document.querySelectorAll('.btn-save-job').forEach((button) => {
      button.addEventListener('click', (e) => {
        const jobId = (e.target as HTMLElement).dataset.jobId;
        if (jobId) {
          this.saveJob(jobId);
        }
      });
    });
  }

  private viewJobDetails(jobId: string): void {
    const job = this.state.results.find((j) => j.id === jobId);
    if (job) {
      // For now, just log the job details
    }
  }

  private saveJob(jobId: string): void {
    // Show feedback to user
    const button = document.querySelector(`[data-job-id="${jobId}"].btn-save-job`) as HTMLElement;
    if (button) {
      const originalText = button.textContent;
      button.textContent = 'Saved!';
      button.style.background = '#4caf50';

      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '';
      }, 2000);
    }
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just posted';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 48) return 'Yesterday';
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)} days ago`;
    return date.toLocaleDateString();
  }
}

// Export for use in the main dashboard
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AdvancedSearchComponent };
}
