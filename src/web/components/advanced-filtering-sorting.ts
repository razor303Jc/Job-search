/**
 * Advanced Filtering & Sorting UI Component
 * Phase 7 Stage 5: Enhanced Web Interface & Real-Time Features
 */

// Advanced Filtering Types
interface FilterOperator {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'array';
  operators: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
}

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: any;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'array';
  enabled: boolean;
}

interface FilterGroup {
  id: string;
  name: string;
  conditions: FilterCondition[];
  logic: 'AND' | 'OR';
  enabled: boolean;
}

interface FilterPreset {
  id: string;
  name: string;
  description: string;
  groups: FilterGroup[];
  quickAccess: boolean;
  createdAt: string;
  lastUsed?: string;
  useCount: number;
}

interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
  priority: number;
  dataType: 'string' | 'number' | 'date';
}

interface FilterState {
  groups: FilterGroup[];
  presets: FilterPreset[];
  currentPreset?: string | undefined;
  sortOptions: SortOption[];
  quickFilters: Record<string, boolean>;
  searchQuery: string;
  globalSearch: string;
  totalResults: number;
  filteredResults: number;
  isProcessing: boolean;
}

// Field Configuration
interface FilterableField {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
  dataType: 'string' | 'number' | 'date';
  options?: Array<{ value: any; label: string; count?: number }>;
  description?: string;
  searchable: boolean;
  sortable: boolean;
  aggregatable: boolean;
}

interface AdvancedFilteringConfig {
  apiEndpoint?: string;
  websocketUrl?: string;
  onFilterChange?: (filters: any) => void;
  enableWebSocket?: boolean;
  debounceMs?: number;
  maxFilterGroups?: number;
  maxConditionsPerGroup?: number;
}

class AdvancedFilteringSortingComponent {
  private container: HTMLElement;
  private ws: WebSocket | null = null;
  private state!: FilterState;
  private fields!: FilterableField[];
  private operators!: Record<string, FilterOperator>;
  private debounceTimeout: number | null = null;
  private config: AdvancedFilteringConfig;

  constructor(container?: HTMLElement, config: AdvancedFilteringConfig = {}) {
    this.container =
      container || (document.getElementById('advanced-filtering-container') as HTMLElement);
    this.config = config;
    this.initializeState();
    this.initializeOperators();
    this.initializeFields();
    this.initializeEventListeners();
    this.loadPresets();
    this.render();
  }

  /**
   * Set WebSocket connection for real-time updates
   */
  setWebSocket(ws: WebSocket): void {
    this.ws = ws;

    if (this.ws) {
      this.ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });
    }
  }

  /**
   * Handle WebSocket messages for real-time filter updates
   */
  private handleWebSocketMessage(data: any): void {
    switch (data.type) {
      case 'filter_results_update':
        this.updateFilterResults(data.results, data.totalCount);
        break;
      case 'field_options_update':
        this.updateFieldOptions(data.field, data.options);
        break;
      case 'filter_preset_shared':
        this.addSharedPreset(data.preset);
        break;
      case 'filter_performance_metrics':
        this.updatePerformanceMetrics(data.metrics);
        break;
    }
  }

  /**
   * Initialize component state
   */
  private initializeState(): void {
    this.state = {
      groups: [this.createDefaultFilterGroup()],
      presets: [],
      sortOptions: [{ field: 'scraped_at', direction: 'desc', priority: 1, dataType: 'date' }],
      quickFilters: {},
      searchQuery: '',
      globalSearch: '',
      totalResults: 0,
      filteredResults: 0,
      isProcessing: false,
    };
  }

  /**
   * Initialize filter operators
   */
  private initializeOperators(): void {
    this.operators = {
      text: {
        id: 'text',
        name: 'Text',
        type: 'text',
        operators: [
          {
            value: 'contains',
            label: 'Contains',
            description: 'Field contains the specified text',
          },
          {
            value: 'not_contains',
            label: 'Does not contain',
            description: 'Field does not contain the specified text',
          },
          {
            value: 'equals',
            label: 'Equals',
            description: 'Field equals exactly the specified text',
          },
          {
            value: 'not_equals',
            label: 'Does not equal',
            description: 'Field does not equal the specified text',
          },
          {
            value: 'starts_with',
            label: 'Starts with',
            description: 'Field starts with the specified text',
          },
          {
            value: 'ends_with',
            label: 'Ends with',
            description: 'Field ends with the specified text',
          },
          {
            value: 'regex',
            label: 'Matches regex',
            description: 'Field matches the regular expression',
          },
          { value: 'is_empty', label: 'Is empty', description: 'Field is empty or null' },
          { value: 'is_not_empty', label: 'Is not empty', description: 'Field has a value' },
        ],
      },
      number: {
        id: 'number',
        name: 'Number',
        type: 'number',
        operators: [
          { value: 'equals', label: 'Equals', description: 'Field equals the specified number' },
          {
            value: 'not_equals',
            label: 'Does not equal',
            description: 'Field does not equal the specified number',
          },
          {
            value: 'greater_than',
            label: 'Greater than',
            description: 'Field is greater than the specified number',
          },
          {
            value: 'greater_than_or_equal',
            label: 'Greater than or equal',
            description: 'Field is greater than or equal to the specified number',
          },
          {
            value: 'less_than',
            label: 'Less than',
            description: 'Field is less than the specified number',
          },
          {
            value: 'less_than_or_equal',
            label: 'Less than or equal',
            description: 'Field is less than or equal to the specified number',
          },
          {
            value: 'between',
            label: 'Between',
            description: 'Field is between two specified numbers',
          },
          {
            value: 'not_between',
            label: 'Not between',
            description: 'Field is not between two specified numbers',
          },
          { value: 'is_null', label: 'Is null', description: 'Field is null or undefined' },
          { value: 'is_not_null', label: 'Is not null', description: 'Field has a numeric value' },
        ],
      },
      date: {
        id: 'date',
        name: 'Date',
        type: 'date',
        operators: [
          { value: 'equals', label: 'On date', description: 'Field is on the specified date' },
          {
            value: 'not_equals',
            label: 'Not on date',
            description: 'Field is not on the specified date',
          },
          { value: 'after', label: 'After', description: 'Field is after the specified date' },
          {
            value: 'on_or_after',
            label: 'On or after',
            description: 'Field is on or after the specified date',
          },
          { value: 'before', label: 'Before', description: 'Field is before the specified date' },
          {
            value: 'on_or_before',
            label: 'On or before',
            description: 'Field is on or before the specified date',
          },
          {
            value: 'between',
            label: 'Between dates',
            description: 'Field is between two specified dates',
          },
          {
            value: 'in_last_days',
            label: 'In last X days',
            description: 'Field is within the last X days',
          },
          {
            value: 'in_next_days',
            label: 'In next X days',
            description: 'Field is within the next X days',
          },
          { value: 'today', label: 'Today', description: 'Field is today' },
          { value: 'yesterday', label: 'Yesterday', description: 'Field is yesterday' },
          { value: 'this_week', label: 'This week', description: 'Field is in the current week' },
          { value: 'last_week', label: 'Last week', description: 'Field is in the previous week' },
          {
            value: 'this_month',
            label: 'This month',
            description: 'Field is in the current month',
          },
          {
            value: 'last_month',
            label: 'Last month',
            description: 'Field is in the previous month',
          },
        ],
      },
      boolean: {
        id: 'boolean',
        name: 'Boolean',
        type: 'boolean',
        operators: [
          { value: 'is_true', label: 'Is true', description: 'Field is true' },
          { value: 'is_false', label: 'Is false', description: 'Field is false' },
          { value: 'is_null', label: 'Is null', description: 'Field is null or undefined' },
        ],
      },
      array: {
        id: 'array',
        name: 'Array/List',
        type: 'array',
        operators: [
          {
            value: 'contains',
            label: 'Contains',
            description: 'Array contains the specified value',
          },
          {
            value: 'not_contains',
            label: 'Does not contain',
            description: 'Array does not contain the specified value',
          },
          {
            value: 'contains_all',
            label: 'Contains all',
            description: 'Array contains all specified values',
          },
          {
            value: 'contains_any',
            label: 'Contains any',
            description: 'Array contains any of the specified values',
          },
          { value: 'is_empty', label: 'Is empty', description: 'Array is empty' },
          { value: 'is_not_empty', label: 'Is not empty', description: 'Array has values' },
          {
            value: 'length_equals',
            label: 'Length equals',
            description: 'Array length equals the specified number',
          },
          {
            value: 'length_greater_than',
            label: 'Length greater than',
            description: 'Array length is greater than the specified number',
          },
          {
            value: 'length_less_than',
            label: 'Length less than',
            description: 'Array length is less than the specified number',
          },
        ],
      },
    };
  }

  /**
   * Initialize filterable fields configuration
   */
  private initializeFields(): void {
    this.fields = [
      {
        id: 'title',
        key: 'title',
        label: 'Job Title',
        type: 'text',
        dataType: 'string',
        description: 'The job title or position name',
        searchable: true,
        sortable: true,
        aggregatable: false,
      },
      {
        id: 'company',
        key: 'company',
        label: 'Company',
        type: 'text',
        dataType: 'string',
        description: 'The hiring company name',
        searchable: true,
        sortable: true,
        aggregatable: true,
      },
      {
        id: 'location',
        key: 'location',
        label: 'Location',
        type: 'text',
        dataType: 'string',
        description: 'Job location or "Remote"',
        searchable: true,
        sortable: true,
        aggregatable: true,
      },
      {
        id: 'salary_min',
        key: 'salary_min',
        label: 'Minimum Salary',
        type: 'number',
        dataType: 'number',
        description: 'Minimum salary amount',
        searchable: false,
        sortable: true,
        aggregatable: true,
      },
      {
        id: 'salary_max',
        key: 'salary_max',
        label: 'Maximum Salary',
        type: 'number',
        dataType: 'number',
        description: 'Maximum salary amount',
        searchable: false,
        sortable: true,
        aggregatable: true,
      },
      {
        id: 'employment_type',
        key: 'employment_type',
        label: 'Employment Type',
        type: 'select',
        dataType: 'string',
        options: [
          { value: 'full-time', label: 'Full-time' },
          { value: 'part-time', label: 'Part-time' },
          { value: 'contract', label: 'Contract' },
          { value: 'temporary', label: 'Temporary' },
          { value: 'internship', label: 'Internship' },
        ],
        description: 'Type of employment',
        searchable: false,
        sortable: true,
        aggregatable: true,
      },
      {
        id: 'is_remote',
        key: 'is_remote',
        label: 'Remote Work',
        type: 'boolean',
        dataType: 'string',
        description: 'Whether the job allows remote work',
        searchable: false,
        sortable: true,
        aggregatable: true,
      },
      {
        id: 'scraped_at',
        key: 'scraped_at',
        label: 'Date Scraped',
        type: 'date',
        dataType: 'date',
        description: 'When the job was first discovered',
        searchable: false,
        sortable: true,
        aggregatable: false,
      },
      {
        id: 'posted_date',
        key: 'posted_date',
        label: 'Date Posted',
        type: 'date',
        dataType: 'date',
        description: 'When the job was posted by the company',
        searchable: false,
        sortable: true,
        aggregatable: false,
      },
      {
        id: 'requirements',
        key: 'requirements',
        label: 'Requirements',
        type: 'text',
        dataType: 'string',
        description: 'Job requirements and qualifications',
        searchable: true,
        sortable: false,
        aggregatable: false,
      },
      {
        id: 'skills',
        key: 'skills',
        label: 'Skills',
        type: 'multiselect',
        dataType: 'string',
        description: 'Required or preferred skills',
        searchable: true,
        sortable: false,
        aggregatable: true,
      },
      {
        id: 'experience_level',
        key: 'experience_level',
        label: 'Experience Level',
        type: 'select',
        dataType: 'string',
        options: [
          { value: 'entry', label: 'Entry Level' },
          { value: 'mid', label: 'Mid Level' },
          { value: 'senior', label: 'Senior Level' },
          { value: 'lead', label: 'Lead/Principal' },
          { value: 'executive', label: 'Executive' },
        ],
        description: 'Required experience level',
        searchable: false,
        sortable: true,
        aggregatable: true,
      },
    ];
  }

  /**
   * Initialize event listeners
   */
  private initializeEventListeners(): void {
    if (!this.container) return;

    // Global search input
    const searchInput = document.getElementById('global-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleGlobalSearch((e.target as HTMLInputElement).value);
      });
    }

    // Quick filter toggles
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (target.classList.contains('quick-filter-toggle')) {
        this.handleQuickFilterToggle(target);
      } else if (target.classList.contains('filter-preset-item')) {
        this.handlePresetSelection(target);
      } else if (target.classList.contains('add-filter-condition')) {
        this.handleAddFilterCondition(target);
      } else if (target.classList.contains('remove-filter-condition')) {
        this.handleRemoveFilterCondition(target);
      } else if (target.classList.contains('add-filter-group')) {
        this.handleAddFilterGroup();
      } else if (target.classList.contains('remove-filter-group')) {
        this.handleRemoveFilterGroup(target);
      } else if (target.classList.contains('save-filter-preset')) {
        this.handleSavePreset();
      } else if (target.classList.contains('apply-filters')) {
        this.applyFilters();
      } else if (target.classList.contains('clear-filters')) {
        this.clearAllFilters();
      } else if (target.classList.contains('sort-option-add')) {
        this.handleAddSortOption();
      } else if (target.classList.contains('sort-option-remove')) {
        this.handleRemoveSortOption(target);
      }
    });

    // Filter condition changes
    document.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;

      if (target.classList.contains('filter-field-select')) {
        this.handleFieldChange(target);
      } else if (target.classList.contains('filter-operator-select')) {
        this.handleOperatorChange(target);
      } else if (target.classList.contains('filter-value-input')) {
        this.handleValueChange(target);
      } else if (target.classList.contains('filter-condition-enabled')) {
        this.handleConditionToggle(target);
      } else if (target.classList.contains('filter-group-logic')) {
        this.handleGroupLogicChange(target);
      } else if (target.classList.contains('sort-field-select')) {
        this.handleSortFieldChange(target);
      } else if (target.classList.contains('sort-direction-select')) {
        this.handleSortDirectionChange(target);
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'f':
            e.preventDefault();
            this.focusGlobalSearch();
            break;
          case 'Enter':
            if (e.shiftKey) {
              e.preventDefault();
              this.applyFilters();
            }
            break;
          case 'Escape':
            this.clearAllFilters();
            break;
        }
      }
    });
  }

  /**
   * Load saved filter presets
   */
  private async loadPresets(): Promise<void> {
    try {
      const apiEndpoint = this.config.apiEndpoint || '/api/v1';
      const response = await fetch(`${apiEndpoint}/filters/presets`);
      if (response.ok) {
        const { presets } = await response.json();
        this.state.presets = presets || [];
        this.renderPresets();
      }
    } catch (error) {
      console.error('Failed to load filter presets:', error);
    }
  }

  /**
   * Create default filter group
   */
  private createDefaultFilterGroup(): FilterGroup {
    return {
      id: this.generateId(),
      name: 'Filter Group 1',
      conditions: [this.createDefaultCondition()],
      logic: 'AND',
      enabled: true,
    };
  }

  /**
   * Create default filter condition
   */
  private createDefaultCondition(): FilterCondition {
    return {
      id: this.generateId(),
      field: 'title',
      operator: 'contains',
      value: '',
      dataType: 'string',
      enabled: true,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `filter_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Main render method
   */
  private render(): void {
    if (!this.container) return;

    const html = `
      <div class="advanced-filtering-wrapper">
        ${this.renderHeader()}
        ${this.renderQuickFilters()}
        ${this.renderFilterBuilder()}
        ${this.renderSortingOptions()}
        ${this.renderPresetsPanel()}
        ${this.renderResultsInfo()}
        ${this.renderActions()}
      </div>
    `;

    // Use safe DOM manipulation
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    while (wrapper.firstChild) {
      this.container.appendChild(wrapper.firstChild);
    }

    this.attachAdvancedEventListeners();
  }

  /**
   * Render header section
   */
  private renderHeader(): string {
    return `
      <div class="filtering-header">
        <div class="header-main">
          <h3>Advanced Filtering & Sorting</h3>
          <div class="header-stats">
            <span class="results-count">
              ${this.state.filteredResults.toLocaleString()} of ${this.state.totalResults.toLocaleString()} jobs
            </span>
            ${this.state.isProcessing ? '<span class="processing-indicator">Processing...</span>' : ''}
          </div>
        </div>
        
        <div class="global-search-container">
          <input 
            type="text" 
            id="global-search" 
            class="global-search-input" 
            placeholder="Search across all fields... (Ctrl+F)"
            value="${this.escapeHtml(this.state.searchQuery)}"
          />
          <button type="button" class="search-clear-btn" ${!this.state.searchQuery ? 'style="display: none;"' : ''}>
            ×
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render quick filters section
   */
  private renderQuickFilters(): string {
    const quickFilters = [
      { key: 'is_remote', label: 'Remote Only', icon: '🏠' },
      { key: 'posted_today', label: 'Posted Today', icon: '📅' },
      { key: 'high_salary', label: 'High Salary (>$100k)', icon: '💰' },
      { key: 'full_time', label: 'Full-time', icon: '⏰' },
      { key: 'no_experience', label: 'Entry Level', icon: '🌱' },
      { key: 'tech_jobs', label: 'Tech Roles', icon: '💻' },
    ];

    return `
      <div class="quick-filters-section">
        <h4>Quick Filters</h4>
        <div class="quick-filters-grid">
          ${quickFilters
            .map(
              (filter) => `
            <button 
              type="button" 
              class="quick-filter-toggle ${this.state.quickFilters[filter.key] ? 'active' : ''}"
              data-filter-key="${filter.key}"
            >
              <span class="filter-icon">${filter.icon}</span>
              <span class="filter-label">${filter.label}</span>
            </button>
          `,
            )
            .join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render filter builder section
   */
  private renderFilterBuilder(): string {
    return `
      <div class="filter-builder-section">
        <div class="section-header">
          <h4>Advanced Filters</h4>
          <button type="button" class="add-filter-group">
            Add Filter Group
          </button>
        </div>
        
        <div class="filter-groups-container">
          ${this.state.groups.map((group, groupIndex) => this.renderFilterGroup(group, groupIndex)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render individual filter group
   */
  private renderFilterGroup(group: FilterGroup, groupIndex: number): string {
    return `
      <div class="filter-group" data-group-id="${group.id}">
        <div class="filter-group-header">
          <div class="group-controls">
            <input 
              type="checkbox" 
              class="filter-group-enabled" 
              ${group.enabled ? 'checked' : ''}
            />
            <input 
              type="text" 
              class="filter-group-name" 
              value="${this.escapeHtml(group.name)}"
              placeholder="Filter group name"
            />
          </div>
          
          <div class="group-logic-controls">
            <select class="filter-group-logic">
              <option value="AND" ${group.logic === 'AND' ? 'selected' : ''}>AND (all conditions)</option>
              <option value="OR" ${group.logic === 'OR' ? 'selected' : ''}>OR (any condition)</option>
            </select>
            
            ${
              groupIndex > 0
                ? `
              <button type="button" class="remove-filter-group" data-group-id="${group.id}">
                Remove Group
              </button>
            `
                : ''
            }
          </div>
        </div>
        
        <div class="filter-conditions">
          ${group.conditions
            .map((condition, conditionIndex) =>
              this.renderFilterCondition(condition, conditionIndex, group.id),
            )
            .join('')}
        </div>
        
        <button type="button" class="add-filter-condition" data-group-id="${group.id}">
          Add Condition
        </button>
      </div>
    `;
  }

  /**
   * Render individual filter condition
   */
  private renderFilterCondition(
    condition: FilterCondition,
    conditionIndex: number,
    groupId: string,
  ): string {
    const field = this.fields.find((f) => f.key === condition.field);
    const operatorType = field ? this.getOperatorTypeForField(field) : 'text';
    const operators = this.operators[operatorType]?.operators || [];

    return `
      <div class="filter-condition" data-condition-id="${condition.id}">
        <div class="condition-controls">
          <input 
            type="checkbox" 
            class="filter-condition-enabled" 
            ${condition.enabled ? 'checked' : ''}
          />
          
          <select class="filter-field-select">
            ${this.fields
              .map(
                (field) => `
              <option value="${field.key}" ${condition.field === field.key ? 'selected' : ''}>
                ${field.label}
              </option>
            `,
              )
              .join('')}
          </select>
          
          <select class="filter-operator-select">
            ${operators
              .map(
                (op) => `
              <option value="${op.value}" ${condition.operator === op.value ? 'selected' : ''}>
                ${op.label}
              </option>
            `,
              )
              .join('')}
          </select>
          
          ${this.renderValueInput(condition, field)}
          
          <button 
            type="button" 
            class="remove-filter-condition" 
            data-condition-id="${condition.id}"
            data-group-id="${groupId}"
            ${conditionIndex === 0 && this.state.groups.find((g) => g.id === groupId)?.conditions.length === 1 ? 'disabled' : ''}
          >
            ×
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render value input based on field type and operator
   */
  private renderValueInput(condition: FilterCondition, field?: FilterableField): string {
    if (!field) return '<input type="text" class="filter-value-input" placeholder="Value" />';

    const operator = condition.operator;
    const needsValue = ![
      'is_empty',
      'is_not_empty',
      'is_null',
      'is_not_null',
      'today',
      'yesterday',
      'this_week',
      'last_week',
      'this_month',
      'last_month',
    ].includes(operator);

    if (!needsValue) {
      return '<span class="no-value-needed">No value needed</span>';
    }

    switch (field.type) {
      case 'select':
        return `
          <select class="filter-value-input">
            <option value="">Select value...</option>
            ${
              field.options
                ?.map(
                  (option) => `
              <option value="${option.value}" ${condition.value === option.value ? 'selected' : ''}>
                ${option.label}${option.count ? ` (${option.count})` : ''}
              </option>
            `,
                )
                .join('') || ''
            }
          </select>
        `;

      case 'multiselect':
        return `
          <div class="multiselect-container">
            <input 
              type="text" 
              class="filter-value-input multiselect-input" 
              placeholder="Type to search options..."
              value="${Array.isArray(condition.value) ? condition.value.join(', ') : condition.value || ''}"
            />
            <div class="multiselect-dropdown" style="display: none;">
              ${
                field.options
                  ?.map(
                    (option) => `
                <label class="multiselect-option">
                  <input 
                    type="checkbox" 
                    value="${option.value}"
                    ${Array.isArray(condition.value) && condition.value.includes(option.value) ? 'checked' : ''}
                  />
                  ${option.label}${option.count ? ` (${option.count})` : ''}
                </label>
              `,
                  )
                  .join('') || ''
              }
            </div>
          </div>
        `;

      case 'number':
        if (operator === 'between' || operator === 'not_between') {
          const values = Array.isArray(condition.value) ? condition.value : [condition.value, ''];
          return `
            <div class="range-inputs">
              <input 
                type="number" 
                class="filter-value-input range-min" 
                placeholder="Min"
                value="${values[0] || ''}"
              />
              <span class="range-separator">to</span>
              <input 
                type="number" 
                class="filter-value-input range-max" 
                placeholder="Max"
                value="${values[1] || ''}"
              />
            </div>
          `;
        }
        return `
          <input 
            type="number" 
            class="filter-value-input" 
            placeholder="Enter number"
            value="${condition.value || ''}"
          />
        `;

      case 'date':
        if (operator === 'between') {
          const values = Array.isArray(condition.value) ? condition.value : [condition.value, ''];
          return `
            <div class="range-inputs">
              <input 
                type="date" 
                class="filter-value-input range-min" 
                value="${values[0] || ''}"
              />
              <span class="range-separator">to</span>
              <input 
                type="date" 
                class="filter-value-input range-max" 
                value="${values[1] || ''}"
              />
            </div>
          `;
        }
        if (operator.includes('_days')) {
          return `
            <input 
              type="number" 
              class="filter-value-input" 
              placeholder="Number of days"
              value="${condition.value || ''}"
              min="1"
            />
          `;
        }
        return `
          <input 
            type="date" 
            class="filter-value-input" 
            value="${condition.value || ''}"
          />
        `;

      case 'boolean':
        return '<span class="boolean-operator">No value needed</span>';

      default:
        return `
          <input 
            type="text" 
            class="filter-value-input" 
            placeholder="Enter value"
            value="${condition.value || ''}"
          />
        `;
    }
  }

  /**
   * Render sorting options section
   */
  private renderSortingOptions(): string {
    return `
      <div class="sorting-section">
        <div class="section-header">
          <h4>Sorting Options</h4>
          <button type="button" class="sort-option-add">
            Add Sort Field
          </button>
        </div>
        
        <div class="sort-options-container">
          ${this.state.sortOptions.map((option, index) => this.renderSortOption(option, index)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render individual sort option
   */
  private renderSortOption(option: SortOption, index: number): string {
    const sortableFields = this.fields.filter((field) => field.sortable);

    return `
      <div class="sort-option" data-sort-index="${index}">
        <span class="sort-priority">${option.priority}</span>
        
        <select class="sort-field-select">
          ${sortableFields
            .map(
              (field) => `
            <option value="${field.key}" ${option.field === field.key ? 'selected' : ''}>
              ${field.label}
            </option>
          `,
            )
            .join('')}
        </select>
        
        <select class="sort-direction-select">
          <option value="asc" ${option.direction === 'asc' ? 'selected' : ''}>Ascending</option>
          <option value="desc" ${option.direction === 'desc' ? 'selected' : ''}>Descending</option>
        </select>
        
        <div class="sort-option-controls">
          <button type="button" class="sort-move-up" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="sort-move-down" ${index === this.state.sortOptions.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="sort-option-remove" ${this.state.sortOptions.length === 1 ? 'disabled' : ''}>×</button>
        </div>
      </div>
    `;
  }

  /**
   * Render presets panel
   */
  private renderPresetsPanel(): string {
    return `
      <div class="presets-section">
        <div class="section-header">
          <h4>Filter Presets</h4>
          <button type="button" class="save-filter-preset">
            Save Current as Preset
          </button>
        </div>
        
        <div class="presets-grid">
          ${this.state.presets
            .map(
              (preset) => `
            <div class="filter-preset-item ${this.state.currentPreset === preset.id ? 'active' : ''}" data-preset-id="${preset.id}">
              <div class="preset-header">
                <h5>${this.escapeHtml(preset.name)}</h5>
                <div class="preset-actions">
                  <button type="button" class="preset-edit" data-preset-id="${preset.id}">✏️</button>
                  <button type="button" class="preset-delete" data-preset-id="${preset.id}">🗑️</button>
                </div>
              </div>
              <p class="preset-description">${this.escapeHtml(preset.description)}</p>
              <div class="preset-stats">
                <span class="preset-groups">${preset.groups.length} groups</span>
                <span class="preset-used">Used ${preset.useCount} times</span>
                ${preset.quickAccess ? '<span class="preset-quick">Quick Access</span>' : ''}
              </div>
            </div>
          `,
            )
            .join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render results information
   */
  private renderResultsInfo(): string {
    const filterCount = this.getActiveFilterCount();
    const sortCount = this.state.sortOptions.length;

    return `
      <div class="results-info-section">
        <div class="filter-summary">
          <div class="summary-item">
            <span class="summary-label">Active Filters:</span>
            <span class="summary-value">${filterCount}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Sort Fields:</span>
            <span class="summary-value">${sortCount}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Results:</span>
            <span class="summary-value">${this.state.filteredResults.toLocaleString()} / ${this.state.totalResults.toLocaleString()}</span>
          </div>
        </div>
        
        ${this.renderPerformanceMetrics()}
      </div>
    `;
  }

  /**
   * Render performance metrics
   */
  private renderPerformanceMetrics(): string {
    return `
      <div class="performance-metrics">
        <div class="metric-item">
          <span class="metric-label">Filter Time:</span>
          <span class="metric-value" id="filter-time">-</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Cache Hit Rate:</span>
          <span class="metric-value" id="cache-hit-rate">-</span>
        </div>
      </div>
    `;
  }

  /**
   * Render action buttons
   */
  private renderActions(): string {
    return `
      <div class="filter-actions">
        <div class="action-group">
          <button type="button" class="apply-filters primary">
            Apply Filters & Sort
          </button>
          <button type="button" class="clear-filters secondary">
            Clear All
          </button>
        </div>
        
        <div class="action-group">
          <button type="button" class="export-filtered-results">
            Export Results
          </button>
          <button type="button" class="share-filter-config">
            Share Configuration
          </button>
        </div>
      </div>
    `;
  }

  // Additional methods would continue here...
  // (Event handlers, utility methods, WebSocket handlers, etc.)

  /**
   * Get operator type for field
   */
  private getOperatorTypeForField(field: FilterableField): string {
    switch (field.type) {
      case 'text':
        return 'text';
      case 'number':
        return 'number';
      case 'date':
        return 'date';
      case 'boolean':
        return 'boolean';
      case 'select':
      case 'multiselect':
        return field.key === 'skills' ? 'array' : 'text';
      default:
        return 'text';
    }
  }

  /**
   * Get count of active filters
   */
  private getActiveFilterCount(): number {
    return this.state.groups.reduce((count, group) => {
      if (!group.enabled) return count;
      return (
        count +
        group.conditions.filter((condition) => condition.enabled && condition.value !== '').length
      );
    }, 0);
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Attach advanced event listeners after rendering
   */
  private attachAdvancedEventListeners(): void {
    // Multiselect dropdowns
    const multiselectInputs = document.querySelectorAll('.multiselect-input');
    if (multiselectInputs) {
      multiselectInputs.forEach((input) => {
        input.addEventListener('focus', (e) => {
          const dropdown = (e.target as HTMLElement).parentElement?.querySelector(
            '.multiselect-dropdown',
          ) as HTMLElement;
          if (dropdown) dropdown.style.display = 'block';
        });

        input.addEventListener('blur', (e) => {
          setTimeout(() => {
            const dropdown = (e.target as HTMLElement).parentElement?.querySelector(
              '.multiselect-dropdown',
            ) as HTMLElement;
            if (dropdown) dropdown.style.display = 'none';
          }, 200);
        });
      });
    }

    // Auto-apply filters with debouncing
    const filterInputs = document.querySelectorAll('.filter-value-input');
    if (filterInputs) {
      filterInputs.forEach((input) => {
        input.addEventListener('input', () => {
          this.debounceAutoApply();
        });
      });
    }
  }

  /**
   * Debounced auto-apply filters
   */
  private debounceAutoApply(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = window.setTimeout(() => {
      this.applyFilters();
    }, 300);
  }

  /**
   * Handle global search
   */
  private handleGlobalSearch(query: string): void {
    this.state.searchQuery = query;
    this.debounceAutoApply();
  }

  /**
   * Apply filters and sorting
   */
  private async applyFilters(): Promise<void> {
    this.state.isProcessing = true;
    this.updateResultsInfo();

    const filterConfig = {
      groups: this.state.groups,
      sortOptions: this.state.sortOptions,
      searchQuery: this.state.searchQuery,
      quickFilters: this.state.quickFilters,
    };

    try {
      // Send to WebSocket for real-time processing
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'apply_advanced_filters',
            config: filterConfig,
          }),
        );
      }

      // Also send HTTP request as fallback
      const apiEndpoint = this.config.apiEndpoint || '/api/v1';
      const response = await fetch(`${apiEndpoint}/jobs/filter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filterConfig),
      });

      if (response.ok) {
        const result = await response.json();
        this.updateFilterResults(result.jobs, result.totalCount);
      }
    } catch (error) {
      console.error('Failed to apply filters:', error);
    } finally {
      this.state.isProcessing = false;
      this.updateResultsInfo();
    }
  }

  /**
   * Update filter results
   */
  private updateFilterResults(results: any[], totalCount: number): void {
    this.state.filteredResults = totalCount;

    // Emit event for other components
    document.dispatchEvent(
      new CustomEvent('filterResultsUpdated', {
        detail: { results, totalCount },
      }),
    );

    this.updateResultsInfo();
  }

  /**
   * Update results info display
   */
  private updateResultsInfo(): void {
    const container = this.container.querySelector('.results-info-section');
    if (container) {
      const newInfo = this.renderResultsInfo();
      container.innerHTML = newInfo;
    }
  }

  /**
   * Clear all filters
   */
  private clearAllFilters(): void {
    this.state.groups = [this.createDefaultFilterGroup()];
    this.state.quickFilters = {};
    this.state.searchQuery = '';
    this.state.currentPreset = undefined;
    this.render();
    this.applyFilters();
  }

  /**
   * Focus global search input
   */
  private focusGlobalSearch(): void {
    const searchInput = document.getElementById('global-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  /**
   * Handle quick filter toggle
   */
  private handleQuickFilterToggle(target: HTMLElement): void {
    const filterKey = target.dataset.filterKey;
    if (!filterKey) return;

    this.state.quickFilters[filterKey] = !this.state.quickFilters[filterKey];
    target.classList.toggle('active', this.state.quickFilters[filterKey]);

    this.applyFilters();
  }

  /**
   * Handle add filter condition
   */
  private handleAddFilterCondition(target: HTMLElement): void {
    const groupId = target.dataset.groupId;
    const group = this.state.groups.find((g) => g.id === groupId);

    if (group) {
      group.conditions.push(this.createDefaultCondition());
      this.render();
    }
  }

  /**
   * Handle remove filter condition
   */
  private handleRemoveFilterCondition(target: HTMLElement): void {
    const conditionId = target.dataset.conditionId;
    const groupId = target.dataset.groupId;
    const group = this.state.groups.find((g) => g.id === groupId);

    if (group && group.conditions.length > 1) {
      group.conditions = group.conditions.filter((c) => c.id !== conditionId);
      this.render();
    }
  }

  /**
   * Handle add filter group
   */
  private handleAddFilterGroup(): void {
    const newGroup = this.createDefaultFilterGroup();
    newGroup.name = `Filter Group ${this.state.groups.length + 1}`;
    this.state.groups.push(newGroup);
    this.render();
  }

  /**
   * Handle remove filter group
   */
  private handleRemoveFilterGroup(target: HTMLElement): void {
    const groupId = target.dataset.groupId;
    if (this.state.groups.length > 1) {
      this.state.groups = this.state.groups.filter((g) => g.id !== groupId);
      this.render();
    }
  }

  /**
   * Update field options dynamically
   */
  private updateFieldOptions(
    fieldKey: string,
    options: Array<{ value: any; label: string; count?: number }>,
  ): void {
    const field = this.fields.find((f) => f.key === fieldKey);
    if (field) {
      field.options = options;
      // Re-render affected dropdowns
      this.renderFieldOptions(fieldKey);
    }
  }

  /**
   * Re-render field options for specific field
   */
  private renderFieldOptions(fieldKey: string): void {
    const field = this.fields.find((f) => f.key === fieldKey);
    if (!field || !field.options) return;

    document.querySelectorAll('select.filter-value-input').forEach((select) => {
      const condition = this.findConditionByElement(select);
      if (condition && condition.field === fieldKey) {
        const currentValue = (select as HTMLSelectElement).value;

        let optionsHtml = '<option value="">Select value...</option>';
        optionsHtml += field
          .options!.map(
            (option) => `
          <option value="${option.value}" ${currentValue === option.value ? 'selected' : ''}>
            ${option.label}${option.count ? ` (${option.count})` : ''}
          </option>
        `,
          )
          .join('');

        select.innerHTML = optionsHtml;
      }
    });
  }

  /**
   * Find condition associated with DOM element
   */
  private findConditionByElement(element: Element): FilterCondition | undefined {
    const conditionElement = element.closest('.filter-condition');
    if (!conditionElement) return undefined;

    const conditionId = conditionElement.getAttribute('data-condition-id');
    if (!conditionId) return undefined;

    for (const group of this.state.groups) {
      const condition = group.conditions.find((c) => c.id === conditionId);
      if (condition) return condition;
    }

    return undefined;
  }

  /**
   * Handle field change
   */
  private handleFieldChange(target: HTMLElement): void {
    const condition = this.findConditionByElement(target);
    if (!condition) return;

    const newField = (target as HTMLSelectElement).value;
    condition.field = newField;
    condition.value = ''; // Reset value when field changes

    // Update operator dropdown
    const field = this.fields.find((f) => f.key === newField);
    if (field) {
      const operatorType = this.getOperatorTypeForField(field);
      const operators = this.operators[operatorType]?.operators;
      if (operators && operators.length > 0) {
        condition.operator = operators[0]!.value;
      } else {
        condition.operator = 'equals';
      }
    }

    // Re-render the condition
    this.renderSingleCondition(condition);
  }

  /**
   * Handle operator change
   */
  private handleOperatorChange(target: HTMLElement): void {
    const condition = this.findConditionByElement(target);
    if (!condition) return;

    condition.operator = (target as HTMLSelectElement).value;
    condition.value = ''; // Reset value when operator changes

    // Re-render the value input
    this.renderSingleCondition(condition);
  }

  /**
   * Handle value change
   */
  private handleValueChange(target: HTMLElement): void {
    const condition = this.findConditionByElement(target);
    if (!condition) return;

    if (target.classList.contains('range-min') || target.classList.contains('range-max')) {
      // Handle range inputs
      const container = target.closest('.range-inputs');
      const minInput = container?.querySelector('.range-min') as HTMLInputElement;
      const maxInput = container?.querySelector('.range-max') as HTMLInputElement;

      if (minInput && maxInput) {
        condition.value = [minInput.value, maxInput.value];
      }
    } else {
      condition.value = (target as HTMLInputElement).value;
    }

    this.debounceAutoApply();
  }

  /**
   * Render single condition (for dynamic updates)
   */
  private renderSingleCondition(condition: FilterCondition): void {
    const conditionElement = document.querySelector(`[data-condition-id="${condition.id}"]`);
    if (!conditionElement) return;

    const groupElement = conditionElement.closest('.filter-group');
    const groupId = groupElement?.getAttribute('data-group-id') || '';
    const conditionIndex = Array.from(
      groupElement?.querySelectorAll('.filter-condition') || [],
    ).indexOf(conditionElement);

    const newHtml = this.renderFilterCondition(condition, conditionIndex, groupId);
    conditionElement.outerHTML = newHtml;
  }

  /**
   * Handle condition toggle
   */
  private handleConditionToggle(target: HTMLElement): void {
    const condition = this.findConditionByElement(target);
    if (!condition) return;

    condition.enabled = (target as HTMLInputElement).checked;
    this.debounceAutoApply();
  }

  /**
   * Handle group logic change
   */
  private handleGroupLogicChange(target: HTMLElement): void {
    const groupElement = target.closest('.filter-group');
    const groupId = groupElement?.getAttribute('data-group-id');
    const group = this.state.groups.find((g) => g.id === groupId);

    if (group) {
      group.logic = (target as HTMLSelectElement).value as 'AND' | 'OR';
      this.debounceAutoApply();
    }
  }

  /**
   * Handle sort field change
   */
  private handleSortFieldChange(target: HTMLElement): void {
    const sortElement = target.closest('.sort-option');
    const sortIndex = Number.parseInt(sortElement?.getAttribute('data-sort-index') || '0');
    const sortOption = this.state.sortOptions[sortIndex];

    if (sortOption) {
      sortOption.field = (target as HTMLSelectElement).value;
      this.applyFilters();
    }
  }

  /**
   * Handle sort direction change
   */
  private handleSortDirectionChange(target: HTMLElement): void {
    const sortElement = target.closest('.sort-option');
    const sortIndex = Number.parseInt(sortElement?.getAttribute('data-sort-index') || '0');
    const sortOption = this.state.sortOptions[sortIndex];

    if (sortOption) {
      sortOption.direction = (target as HTMLSelectElement).value as 'asc' | 'desc';
      this.applyFilters();
    }
  }

  /**
   * Handle add sort option
   */
  private handleAddSortOption(): void {
    const availableFields = this.fields.filter((f) => f.sortable);
    const usedFields = this.state.sortOptions.map((s) => s.field);
    const unusedFields = availableFields.filter((f) => !usedFields.includes(f.key));

    if (unusedFields.length > 0) {
      const firstField = unusedFields[0]!;
      this.state.sortOptions.push({
        field: firstField.key,
        direction: 'asc',
        priority: this.state.sortOptions.length + 1,
        dataType:
          firstField.type === 'number' ? 'number' : firstField.type === 'date' ? 'date' : 'string',
      });

      this.renderSortingOptionsSection();
    }
  }

  /**
   * Handle remove sort option
   */
  private handleRemoveSortOption(target: HTMLElement): void {
    const sortElement = target.closest('.sort-option');
    const sortIndex = Number.parseInt(sortElement?.getAttribute('data-sort-index') || '0');

    if (this.state.sortOptions.length > 1) {
      this.state.sortOptions.splice(sortIndex, 1);

      // Update priorities
      this.state.sortOptions.forEach((option, index) => {
        option.priority = index + 1;
      });

      this.renderSortingOptionsSection();
      this.applyFilters();
    }
  }

  /**
   * Re-render just the sorting options section
   */
  private renderSortingOptionsSection(): void {
    const container = this.container.querySelector('.sorting-section');
    if (container) {
      container.innerHTML = this.renderSortingOptions();
    }
  }

  /**
   * Handle preset selection
   */
  private handlePresetSelection(target: HTMLElement): void {
    const presetId = target.dataset.presetId;
    const preset = this.state.presets.find((p) => p.id === presetId);

    if (preset) {
      this.loadPreset(preset);
    }
  }

  /**
   * Load preset configuration
   */
  private loadPreset(preset: FilterPreset): void {
    this.state.groups = JSON.parse(JSON.stringify(preset.groups)); // Deep copy
    this.state.currentPreset = preset.id;

    // Update preset usage
    preset.lastUsed = new Date().toISOString();
    preset.useCount++;

    this.render();
    this.applyFilters();
  }

  /**
   * Handle save preset
   */
  private async handleSavePreset(): Promise<void> {
    const name = prompt('Enter preset name:');
    if (!name) return;

    const description = prompt('Enter preset description (optional):') || '';

    const preset: FilterPreset = {
      id: this.generateId(),
      name,
      description,
      groups: JSON.parse(JSON.stringify(this.state.groups)), // Deep copy
      quickAccess: false,
      createdAt: new Date().toISOString(),
      useCount: 0,
    };

    try {
      const apiEndpoint = this.config.apiEndpoint || '/api/v1';
      const response = await fetch(`${apiEndpoint}/filters/presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset),
      });

      if (response.ok) {
        this.state.presets.push(preset);
        this.renderPresets();
      }
    } catch (error) {
      console.error('Failed to save preset:', error);
    }
  }

  /**
   * Re-render just the presets section
   */
  private renderPresets(): void {
    const container = this.container.querySelector('.presets-section');
    if (container) {
      container.innerHTML = this.renderPresetsPanel();
    }
  }

  /**
   * Add shared preset from WebSocket
   */
  private addSharedPreset(preset: FilterPreset): void {
    // Avoid duplicates
    const exists = this.state.presets.some((p) => p.id === preset.id);
    if (!exists) {
      this.state.presets.push(preset);
      this.renderPresets();
    }
  }

  /**
   * Update performance metrics display
   */
  private updatePerformanceMetrics(metrics: any): void {
    const filterTimeElement = document.getElementById('filter-time');
    const cacheHitRateElement = document.getElementById('cache-hit-rate');

    if (filterTimeElement && metrics.filterTime) {
      filterTimeElement.textContent = `${metrics.filterTime}ms`;
    }

    if (cacheHitRateElement && metrics.cacheHitRate !== undefined) {
      cacheHitRateElement.textContent = `${Math.round(metrics.cacheHitRate * 100)}%`;
    }
  }

  // Public API methods for testing and external use

  /**
   * Get current filter state
   */
  getFilterState(): FilterState {
    return this.state;
  }

  /**
   * Add a new filter group
   */
  addFilterGroup(): void {
    this.handleAddFilterGroup();
  }

  /**
   * Remove a filter group
   */
  removeFilterGroup(groupId: string): void {
    const groupIndex = this.state.groups.findIndex((g) => g.id === groupId);
    if (groupIndex !== -1) {
      this.state.groups.splice(groupIndex, 1);
      this.saveState();
      this.render();
      this.applyFilters();
    }
  }

  /**
   * Add a condition to a filter group
   */
  addFilterCondition(groupId: string): void {
    const group = this.state.groups.find((g) => g.id === groupId);
    if (group) {
      const condition: FilterCondition = {
        id: `condition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        field: '',
        operator: '',
        value: '',
        dataType: 'string',
        enabled: true,
      };
      group.conditions.push(condition);
      this.saveState();
      this.render();
    }
  }

  /**
   * Remove a condition from a filter group
   */
  removeFilterCondition(groupId: string, conditionId: string): void {
    const group = this.state.groups.find((g) => g.id === groupId);
    if (group) {
      const conditionIndex = group.conditions.findIndex((c) => c.id === conditionId);
      if (conditionIndex !== -1) {
        group.conditions.splice(conditionIndex, 1);
        this.saveState();
        this.render();
        this.applyFilters();
      }
    }
  }

  /**
   * Update a filter condition
   */
  updateFilterCondition(
    groupId: string,
    conditionId: string,
    updates: Partial<FilterCondition>,
  ): void {
    const group = this.state.groups.find((g) => g.id === groupId);
    if (group) {
      const condition = group.conditions.find((c) => c.id === conditionId);
      if (condition) {
        Object.assign(condition, updates);
        this.saveState();
        this.render();
        this.applyFilters();
      }
    }
  }

  /**
   * Toggle a quick filter
   */
  toggleQuickFilter(filterId: string): void {
    this.state.quickFilters[filterId] = !this.state.quickFilters[filterId];
    this.saveState();
    this.render();
    this.applyFilters();
  }

  /**
   * Add a sort option
   */
  addSortOption(field: string, direction: 'asc' | 'desc' = 'asc'): void {
    const sortOption: SortOption = {
      field,
      direction,
      priority: this.state.sortOptions.length,
      dataType: this.getFieldDataType(field),
    };
    this.state.sortOptions.push(sortOption);
    this.saveState();
    this.render();
    this.applyFilters();
  }

  /**
   * Remove a sort option
   */
  removeSortOption(index: number): void {
    if (index >= 0 && index < this.state.sortOptions.length) {
      this.state.sortOptions.splice(index, 1);
      // Reorder priorities
      this.state.sortOptions.forEach((option, i) => {
        option.priority = i;
      });
      this.saveState();
      this.render();
      this.applyFilters();
    }
  }

  /**
   * Update a sort option
   */
  updateSortOption(index: number, updates: Partial<SortOption>): void {
    if (index >= 0 && index < this.state.sortOptions.length) {
      const option = this.state.sortOptions[index];
      if (option) {
        Object.assign(option, updates);
        this.saveState();
        this.render();
        this.applyFilters();
      }
    }
  }

  /**
   * Move sort option up in priority
   */
  moveSortOptionUp(index: number): void {
    if (index > 0 && index < this.state.sortOptions.length) {
      const option = this.state.sortOptions[index];
      if (option) {
        this.state.sortOptions.splice(index, 1);
        this.state.sortOptions.splice(index - 1, 0, option);
        // Reorder priorities
        this.state.sortOptions.forEach((opt, i) => {
          opt.priority = i + 1;
        });
        this.saveState();
        this.render();
        this.applyFilters();
      }
    }
  }

  /**
   * Move sort option down in priority
   */
  moveSortOptionDown(index: number): void {
    if (index >= 0 && index < this.state.sortOptions.length - 1) {
      const option = this.state.sortOptions[index];
      if (option) {
        this.state.sortOptions.splice(index, 1);
        this.state.sortOptions.splice(index + 1, 0, option);
        // Reorder priorities
        this.state.sortOptions.forEach((opt, i) => {
          opt.priority = i + 1;
        });
        this.saveState();
        this.render();
        this.applyFilters();
      }
    }
  }

  /**
   * Save a filter preset
   */
  saveFilterPreset(name: string, description = ''): void {
    const preset: FilterPreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      groups: JSON.parse(JSON.stringify(this.state.groups)),
      quickAccess: false,
      createdAt: new Date().toISOString(),
      useCount: 0,
    };
    this.state.presets.push(preset);
    this.saveState();
    this.render();
  }

  /**
   * Load a filter preset
   */
  loadFilterPreset(presetId: string): void {
    const preset = this.state.presets.find((p) => p.id === presetId);
    if (preset) {
      this.state.groups = JSON.parse(JSON.stringify(preset.groups));
      preset.lastUsed = new Date().toISOString();
      preset.useCount++;
      this.saveState();
      this.render();
      this.applyFilters();
    }
  }

  /**
   * Delete a filter preset
   */
  deleteFilterPreset(presetId: string): void {
    const presetIndex = this.state.presets.findIndex((p) => p.id === presetId);
    if (presetIndex !== -1) {
      this.state.presets.splice(presetIndex, 1);
      this.saveState();
      this.render();
    }
  }

  /**
   * Update global search
   */
  updateGlobalSearch(searchTerm: string): void {
    this.state.globalSearch = searchTerm;
    this.saveState();
    this.applyFilters();
  }

  /**
   * Clear global search
   */
  clearGlobalSearch(): void {
    this.state.globalSearch = '';
    this.saveState();
    this.render();
    this.applyFilters();
  }

  /**
   * Export filtered results
   */
  async exportFilteredResults(format: 'csv' | 'json' | 'excel' = 'csv'): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiEndpoint || '/api'}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters: this.state,
          format,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `filtered-results.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  }

  /**
   * Share filter configuration
   */
  shareFilterConfiguration(): string {
    const config = {
      groups: this.state.groups,
      sortOptions: this.state.sortOptions,
      globalSearch: this.state.globalSearch,
    };
    return btoa(JSON.stringify(config));
  }

  /**
   * Get field data type
   */
  private getFieldDataType(field: string): 'string' | 'number' | 'date' {
    const fieldDef = this.fields.find((f) => f.id === field);
    return fieldDef?.dataType || 'string';
  }

  /**
   * Save current state to localStorage
   */
  private saveState(): void {
    try {
      localStorage.setItem('advanced-filtering-state', JSON.stringify(this.state));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  /**
   * Destroy component and clean up resources
   */
  destroy(): void {
    // Clean up event listeners
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    // Close WebSocket connection
    if (this.ws) {
      this.ws.close();
    }

    // Clear the container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Export the component
export { AdvancedFilteringSortingComponent };
export default AdvancedFilteringSortingComponent;
