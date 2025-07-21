/**
 * Site-specific configuration for job board scraping
 * Contains selectors, patterns, and scraping rules for each supported site
 */

export interface SiteConfig {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;

  // Scraping configuration
  scraping: {
    type: 'static' | 'dynamic' | 'hybrid';
    respectRobotsTxt: boolean;
    rateLimit: {
      requestsPerMinute: number;
      burstLimit: number;
    };
    retries: number;
    timeout: number;
  };

  // CSS selectors for job elements
  selectors: {
    // Job listing page selectors
    jobCard: string;
    jobLink: string;
    title: string;
    company: string;
    location: string;
    salary?: string;
    description?: string;
    postedDate?: string;

    // Job detail page selectors
    detailTitle?: string;
    detailCompany?: string;
    detailLocation?: string;
    detailSalary?: string;
    detailDescription?: string;
    detailRequirements?: string;
    detailBenefits?: string;

    // Pagination
    nextButton?: string;
    pageNumbers?: string;
    totalResults?: string;
  };

  // URL patterns and search parameters
  search: {
    searchUrl: string;
    queryParams: {
      keywords: string;
      location?: string;
      radius?: string;
      datePosted?: string;
      salaryMin?: string;
      salaryMax?: string;
      jobType?: string;
      remote?: string;
      sort?: string;
      page?: string;
    };
  };

  // Data processing rules
  processing: {
    salaryRegex?: RegExp[];
    dateFormats?: string[];
    locationCleanup?: RegExp[];
    companyCleanup?: RegExp[];
    descriptionMaxLength?: number;
  };

  // Site-specific features
  features: {
    hasJobAlerts: boolean;
    hasSalaryData: boolean;
    hasCompanyReviews: boolean;
    requiresLogin: boolean;
    hasApplyButton: boolean;
    supportsBulkExport: boolean;
  };
}

/**
 * Configuration for supported job sites
 */
export const SITE_CONFIGS: Record<string, SiteConfig> = {
  // LinkedIn Jobs
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn Jobs',
    baseUrl: 'https://www.linkedin.com',
    enabled: true,
    scraping: {
      type: 'dynamic',
      respectRobotsTxt: true,
      rateLimit: {
        requestsPerMinute: 30,
        burstLimit: 5,
      },
      retries: 3,
      timeout: 30000,
    },
    selectors: {
      jobCard: '.job-search-card',
      jobLink: '.job-search-card__link-wrapper',
      title: '.job-search-card__title',
      company: '.job-search-card__subtitle-primary-grouping',
      location: '.job-search-card__subtitle-secondary-grouping',
      salary: '.job-search-card__salary-info',
      postedDate: '.job-search-card__listdate',
      detailTitle: '.job-details-jobs-unified-top-card__job-title',
      detailCompany: '.job-details-jobs-unified-top-card__company-name',
      detailLocation: '.job-details-jobs-unified-top-card__bullet',
      detailDescription: '.job-details-jobs-unified-top-card__job-description',
      nextButton: '.artdeco-pagination__button--next',
    },
    search: {
      searchUrl: 'https://www.linkedin.com/jobs/search/',
      queryParams: {
        keywords: 'keywords',
        location: 'location',
        datePosted: 'f_TPR',
        jobType: 'f_JT',
        remote: 'f_WT',
        page: 'start',
      },
    },
    processing: {
      salaryRegex: [
        /\$[\d,]+(?:\.\d{2})?\s*-?\s*\$?[\d,]*(?:\.\d{2})?\s*(?:per|\/)\s*(?:hour|hr|year|yr|month|mo)/i,
        /\$[\d,]+(?:\.\d{2})?\s*(?:k|thousand)?/i,
      ],
      dateFormats: ['relative', 'YYYY-MM-DD'],
      companyCleanup: [/\s*\(.*?\)\s*$/],
    },
    features: {
      hasJobAlerts: true,
      hasSalaryData: false,
      hasCompanyReviews: false,
      requiresLogin: false,
      hasApplyButton: true,
      supportsBulkExport: false,
    },
  },

  // Indeed
  indeed: {
    id: 'indeed',
    name: 'Indeed',
    baseUrl: 'https://www.indeed.com',
    enabled: true,
    scraping: {
      type: 'static',
      respectRobotsTxt: true,
      rateLimit: {
        requestsPerMinute: 60,
        burstLimit: 10,
      },
      retries: 3,
      timeout: 20000,
    },
    selectors: {
      jobCard: '[data-jk]',
      jobLink: '[data-jk] h2 a',
      title: '[data-testid="job-title"]',
      company: '[data-testid="company-name"]',
      location: '[data-testid="job-location"]',
      salary: '[data-testid="job-salary"]',
      description: '[data-testid="job-snippet"]',
      postedDate: '[data-testid="myJobsStateDate"]',
      nextButton: '[aria-label="Next Page"]',
      totalResults: '#searchCountPages',
    },
    search: {
      searchUrl: 'https://www.indeed.com/jobs',
      queryParams: {
        keywords: 'q',
        location: 'l',
        radius: 'radius',
        datePosted: 'fromage',
        salaryMin: 'salary',
        jobType: 'jt',
        remote: 'remotejob',
        sort: 'sort',
        page: 'start',
      },
    },
    processing: {
      salaryRegex: [
        /\$[\d,]+(?:\.\d{2})?\s*-\s*\$[\d,]+(?:\.\d{2})?\s*a?\s*(?:year|hour)/i,
        /\$[\d,]+(?:\.\d{2})?\s*(?:a\s*)?(?:year|hour|hr)/i,
      ],
      dateFormats: ['relative', 'MM/DD/YYYY'],
      locationCleanup: [/\s*\+\s*\d+\s*locations?/i],
    },
    features: {
      hasJobAlerts: true,
      hasSalaryData: true,
      hasCompanyReviews: true,
      requiresLogin: false,
      hasApplyButton: true,
      supportsBulkExport: false,
    },
  },

  // Glassdoor
  glassdoor: {
    id: 'glassdoor',
    name: 'Glassdoor',
    baseUrl: 'https://www.glassdoor.com',
    enabled: true,
    scraping: {
      type: 'dynamic',
      respectRobotsTxt: true,
      rateLimit: {
        requestsPerMinute: 30,
        burstLimit: 5,
      },
      retries: 3,
      timeout: 30000,
    },
    selectors: {
      jobCard: '[data-test="job-listing"]',
      jobLink: '[data-test="job-title-link"]',
      title: '[data-test="job-title"]',
      company: '[data-test="employer-name"]',
      location: '[data-test="job-location"]',
      salary: '[data-test="detailSalary"]',
      description: '[data-test="job-description"]',
      nextButton: '[data-test="pagination-next"]',
    },
    search: {
      searchUrl: 'https://www.glassdoor.com/Job/jobs.htm',
      queryParams: {
        keywords: 'sc.keyword',
        location: 'locT',
        jobType: 'jobType',
        page: 'p',
      },
    },
    processing: {
      salaryRegex: [
        /\$[\d,K]+\s*-\s*\$[\d,K]+\s*(?:Employer est\.)?/i,
        /\$[\d,K]+\s*(?:Employer est\.)?/i,
      ],
      dateFormats: ['relative'],
    },
    features: {
      hasJobAlerts: true,
      hasSalaryData: true,
      hasCompanyReviews: true,
      requiresLogin: false,
      hasApplyButton: false,
      supportsBulkExport: false,
    },
  },

  // Stack Overflow Jobs
  stackoverflow: {
    id: 'stackoverflow',
    name: 'Stack Overflow Jobs',
    baseUrl: 'https://stackoverflow.com',
    enabled: false, // Discontinued
    scraping: {
      type: 'static',
      respectRobotsTxt: true,
      rateLimit: {
        requestsPerMinute: 60,
        burstLimit: 10,
      },
      retries: 3,
      timeout: 20000,
    },
    selectors: {
      jobCard: '.listResults .result',
      jobLink: '.result-link',
      title: '.job-link',
      company: '.fc-black-700',
      location: '.fc-black-500',
      salary: '.salary',
      description: '.job-summary',
    },
    search: {
      searchUrl: 'https://stackoverflow.com/jobs',
      queryParams: {
        keywords: 'q',
        location: 'l',
        remote: 'r',
        page: 'pg',
      },
    },
    processing: {
      salaryRegex: [/\$[\d,]+k?\s*-\s*\$?[\d,]+k?/i],
    },
    features: {
      hasJobAlerts: false,
      hasSalaryData: true,
      hasCompanyReviews: false,
      requiresLogin: false,
      hasApplyButton: true,
      supportsBulkExport: false,
    },
  },

  // Remote OK
  remoteok: {
    id: 'remoteok',
    name: 'Remote OK',
    baseUrl: 'https://remoteok.io',
    enabled: true,
    scraping: {
      type: 'static',
      respectRobotsTxt: true,
      rateLimit: {
        requestsPerMinute: 60,
        burstLimit: 10,
      },
      retries: 3,
      timeout: 20000,
    },
    selectors: {
      jobCard: '.job',
      jobLink: '.job h2 a',
      title: '.company_and_position h2',
      company: '.company_and_position h3',
      location: '.location',
      salary: '.salary',
      description: '.description',
      postedDate: '.time',
    },
    search: {
      searchUrl: 'https://remoteok.io/remote-jobs',
      queryParams: {
        keywords: 'search',
      },
    },
    processing: {
      salaryRegex: [/\$[\d,]+k?\s*-\s*\$?[\d,]+k?/i],
      dateFormats: ['relative'],
    },
    features: {
      hasJobAlerts: false,
      hasSalaryData: true,
      hasCompanyReviews: false,
      requiresLogin: false,
      hasApplyButton: true,
      supportsBulkExport: false,
    },
  },

  // We Work Remotely
  weworkremotely: {
    id: 'weworkremotely',
    name: 'We Work Remotely',
    baseUrl: 'https://weworkremotely.com',
    enabled: true,
    scraping: {
      type: 'static',
      respectRobotsTxt: true,
      rateLimit: {
        requestsPerMinute: 60,
        burstLimit: 10,
      },
      retries: 3,
      timeout: 20000,
    },
    selectors: {
      jobCard: '.jobs li',
      jobLink: '.jobs li a',
      title: '.title',
      company: '.company',
      location: '.region',
      description: '.listing-job-post',
      postedDate: '.listing-date',
    },
    search: {
      searchUrl: 'https://weworkremotely.com/remote-jobs/search',
      queryParams: {
        keywords: 'term',
      },
    },
    processing: {
      dateFormats: ['relative', 'MMM DD'],
    },
    features: {
      hasJobAlerts: false,
      hasSalaryData: false,
      hasCompanyReviews: false,
      requiresLogin: false,
      hasApplyButton: true,
      supportsBulkExport: false,
    },
  },
};

/**
 * Get enabled site configurations
 */
export function getEnabledSites(): SiteConfig[] {
  return Object.values(SITE_CONFIGS).filter((site) => site.enabled);
}

/**
 * Get site configuration by ID
 */
export function getSiteConfig(siteId: string): SiteConfig | undefined {
  return SITE_CONFIGS[siteId];
}

/**
 * Get sites that support specific features
 */
export function getSitesByFeature(feature: keyof SiteConfig['features']): SiteConfig[] {
  return Object.values(SITE_CONFIGS).filter((site) => site.enabled && site.features[feature]);
}

/**
 * Get sites by scraping type
 */
export function getSitesByType(type: SiteConfig['scraping']['type']): SiteConfig[] {
  return Object.values(SITE_CONFIGS).filter((site) => site.enabled && site.scraping.type === type);
}

/**
 * Build search URL for a specific site
 */
export function buildSearchUrl(siteId: string, params: Record<string, string>): string {
  const config = getSiteConfig(siteId);
  if (!config) {
    throw new Error(`Site configuration not found for: ${siteId}`);
  }

  const url = new URL(config.search.searchUrl);

  // Map generic parameters to site-specific ones
  for (const [key, value] of Object.entries(params)) {
    const siteParam = config.search.queryParams[key as keyof typeof config.search.queryParams];
    if (siteParam && value) {
      url.searchParams.set(siteParam, value);
    }
  }

  return url.toString();
}
