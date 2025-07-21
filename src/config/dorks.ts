import type { GoogleDorkConfig } from './schemas.js';

/**
 * Predefined Google Dork patterns for job searching
 */

export const JOB_SITES = {
  LINKEDIN: 'linkedin.com/jobs',
  INDEED: 'indeed.com',
  GLASSDOOR: 'glassdoor.com',
  STACKOVERFLOW: 'stackoverflow.com/jobs',
  ANGELLIST: 'angel.co',
  REMOTEOK: 'remoteok.io',
  WEWORKREMOTELY: 'weworkremotely.com',
  FLEXJOBS: 'flexjobs.com',
  ZIPRECRUITER: 'ziprecruiter.com',
  MONSTER: 'monster.com',
  DICE: 'dice.com',
  CAREERBUILDER: 'careerbuilder.com',
} as const;

/**
 * Common job-related keywords for different tech stacks
 */
export const KEYWORD_GROUPS = {
  // Frontend Technologies
  FRONTEND: ['frontend', 'front-end', 'react', 'vue', 'angular', 'typescript', 'javascript', 'css', 'html'],
  
  // Backend Technologies
  BACKEND: ['backend', 'back-end', 'node.js', 'python', 'java', 'go', 'rust', 'c#', 'php', 'ruby'],
  
  // Full Stack
  FULLSTACK: ['full-stack', 'fullstack', 'full stack'],
  
  // DevOps & Infrastructure
  DEVOPS: ['devops', 'kubernetes', 'docker', 'aws', 'azure', 'gcp', 'terraform', 'ansible'],
  
  // Data & AI
  DATA: ['data scientist', 'data engineer', 'machine learning', 'ml engineer', 'ai engineer', 'data analyst'],
  
  // Mobile Development
  MOBILE: ['mobile developer', 'ios developer', 'android developer', 'react native', 'flutter'],
  
  // Management & Leadership
  MANAGEMENT: ['engineering manager', 'tech lead', 'team lead', 'cto', 'vp engineering'],
  
  // Common Job Types
  COMMON_ROLES: ['software engineer', 'developer', 'programmer', 'software developer', 'engineer'],
  
  // Experience Levels
  EXPERIENCE_LEVELS: ['junior', 'senior', 'lead', 'principal', 'staff', 'entry level', 'mid level'],
  
  // Employment Types
  EMPLOYMENT_TYPES: ['remote', 'full-time', 'part-time', 'contract', 'freelance', 'internship'],
} as const;

/**
 * Common keywords to exclude from job searches
 */
export const EXCLUDE_KEYWORDS = [
  'internship',
  'intern',
  'student',
  'volunteer',
  'unpaid',
  'no experience required',
  'entry level only',
  'bootcamp graduate only',
] as const;

/**
 * Predefined Google Dork configurations for popular job sites
 */
export const PREDEFINED_DORKS: Record<string, GoogleDorkConfig[]> = {
  // LinkedIn Jobs
  linkedin: [
    {
      site: JOB_SITES.LINKEDIN,
      keywords: ['software engineer'],
      excludeKeywords: ['intern', 'internship'],
    },
    {
      site: JOB_SITES.LINKEDIN,
      keywords: ['developer', 'remote'],
      excludeKeywords: ['intern', 'student'],
    },
    {
      site: JOB_SITES.LINKEDIN,
      keywords: ['frontend', 'react'],
      excludeKeywords: ['intern'],
    },
    {
      site: JOB_SITES.LINKEDIN,
      keywords: ['backend', 'node.js'],
      excludeKeywords: ['intern'],
    },
  ],

  // Indeed
  indeed: [
    {
      site: JOB_SITES.INDEED,
      keywords: ['software developer'],
      excludeKeywords: ['intern', 'internship', 'student'],
    },
    {
      site: JOB_SITES.INDEED,
      keywords: ['remote', 'developer'],
      excludeKeywords: ['intern', 'unpaid'],
    },
    {
      site: JOB_SITES.INDEED,
      keywords: ['python', 'engineer'],
      excludeKeywords: ['intern'],
    },
  ],

  // Glassdoor
  glassdoor: [
    {
      site: JOB_SITES.GLASSDOOR,
      keywords: ['software engineer'],
      excludeKeywords: ['intern', 'internship'],
    },
    {
      site: JOB_SITES.GLASSDOOR,
      keywords: ['javascript', 'developer'],
      excludeKeywords: ['intern'],
    },
  ],

  // Stack Overflow Jobs (though discontinued, kept for reference)
  stackoverflow: [
    {
      site: JOB_SITES.STACKOVERFLOW,
      keywords: ['developer'],
      excludeKeywords: ['intern'],
    },
  ],

  // Remote-specific sites
  remote: [
    {
      site: JOB_SITES.REMOTEOK,
      keywords: ['developer'],
      excludeKeywords: ['intern'],
    },
    {
      site: JOB_SITES.WEWORKREMOTELY,
      keywords: ['software engineer'],
      excludeKeywords: ['intern'],
    },
    {
      site: JOB_SITES.FLEXJOBS,
      keywords: ['remote', 'developer'],
      excludeKeywords: ['intern'],
    },
  ],

  // Startup-focused
  startup: [
    {
      site: JOB_SITES.ANGELLIST,
      keywords: ['engineer'],
      excludeKeywords: ['intern', 'unpaid'],
    },
  ],

  // General job boards
  general: [
    {
      site: JOB_SITES.ZIPRECRUITER,
      keywords: ['software developer'],
      excludeKeywords: ['intern'],
    },
    {
      site: JOB_SITES.MONSTER,
      keywords: ['programmer'],
      excludeKeywords: ['intern'],
    },
    {
      site: JOB_SITES.CAREERBUILDER,
      keywords: ['software engineer'],
      excludeKeywords: ['intern'],
    },
  ],

  // Tech-specific
  tech: [
    {
      site: JOB_SITES.DICE,
      keywords: ['software engineer'],
      excludeKeywords: ['intern'],
    },
  ],
};

/**
 * Generate Google Dork query string from configuration
 */
export function generateDorkQuery(config: GoogleDorkConfig): string {
  const parts: string[] = [];

  // Add site restriction
  if (config.site) {
    parts.push(`site:${config.site}`);
  }

  // Add keywords (wrapped in quotes for exact phrases)
  if (config.keywords.length > 0) {
    const keywordQueries = config.keywords.map(keyword => 
      keyword.includes(' ') ? `"${keyword}"` : keyword
    );
    parts.push(keywordQueries.join(' OR '));
  }

  // Add exclusions
  if (config.excludeKeywords && config.excludeKeywords.length > 0) {
    const exclusions = config.excludeKeywords.map(keyword => `-"${keyword}"`);
    parts.push(exclusions.join(' '));
  }

  // Add file type restrictions
  if (config.fileTypes && config.fileTypes.length > 0) {
    const fileTypes = config.fileTypes.map(type => `filetype:${type}`);
    parts.push(fileTypes.join(' OR '));
  }

  // Add custom parameters
  if (config.customParams) {
    const customParts = Object.entries(config.customParams).map(
      ([key, value]) => `${key}:${value}`
    );
    parts.push(...customParts);
  }

  return parts.join(' ');
}

/**
 * Get dork configurations for specific job categories
 */
export function getDorksForCategory(category: keyof typeof PREDEFINED_DORKS): GoogleDorkConfig[] {
  return PREDEFINED_DORKS[category] || [];
}

/**
 * Get all available dork configurations
 */
export function getAllDorks(): GoogleDorkConfig[] {
  return Object.values(PREDEFINED_DORKS).flat();
}

/**
 * Create custom dork configuration
 */
export function createCustomDork(options: {
  sites: string[];
  keywords: string[];
  excludeKeywords?: string[];
  location?: string;
  remote?: boolean;
  experienceLevel?: string;
}): GoogleDorkConfig[] {
  const { sites, keywords, excludeKeywords = [], location, remote, experienceLevel } = options;

  const finalKeywords = [...keywords];
  const finalExcludes = [...excludeKeywords, ...EXCLUDE_KEYWORDS];

  // Add location if specified
  if (location && !remote) {
    finalKeywords.push(location);
  }

  // Add remote keyword if specified
  if (remote) {
    finalKeywords.push('remote');
  }

  // Add experience level if specified
  if (experienceLevel) {
    finalKeywords.push(experienceLevel);
  }

  return sites.map(site => ({
    site,
    keywords: finalKeywords,
    excludeKeywords: finalExcludes,
  }));
}

/**
 * Get recommended dorks based on search criteria
 */
export function getRecommendedDorks(criteria: {
  keywords: string[];
  location?: string;
  remote?: boolean;
  experienceLevel?: string;
  sites?: string[];
}): GoogleDorkConfig[] {
  const { keywords, location, remote, experienceLevel, sites } = criteria;

  // Use specified sites or default to popular ones
  const targetSites = sites || [
    JOB_SITES.LINKEDIN,
    JOB_SITES.INDEED,
    JOB_SITES.GLASSDOOR,
    JOB_SITES.REMOTEOK,
  ];

  return createCustomDork({
    sites: targetSites,
    keywords,
    ...(location && { location }),
    ...(remote !== undefined && { remote }),
    ...(experienceLevel && { experienceLevel }),
  });
}

// Remove duplicate export - already exported above
// export { JOB_SITES, KEYWORD_GROUPS, EXCLUDE_KEYWORDS };