/**
 * Production Security Configuration
 * Centralized security policies for staging/production deployment
 */

export class SecurityConfig {
  // Content Security Policy for production
  static readonly CSP = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'connect-src': ["'self'", 'wss:', 'ws:'],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
  };

  // Trusted domains for PostMessage
  static readonly TRUSTED_ORIGINS = [
    'self',
    'https://jobsearchpro.com',
    'https://api.jobsearchpro.com',
  ];

  // Input validation patterns
  static readonly PATTERNS = {
    jobId: /^[a-zA-Z0-9-_]{1,50}$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    skillName: /^[a-zA-Z0-9\s\-\+\#\.]{1,100}$/,
    companyName: /^[a-zA-Z0-9\s\-\&\,\.]{1,200}$/,
  };

  // Sanitize all user inputs before template insertion
  static sanitizeForTemplate(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[<>&"']/g, (char) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#x27;',
      };
      return entities[char] || char;
    });
  }

  // Validate input against patterns
  static validate(input: string, pattern: keyof typeof SecurityConfig.PATTERNS): boolean {
    return SecurityConfig.PATTERNS[pattern].test(input);
  }
}
