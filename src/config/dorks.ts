/**
 * Google Dorks configuration for job searching
 * Each dork is designed to find job postings on specific sites
 */

export interface DorkPattern {
  id: string;
  name: string;
  description: string;
  pattern: string;
  site?: string;
  keywords: string[];
  excludeKeywords?: string[];
  fileTypes?: string[];
  params?: Record<string, string>;
}

/**
 * Job board specific Google Dork patterns
 */
export const JOB_DORKS: DorkPattern[] = [
  // LinkedIn Jobs
  {
    id: 'linkedin-jobs',
    name: 'LinkedIn Job Postings',
    description: 'Find job postings on LinkedIn',
    pattern: 'site:linkedin.com/jobs intitle:"{keywords}" {location}',
    site: 'linkedin.com',
    keywords: ['software engineer', 'developer', 'programmer'],
    excludeKeywords: ['intern', 'unpaid'],
  },

  // Indeed
  {
    id: 'indeed-jobs',
    name: 'Indeed Job Search',
    description: 'Search for jobs on Indeed',
    pattern: 'site:indeed.com intitle:"{keywords}" {location}',
    site: 'indeed.com',
    keywords: ['software', 'web developer', 'full stack'],
  },

  // Glassdoor
  {
    id: 'glassdoor-jobs',
    name: 'Glassdoor Job Listings',
    description: 'Find job listings on Glassdoor',
    pattern: 'site:glassdoor.com/Jobs intitle:"{keywords}" {location}',
    site: 'glassdoor.com',
    keywords: ['engineer', 'developer', 'tech'],
  },

  // Stack Overflow Jobs (now part of Indeed)
  {
    id: 'stackoverflow-jobs',
    name: 'Stack Overflow Developer Jobs',
    description: 'Developer-focused job postings',
    pattern: 'site:stackoverflow.com/jobs intitle:"{keywords}"',
    site: 'stackoverflow.com',
    keywords: ['javascript', 'python', 'react', 'node.js'],
  },

  // AngelList (Wellfound)
  {
    id: 'angellist-jobs',
    name: 'AngelList Startup Jobs',
    description: 'Startup job opportunities',
    pattern: 'site:angel.co intitle:"{keywords}" OR site:wellfound.com intitle:"{keywords}"',
    keywords: ['startup', 'engineer', 'developer'],
  },

  // Remote-specific job boards
  {
    id: 'remoteok-jobs',
    name: 'Remote OK Jobs',
    description: 'Remote job opportunities',
    pattern: 'site:remoteok.io intitle:"{keywords}"',
    site: 'remoteok.io',
    keywords: ['remote', 'developer', 'engineer'],
  },

  {
    id: 'weworkremotely-jobs',
    name: 'We Work Remotely',
    description: 'Remote work opportunities',
    pattern: 'site:weworkremotely.com intitle:"{keywords}"',
    site: 'weworkremotely.com',
    keywords: ['remote', 'developer', 'programming'],
  },

  // Tech company career pages
  {
    id: 'company-careers',
    name: 'Company Career Pages',
    description: 'Direct company job postings',
    pattern: 'inurl:careers OR inurl:jobs intitle:"{keywords}" {company}',
    keywords: ['software engineer', 'developer'],
  },

  // General file type searches
  {
    id: 'job-pdfs',
    name: 'Job Description PDFs',
    description: 'Job descriptions in PDF format',
    pattern: 'filetype:pdf intitle:"{keywords}" "job description"',
    fileTypes: ['pdf'],
    keywords: ['software engineer', 'job description'],
  },

  // University job boards
  {
    id: 'university-jobs',
    name: 'University Job Boards',
    description: 'Academic and research positions',
    pattern: 'site:*.edu inurl:jobs intitle:"{keywords}"',
    keywords: ['research', 'professor', 'postdoc'],
  },

  // Government jobs
  {
    id: 'government-jobs',
    name: 'Government Job Postings',
    description: 'Government and public sector jobs',
    pattern: 'site:*.gov inurl:jobs intitle:"{keywords}"',
    keywords: ['software', 'it specialist', 'developer'],
  },
];

/**
 * Tech keyword variations for different programming roles
 */
export const TECH_KEYWORDS = {
  // Programming languages
  languages: [
    'javascript',
    'typescript',
    'python',
    'java',
    'c++',
    'c#',
    'go',
    'rust',
    'php',
    'ruby',
    'swift',
    'kotlin',
    'scala',
    'r',
    'perl',
    'bash',
  ],

  // Frameworks and libraries
  frameworks: [
    'react',
    'angular',
    'vue',
    'svelte',
    'node.js',
    'express',
    'django',
    'flask',
    'spring',
    'rails',
    'laravel',
    'symfony',
    '.net',
    'asp.net',
  ],

  // Technologies and tools
  technologies: [
    'aws',
    'azure',
    'gcp',
    'docker',
    'kubernetes',
    'terraform',
    'jenkins',
    'git',
    'mongodb',
    'postgresql',
    'mysql',
    'redis',
    'elasticsearch',
  ],

  // Job roles
  roles: [
    'software engineer',
    'web developer',
    'full stack developer',
    'frontend developer',
    'backend developer',
    'devops engineer',
    'data scientist',
    'machine learning engineer',
    'mobile developer',
    'qa engineer',
    'test engineer',
    'security engineer',
    'architect',
  ],

  // Experience levels
  levels: [
    'junior',
    'senior',
    'lead',
    'principal',
    'staff',
    'entry level',
    'mid level',
    'experienced',
    'expert',
    'architect',
  ],
};

/**
 * Location-specific search modifiers
 */
export const LOCATION_MODIFIERS = {
  // Major tech hubs
  cities: [
    'San Francisco',
    'New York',
    'Seattle',
    'Austin',
    'Boston',
    'Los Angeles',
    'Chicago',
    'Denver',
    'Portland',
    'Atlanta',
  ],

  // Countries
  countries: [
    'United States',
    'Canada',
    'United Kingdom',
    'Germany',
    'Netherlands',
    'Australia',
    'Singapore',
    'India',
  ],

  // Remote work indicators
  remote: [
    'remote',
    'work from home',
    'distributed',
    'anywhere',
    'location independent',
    'virtual',
  ],
};

/**
 * Build a Google Dork search query from pattern and parameters
 */
export function buildDorkQuery(
  pattern: DorkPattern,
  keywords: string[],
  location?: string,
  company?: string,
  options: {
    excludeKeywords?: string[];
    dateRange?: string;
    fileType?: string;
  } = {},
): string {
  let query = pattern.pattern;

  // Replace keywords
  const keywordString = keywords.join(' OR ');
  query = query.replace('{keywords}', keywordString);

  // Replace location
  if (location && query.includes('{location}')) {
    query = query.replace('{location}', `"${location}"`);
  } else {
    query = query.replace('{location}', '');
  }

  // Replace company
  if (company && query.includes('{company}')) {
    query = query.replace('{company}', `"${company}"`);
  } else {
    query = query.replace('{company}', '');
  }

  // Add exclusions
  if (options.excludeKeywords?.length) {
    const exclusions = options.excludeKeywords.map((kw) => `-"${kw}"`).join(' ');
    query += ` ${exclusions}`;
  }

  // Add date range if specified
  if (options.dateRange) {
    query += ` after:${options.dateRange}`;
  }

  // Add file type if specified
  if (options.fileType) {
    query += ` filetype:${options.fileType}`;
  }

  return query.replace(/\s+/g, ' ').trim();
}

/**
 * Get recommended dorks for specific job criteria
 */
export function getRecommendedDorks(criteria: {
  keywords: string[];
  location?: string;
  remote?: boolean;
  company?: string;
}): DorkPattern[] {
  const { keywords, remote, company } = criteria;

  // Start with general job board dorks
  let recommended = JOB_DORKS.filter((dork) =>
    ['linkedin-jobs', 'indeed-jobs', 'glassdoor-jobs'].includes(dork.id),
  );

  // Add remote-specific dorks if remote work is preferred
  if (remote) {
    recommended = recommended.concat(
      JOB_DORKS.filter((dork) => ['remoteok-jobs', 'weworkremotely-jobs'].includes(dork.id)),
    );
  }

  // Add tech-specific dorks if tech keywords are present
  const hasTechKeywords = keywords.some(
    (kw) =>
      TECH_KEYWORDS.languages.includes(kw.toLowerCase()) ||
      TECH_KEYWORDS.frameworks.includes(kw.toLowerCase()) ||
      TECH_KEYWORDS.roles.includes(kw.toLowerCase()),
  );

  if (hasTechKeywords) {
    recommended.push(
      ...JOB_DORKS.filter((dork) => ['stackoverflow-jobs', 'angellist-jobs'].includes(dork.id)),
    );
  }

  // Add company-specific dork if company is specified
  if (company) {
    const companyDork = JOB_DORKS.find((dork) => dork.id === 'company-careers');
    if (companyDork) {
      recommended.push(companyDork);
    }
  }

  return recommended;
}
