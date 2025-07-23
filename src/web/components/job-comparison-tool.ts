/**
 * Job Comparison Tool Component
 * Phase 7 Stage 4: Advanced UI Features & UX
 */

import { SecurityUtils } from '../utils/security-utils.js';

// Job Comparison Types
interface ComparisonJob {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: {
    min: number;
    max: number;
    currency: string;
  } | null;
  employmentType: string;
  remote: boolean;
  skills: string[];
  requirements: string[];
  benefits: string[];
  description: string;
  postedDate: string;
  companyRating?: number;
  workLifeBalance?: number;
  careerOpportunities?: number;
}

interface ComparisonAnalytics {
  salaryComparison: {
    highest: ComparisonJob;
    lowest: ComparisonJob;
    averageMin: number;
    averageMax: number;
  };
  skillsGap: {
    [jobId: string]: {
      matchPercentage: number;
      missingSkills: string[];
      strongMatches: string[];
    };
  };
  benefitsAnalysis: {
    commonBenefits: string[];
    uniqueBenefits: { [jobId: string]: string[] };
  };
  companyRatings: {
    [jobId: string]: {
      overall: number;
      workLife: number;
      career: number;
    };
  };
}

interface SavedComparison {
  id: string;
  name: string;
  jobs: ComparisonJob[];
  createdAt: string;
  analytics: ComparisonAnalytics;
}

class JobComparisonTool {
  private comparedJobs: ComparisonJob[] = [];
  private ws: WebSocket | null = null;
  private chart: any = null;
  private userSkills: string[] = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python']; // Mock user skills
  private savedComparisons: SavedComparison[] = [];

  constructor() {
    this.init();
    this.loadSavedComparisons();
  }

  private init(): void {
    this.setupEventListeners();
    this.renderComparison();
    this.updateSavedComparisons();
  }

  setWebSocket(ws: WebSocket): void {
    this.ws = ws;

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }

  private handleWebSocketMessage(data: any): void {
    switch (data.type) {
      case 'job-updated':
        this.handleJobUpdate(data.data);
        break;
      case 'comparison-shared':
        this.handleSharedComparison(data.data);
        break;
      default:
        // Handle other message types
        break;
    }
  }

  private setupEventListeners(): void {
    // Add job button
    document.getElementById('addJobBtn')?.addEventListener('click', () => {
      this.showJobSelectionPanel();
    });

    // Clear all button
    document.getElementById('clearAllBtn')?.addEventListener('click', () => {
      this.clearAllJobs();
    });

    // Export comparison button
    document.getElementById('exportComparisonBtn')?.addEventListener('click', () => {
      this.exportComparison();
    });

    // Close selection panel
    document.getElementById('closeSelectionPanel')?.addEventListener('click', () => {
      this.hideJobSelectionPanel();
    });

    // Job search input
    const searchInput = document.getElementById('jobSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.searchJobs((e.target as HTMLInputElement).value);
    });

    // Analytics view selector
    document.getElementById('analyticsView')?.addEventListener('change', (e) => {
      this.updateAnalyticsView((e.target as HTMLSelectElement).value);
    });

    // Save current comparison
    document.getElementById('saveCurrentComparison')?.addEventListener('click', () => {
      this.saveCurrentComparison();
    });
  }

  private showJobSelectionPanel(): void {
    const panel = document.getElementById('jobSelectionPanel');
    if (panel) {
      panel.style.display = 'flex';
      panel.classList.remove('hidden');
      this.loadAvailableJobs();
    }
  }

  private hideJobSelectionPanel(): void {
    const panel = document.getElementById('jobSelectionPanel');
    if (panel) {
      panel.style.display = 'none';
      panel.classList.add('hidden');
    }
  }

  private async loadAvailableJobs(): Promise<void> {
    try {
      // Mock job data - in real implementation, this would fetch from the server
      const mockJobs: ComparisonJob[] = [
        {
          id: 'job1',
          title: 'Senior Full Stack Developer',
          company: 'Tech Innovators Inc.',
          location: 'San Francisco, CA',
          salary: { min: 120000, max: 160000, currency: 'USD' },
          employmentType: 'Full-time',
          remote: true,
          skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL'],
          requirements: ['5+ years experience', "Bachelor's degree", 'Agile experience'],
          benefits: ['Health insurance', '401k', 'Flexible PTO', 'Remote work'],
          description: 'Build scalable web applications using modern technologies.',
          postedDate: '2024-01-15',
          companyRating: 4.2,
          workLifeBalance: 4.0,
          careerOpportunities: 4.5,
        },
        {
          id: 'job2',
          title: 'Frontend Developer',
          company: 'Creative Solutions LLC',
          location: 'New York, NY',
          salary: { min: 90000, max: 120000, currency: 'USD' },
          employmentType: 'Full-time',
          remote: false,
          skills: ['React', 'Vue.js', 'CSS', 'HTML', 'JavaScript'],
          requirements: ['3+ years experience', 'Portfolio required', 'Design skills'],
          benefits: ['Health insurance', 'Dental', 'Vision', 'Gym membership'],
          description: 'Create beautiful and responsive user interfaces.',
          postedDate: '2024-01-12',
          companyRating: 3.8,
          workLifeBalance: 3.5,
          careerOpportunities: 3.9,
        },
        {
          id: 'job3',
          title: 'DevOps Engineer',
          company: 'Cloud Systems Corp',
          location: 'Austin, TX',
          salary: { min: 110000, max: 140000, currency: 'USD' },
          employmentType: 'Full-time',
          remote: true,
          skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'Python'],
          requirements: ['4+ years DevOps experience', 'AWS certification preferred'],
          benefits: ['Health insurance', '401k match', 'Stock options', 'Learning budget'],
          description: 'Manage cloud infrastructure and deployment pipelines.',
          postedDate: '2024-01-10',
          companyRating: 4.1,
          workLifeBalance: 4.2,
          careerOpportunities: 4.3,
        },
        {
          id: 'job4',
          title: 'Backend Developer',
          company: 'Data Dynamics',
          location: 'Seattle, WA',
          salary: { min: 100000, max: 130000, currency: 'USD' },
          employmentType: 'Full-time',
          remote: true,
          skills: ['Python', 'Django', 'PostgreSQL', 'Redis', 'API Design'],
          requirements: ['3+ years backend experience', 'Database optimization'],
          benefits: ['Health insurance', 'Unlimited PTO', 'Profit sharing'],
          description: 'Build robust APIs and data processing systems.',
          postedDate: '2024-01-08',
          companyRating: 4.0,
          workLifeBalance: 4.1,
          careerOpportunities: 3.8,
        },
      ];

      this.displaySearchResults(mockJobs);
    } catch (error) {
      console.error('Failed to load available jobs:', error);
    }
  }

  private searchJobs(query: string): void {
    // This would typically make an API call to search for jobs
    // For now, we'll simulate with the mock data
    if (!query.trim()) {
      this.loadAvailableJobs();
      return;
    }

    // Filter mock jobs based on search query
    this.loadAvailableJobs();
  }

  private displaySearchResults(jobs: ComparisonJob[]): void {
    const resultsContainer = document.getElementById('jobSearchResults');
    if (!resultsContainer) return;

    const html = jobs
      .filter((job) => !this.comparedJobs.find((cj) => cj.id === job.id))
      .map(
        (job) => `
        <div class="job-search-result" data-job-id="${job.id}">
          <div class="job-result-info">
            <h4>${job.title}</h4>
            <p>${job.company} • ${job.location}</p>
          </div>
          <button class="add-to-comparison" onclick="window.jobComparisonTool.addJobToComparison('${job.id}')">
            Add to Compare
          </button>
        </div>
      `,
      )
      .join('');

    SecurityUtils.setSecureHTML(resultsContainer, html);
  }

  addJobToComparison(jobId: string): void {
    if (this.comparedJobs.length >= 4) {
      alert('Maximum 4 jobs can be compared at once');
      return;
    }

    // Find job from mock data (in real app, fetch from server)
    this.loadAvailableJobs().then(() => {
      // For demo, we'll add a mock job
      const mockJob: ComparisonJob = {
        id: jobId,
        title: `Sample Job ${this.comparedJobs.length + 1}`,
        company: 'Sample Company',
        location: 'Remote',
        salary: {
          min: 80000 + this.comparedJobs.length * 20000,
          max: 120000 + this.comparedJobs.length * 20000,
          currency: 'USD',
        },
        employmentType: 'Full-time',
        remote: true,
        skills: ['JavaScript', 'React', 'Node.js'],
        requirements: ['3+ years experience'],
        benefits: ['Health insurance', '401k'],
        description: 'Sample job description',
        postedDate: new Date().toISOString(),
        companyRating: 4.0,
        workLifeBalance: 4.0,
        careerOpportunities: 4.0,
      };

      this.comparedJobs.push(mockJob);
      this.renderComparison();
      this.updateAnalytics();
      this.hideJobSelectionPanel();
    });
  }

  private removeJobFromComparison(jobId: string): void {
    this.comparedJobs = this.comparedJobs.filter((job) => job.id !== jobId);
    this.renderComparison();
    this.updateAnalytics();
  }

  private clearAllJobs(): void {
    if (this.comparedJobs.length === 0) return;

    if (confirm('Are you sure you want to clear all jobs from comparison?')) {
      this.comparedJobs = [];
      this.renderComparison();
      this.updateAnalytics();
    }
  }

  private renderComparison(): void {
    const grid = document.getElementById('comparisonGrid');
    if (!grid) return;

    if (this.comparedJobs.length === 0) {
      SecurityUtils.setSecureHTML(
        grid,
        `
        <div class="comparison-placeholder">
          <div class="placeholder-content">
            <div class="placeholder-icon">🔀</div>
            <h3>No Jobs to Compare</h3>
            <p>Add jobs to start comparing salaries, benefits, requirements, and more.</p>
            <button class="btn btn-primary" onclick="document.getElementById('addJobBtn').click()">
              Add Your First Job
            </button>
          </div>
        </div>
      `,
      );
      return;
    }

    const maxSalary = Math.max(
      ...this.comparedJobs.filter((job) => job.salary).map((job) => job.salary!.max),
    );

    const html = this.comparedJobs
      .map(
        (job) => `
      <div class="job-comparison-card">
        <div class="card-header">
          <div class="job-title">
            <h3>${job.title}</h3>
            <p class="job-company">${job.company}</p>
          </div>
          <button class="remove-job" onclick="window.jobComparisonTool.removeJobFromComparison('${job.id}')">
            ✕
          </button>
        </div>

        <div class="job-details-section">
          <div class="detail-item">
            <span class="detail-label">📍 Location</span>
            <span class="detail-value">${job.location}${job.remote ? ' (Remote)' : ''}</span>
          </div>
          
          <div class="detail-item">
            <span class="detail-label">💰 Salary</span>
            <span class="detail-value ${job.salary && job.salary.max === maxSalary ? 'highlight' : ''}">
              ${job.salary ? `$${job.salary.min.toLocaleString()} - $${job.salary.max.toLocaleString()}` : 'Not specified'}
            </span>
          </div>
          
          ${
            job.salary
              ? `
            <div class="salary-bar">
              <div class="salary-fill" style="width: ${(job.salary.max / maxSalary) * 100}%"></div>
            </div>
          `
              : ''
          }

          <div class="detail-item">
            <span class="detail-label">⏰ Type</span>
            <span class="detail-value">${job.employmentType}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">⭐ Company Rating</span>
            <span class="detail-value">${job.companyRating ? `${job.companyRating.toFixed(1)}/5` : 'Not rated'}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">📅 Posted</span>
            <span class="detail-value">${this.formatDate(job.postedDate)}</span>
          </div>
        </div>

        <div class="job-details-section">
          <div class="detail-item">
            <span class="detail-label">🛠️ Skills Required</span>
            <div class="skills-list">
              ${job.skills
                .map((skill) => {
                  const hasSkill = this.userSkills.includes(skill);
                  return `<span class="skill-tag ${hasSkill ? '' : 'missing'}">${skill}</span>`;
                })
                .join('')}
            </div>
          </div>
        </div>

        <div class="job-details-section">
          <div class="detail-item">
            <span class="detail-label">🎁 Benefits</span>
            <div class="detail-value">
              ${job.benefits.slice(0, 3).join(', ')}
              ${job.benefits.length > 3 ? `... +${job.benefits.length - 3} more` : ''}
            </div>
          </div>
        </div>
      </div>
    `,
      )
      .join('');

    SecurityUtils.setSecureHTML(grid, html);

    // Enable action buttons
    const saveBtn = document.getElementById('saveCurrentComparison') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.disabled = false;
    }
  }

  private updateAnalytics(): void {
    const analyticsPanel = document.getElementById('comparisonAnalytics');
    const gapAnalysisPanel = document.getElementById('gapAnalysis');

    if (this.comparedJobs.length < 2) {
      analyticsPanel?.style.setProperty('display', 'none');
      gapAnalysisPanel?.style.setProperty('display', 'none');
      return;
    }

    analyticsPanel?.style.setProperty('display', 'block');
    gapAnalysisPanel?.style.setProperty('display', 'block');

    this.updateAnalyticsView('salary');
    this.updateGapAnalysis();
  }

  private updateAnalyticsView(viewType: string): void {
    const canvas = document.getElementById('comparisonChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    let chartData: any = null;
    let insights: string[] = [];

    switch (viewType) {
      case 'salary':
        chartData = this.prepareSalaryChart();
        insights = this.generateSalaryInsights();
        break;
      case 'requirements':
        chartData = this.prepareRequirementsChart();
        insights = this.generateRequirementsInsights();
        break;
      case 'benefits':
        chartData = this.prepareBenefitsChart();
        insights = this.generateBenefitsInsights();
        break;
      case 'company':
        chartData = this.prepareCompanyChart();
        insights = this.generateCompanyInsights();
        break;
      default:
        return;
    }

    this.chart = new (window as any).Chart(ctx, chartData);
    this.updateInsights(insights);
  }

  private prepareSalaryChart(): any {
    const jobs = this.comparedJobs.filter((job) => job.salary);

    return {
      type: 'bar',
      data: {
        labels: jobs.map((job) => job.company),
        datasets: [
          {
            label: 'Min Salary',
            data: jobs.map((job) => job.salary!.min),
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1,
          },
          {
            label: 'Max Salary',
            data: jobs.map((job) => job.salary!.max),
            backgroundColor: 'rgba(147, 51, 234, 0.6)',
            borderColor: 'rgba(147, 51, 234, 1)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Salary Comparison',
          },
          legend: {
            display: true,
            position: 'top',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value: any) => `$${value.toLocaleString()}`,
            },
          },
        },
      },
    };
  }

  private prepareRequirementsChart(): any {
    const skillsMatch = this.comparedJobs.map((job) => {
      const matchCount = job.skills.filter((skill) => this.userSkills.includes(skill)).length;
      const matchPercentage = (matchCount / job.skills.length) * 100;
      return matchPercentage;
    });

    return {
      type: 'doughnut',
      data: {
        labels: this.comparedJobs.map((job) => job.company),
        datasets: [
          {
            data: skillsMatch,
            backgroundColor: [
              'rgba(59, 130, 246, 0.8)',
              'rgba(147, 51, 234, 0.8)',
              'rgba(34, 197, 94, 0.8)',
              'rgba(251, 191, 36, 0.8)',
            ],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Skills Match Percentage',
          },
          legend: {
            display: true,
            position: 'right',
          },
        },
      },
    };
  }

  private prepareBenefitsChart(): any {
    const benefitCounts = this.comparedJobs.map((job) => job.benefits.length);

    return {
      type: 'bar',
      data: {
        labels: this.comparedJobs.map((job) => job.company),
        datasets: [
          {
            label: 'Number of Benefits',
            data: benefitCounts,
            backgroundColor: 'rgba(34, 197, 94, 0.6)',
            borderColor: 'rgba(34, 197, 94, 1)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Benefits Comparison',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    };
  }

  private prepareCompanyChart(): any {
    return {
      type: 'radar',
      data: {
        labels: ['Overall Rating', 'Work-Life Balance', 'Career Opportunities'],
        datasets: this.comparedJobs.map((job, index) => ({
          label: job.company,
          data: [job.companyRating || 0, job.workLifeBalance || 0, job.careerOpportunities || 0],
          backgroundColor: `rgba(${59 + index * 40}, ${130 + index * 30}, 246, 0.2)`,
          borderColor: `rgba(${59 + index * 40}, ${130 + index * 30}, 246, 1)`,
          pointBackgroundColor: `rgba(${59 + index * 40}, ${130 + index * 30}, 246, 1)`,
          borderWidth: 2,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Company Ratings Comparison',
          },
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 5,
          },
        },
      },
    };
  }

  private generateSalaryInsights(): string[] {
    const salaryJobs = this.comparedJobs.filter((job) => job.salary);
    if (salaryJobs.length === 0) return ['No salary data available for comparison'];

    const salaries = salaryJobs.map((job) => ({
      company: job.company,
      min: job.salary!.min,
      max: job.salary!.max,
      avg: (job.salary!.min + job.salary!.max) / 2,
    }));

    const highest = salaries.reduce((prev, curr) => (prev.max > curr.max ? prev : curr));
    const lowest = salaries.reduce((prev, curr) => (prev.max < curr.max ? prev : curr));
    const avgSalary = salaries.reduce((sum, job) => sum + job.avg, 0) / salaries.length;

    return [
      `${highest.company} offers the highest maximum salary at $${highest.max.toLocaleString()}`,
      `${lowest.company} has the lowest salary range`,
      `Average salary across all positions is $${Math.round(avgSalary).toLocaleString()}`,
      `Salary difference between highest and lowest is $${(highest.max - lowest.max).toLocaleString()}`,
    ];
  }

  private generateRequirementsInsights(): string[] {
    const skillsAnalysis = this.comparedJobs.map((job) => {
      const matchCount = job.skills.filter((skill) => this.userSkills.includes(skill)).length;
      const matchPercentage = (matchCount / job.skills.length) * 100;
      return {
        company: job.company,
        match: matchPercentage,
        missing: job.skills.length - matchCount,
      };
    });

    const bestMatch = skillsAnalysis.reduce((prev, curr) =>
      prev.match > curr.match ? prev : curr,
    );
    const totalMissing = skillsAnalysis.reduce((sum, job) => sum + job.missing, 0);

    return [
      `${bestMatch.company} has the best skills match at ${bestMatch.match.toFixed(1)}%`,
      `You're missing ${totalMissing} skills across all positions`,
      'Focus on learning the most common missing skills first',
      `Skills gaps range from ${Math.min(...skillsAnalysis.map((s) => s.missing))} to ${Math.max(...skillsAnalysis.map((s) => s.missing))} skills`,
    ];
  }

  private generateBenefitsInsights(): string[] {
    const allBenefits = this.comparedJobs.flatMap((job) => job.benefits);
    const benefitCounts = allBenefits.reduce((acc: any, benefit) => {
      acc[benefit] = (acc[benefit] || 0) + 1;
      return acc;
    }, {});

    const mostCommon = Object.entries(benefitCounts)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 3)
      .map(([benefit, count]) => `${benefit} (${count})`);

    const avgBenefits =
      this.comparedJobs.reduce((sum, job) => sum + job.benefits.length, 0) /
      this.comparedJobs.length;

    return [
      `Most common benefits: ${mostCommon.join(', ')}`,
      `Average ${avgBenefits.toFixed(1)} benefits per position`,
      'Health insurance is offered by most companies',
      'Consider negotiating additional benefits during offer discussions',
    ];
  }

  private generateCompanyInsights(): string[] {
    const ratings = this.comparedJobs.filter((job) => job.companyRating);
    if (ratings.length === 0) return ['No company ratings available'];

    const avgRating = ratings.reduce((sum, job) => sum + job.companyRating!, 0) / ratings.length;
    const highest = ratings.reduce((prev, curr) =>
      (prev.companyRating || 0) > (curr.companyRating || 0) ? prev : curr,
    );

    return [
      `${highest.company} has the highest overall rating at ${highest.companyRating}/5`,
      `Average company rating is ${avgRating.toFixed(1)}/5`,
      'Consider work-life balance scores when making decisions',
      'Research company culture and employee reviews for deeper insights',
    ];
  }

  private updateInsights(insights: string[]): void {
    const container = document.getElementById('analyticsInsights');
    if (!container) return;

    const icons = ['💰', '🎯', '📊', '💡', '⭐'];

    const html = insights
      .map(
        (insight, index) => `
      <div class="insight-item">
        <span class="insight-icon">${icons[index % icons.length]}</span>
        <span class="insight-text">${insight}</span>
      </div>
    `,
      )
      .join('');

    SecurityUtils.setSecureHTML(container, html);
  }

  private updateGapAnalysis(): void {
    const averageMatchElem = document.getElementById('averageMatch');
    const missingSkillsElem = document.getElementById('missingSkills');
    const strongMatchesElem = document.getElementById('strongMatches');
    const gapDetailsElem = document.getElementById('gapDetails');

    if (!averageMatchElem || !missingSkillsElem || !strongMatchesElem || !gapDetailsElem) return;

    // Calculate gap metrics
    const gapAnalysis = this.comparedJobs.map((job) => {
      const matchCount = job.skills.filter((skill) => this.userSkills.includes(skill)).length;
      const matchPercentage = (matchCount / job.skills.length) * 100;
      const missingSkills = job.skills.filter((skill) => !this.userSkills.includes(skill));

      return {
        job,
        matchPercentage,
        matchCount,
        missingSkills,
        totalSkills: job.skills.length,
      };
    });

    const averageMatch =
      gapAnalysis.reduce((sum, analysis) => sum + analysis.matchPercentage, 0) / gapAnalysis.length;
    const totalMissing = gapAnalysis.reduce(
      (sum, analysis) => sum + analysis.missingSkills.length,
      0,
    );
    const strongMatches = gapAnalysis.filter((analysis) => analysis.matchPercentage >= 70).length;

    averageMatchElem.textContent = `${averageMatch.toFixed(0)}%`;
    missingSkillsElem.textContent = totalMissing.toString();
    strongMatchesElem.textContent = strongMatches.toString();

    // Render detailed gap analysis
    const detailsHtml = gapAnalysis
      .map(
        (analysis) => `
      <div class="gap-job-analysis">
        <div class="gap-job-title">${analysis.job.title} - ${analysis.job.company}</div>
        
        <div class="gap-requirements">
          <div class="gap-category">
            <h5>Skills Match: ${analysis.matchPercentage.toFixed(1)}% (${analysis.matchCount}/${analysis.totalSkills})</h5>
            ${analysis.job.skills
              .map((skill) => {
                const hasSkill = this.userSkills.includes(skill);
                return `
                <div class="requirement-item">
                  <div class="requirement-status ${hasSkill ? 'met' : 'missing'}"></div>
                  <span>${skill}</span>
                </div>
              `;
              })
              .join('')}
          </div>
          
          <div class="gap-category">
            <h5>Requirements (${analysis.job.requirements.length})</h5>
            ${analysis.job.requirements
              .map(
                (req) => `
              <div class="requirement-item">
                <div class="requirement-status partial"></div>
                <span>${req}</span>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
      </div>
    `,
      )
      .join('');

    SecurityUtils.setSecureHTML(gapDetailsElem, detailsHtml);
  }

  private saveCurrentComparison(): void {
    if (this.comparedJobs.length === 0) return;

    const name = prompt('Enter a name for this comparison:');
    if (!name) return;

    const comparison: SavedComparison = {
      id: `comp_${Date.now()}`,
      name,
      jobs: [...this.comparedJobs],
      createdAt: new Date().toISOString(),
      analytics: this.generateAnalytics(),
    };

    this.savedComparisons.push(comparison);
    this.saveSavedComparisons();
    this.updateSavedComparisons();

    alert('Comparison saved successfully!');
  }

  private generateAnalytics(): ComparisonAnalytics {
    const salaryJobs = this.comparedJobs.filter((job) => job.salary);

    const fallbackJob: ComparisonJob = {
      id: '',
      title: '',
      company: '',
      location: '',
      postedDate: '',
      description: '',
      requirements: [],
      skills: [],
      benefits: [],
      salary: { min: 0, max: 0, currency: 'USD' },
      employmentType: 'full-time',
      remote: false,
    };

    let highest = salaryJobs[0] || fallbackJob;
    let lowest = salaryJobs[0] || fallbackJob;

    if (salaryJobs.length > 1) {
      highest = salaryJobs.reduce((prev, curr) =>
        prev.salary!.max > curr.salary!.max ? prev : curr,
      );
      lowest = salaryJobs.reduce((prev, curr) =>
        prev.salary!.max < curr.salary!.max ? prev : curr,
      );
    }

    return {
      salaryComparison: {
        highest: highest,
        lowest: lowest,
        averageMin:
          salaryJobs.length > 0
            ? salaryJobs.reduce((sum, job) => sum + job.salary!.min, 0) / salaryJobs.length
            : 0,
        averageMax:
          salaryJobs.length > 0
            ? salaryJobs.reduce((sum, job) => sum + job.salary!.max, 0) / salaryJobs.length
            : 0,
      },
      skillsGap: this.comparedJobs.reduce((acc, job) => {
        const matchCount = job.skills.filter((skill) => this.userSkills.includes(skill)).length;
        acc[job.id] = {
          matchPercentage: (matchCount / job.skills.length) * 100,
          missingSkills: job.skills.filter((skill) => !this.userSkills.includes(skill)),
          strongMatches: job.skills.filter((skill) => this.userSkills.includes(skill)),
        };
        return acc;
      }, {} as any),
      benefitsAnalysis: {
        commonBenefits: [], // Would calculate common benefits
        uniqueBenefits: this.comparedJobs.reduce((acc, job) => {
          acc[job.id] = job.benefits;
          return acc;
        }, {} as any),
      },
      companyRatings: this.comparedJobs.reduce((acc, job) => {
        acc[job.id] = {
          overall: job.companyRating || 0,
          workLife: job.workLifeBalance || 0,
          career: job.careerOpportunities || 0,
        };
        return acc;
      }, {} as any),
    };
  }

  private updateSavedComparisons(): void {
    const container = document.getElementById('savedComparisonsList');
    if (!container) return;

    if (this.savedComparisons.length === 0) {
      SecurityUtils.setSecureHTML(
        container,
        `
        <div class="empty-state">
          <p>No saved comparisons yet. Compare some jobs and save your analysis.</p>
        </div>
      `,
      );
      return;
    }

    const html = this.savedComparisons
      .map(
        (comparison) => `
      <div class="saved-comparison-item">
        <div class="saved-comparison-info">
          <h4>${comparison.name}</h4>
          <p>${comparison.jobs.length} jobs • ${this.formatDate(comparison.createdAt)}</p>
        </div>
        <div class="saved-comparison-actions">
          <button class="btn-load" onclick="window.jobComparisonTool.loadSavedComparison('${comparison.id}')">
            Load
          </button>
          <button class="btn-delete" onclick="window.jobComparisonTool.deleteSavedComparison('${comparison.id}')">
            Delete
          </button>
        </div>
      </div>
    `,
      )
      .join('');

    SecurityUtils.setSecureHTML(container, html);
  }

  loadSavedComparison(comparisonId: string): void {
    const comparison = this.savedComparisons.find((c) => c.id === comparisonId);
    if (!comparison) return;

    if (this.comparedJobs.length > 0) {
      if (!confirm('This will replace your current comparison. Continue?')) {
        return;
      }
    }

    this.comparedJobs = [...comparison.jobs];
    this.renderComparison();
    this.updateAnalytics();
  }

  deleteSavedComparison(comparisonId: string): void {
    if (!confirm('Are you sure you want to delete this saved comparison?')) return;

    this.savedComparisons = this.savedComparisons.filter((c) => c.id !== comparisonId);
    this.saveSavedComparisons();
    this.updateSavedComparisons();
  }

  private exportComparison(): void {
    if (this.comparedJobs.length === 0) {
      alert('No jobs to export. Add some jobs first.');
      return;
    }

    const exportData = {
      timestamp: new Date().toISOString(),
      jobs: this.comparedJobs,
      analytics: this.generateAnalytics(),
      userProfile: {
        skills: this.userSkills,
      },
    };

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-comparison-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private handleJobUpdate(jobData: any): void {
    // Update job in comparison if it exists
    const jobIndex = this.comparedJobs.findIndex((job) => job.id === jobData.id);
    if (jobIndex !== -1) {
      this.comparedJobs[jobIndex] = { ...this.comparedJobs[jobIndex], ...jobData };
      this.renderComparison();
      this.updateAnalytics();
    }
  }

  private handleSharedComparison(data: any): void {
    // Handle receiving a shared comparison
    if (confirm('Someone shared a job comparison with you. Load it?')) {
      this.comparedJobs = data.jobs || [];
      this.renderComparison();
      this.updateAnalytics();
    }
  }

  private loadSavedComparisons(): void {
    try {
      const saved = localStorage.getItem('jobComparisons');
      if (saved) {
        this.savedComparisons = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load saved comparisons:', error);
    }
  }

  private saveSavedComparisons(): void {
    try {
      localStorage.setItem('jobComparisons', JSON.stringify(this.savedComparisons));
    } catch (error) {
      console.error('Failed to save comparisons:', error);
    }
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  }

  // Method for HTML onclick handlers - calls the private method
  public removeJobFromComparisonPublic(jobId: string): void {
    this.removeJobFromComparison(jobId);
  }
}

// Export for module systems and global access
if (typeof window !== 'undefined') {
  (window as any).JobComparisonTool = JobComparisonTool;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = JobComparisonTool;
}
