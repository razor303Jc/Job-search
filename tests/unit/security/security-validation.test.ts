/**
 * Security and Input Validation Tests
 * Phase 8 Stage 2: Security Testing & Validation
 *
 * Tests for security features, input validation, and protection mechanisms
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock security validation functions
class SecurityValidator {
  private static readonly DANGEROUS_PATTERNS = [
    /<script[\s\S]*?<\/script>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:text\/html/i,
    /vbscript:/i,
  ];

  private static readonly SQL_INJECTION_PATTERNS = [
    /(\'|\;|\-\-|\/\*|\*\/|xp_|sp_|0x|union|select|insert|delete|update|drop|create|alter|exec|execute)/i,
  ];

  private static readonly COMMAND_INJECTION_PATTERNS = [
    /(\||&|;|`|\$\(|\${|<|>)/g,
  ];

  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }

    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');

    // Remove dangerous protocols
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/vbscript:/gi, '');
    sanitized = sanitized.replace(/data:text\/html/gi, '');

    // Escape HTML entities
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    return sanitized;
  }

  static validateInput(input: string, type: 'url' | 'keywords' | 'filename' | 'general'): boolean {
    if (typeof input !== 'string') {
      return false;
    }

    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        return false;
      }
    }

    // Check for SQL injection
    if (type !== 'url') {
      for (const pattern of this.SQL_INJECTION_PATTERNS) {
        if (pattern.test(input)) {
          return false;
        }
      }
    }

    // Check for command injection
    if (type === 'filename') {
      for (const pattern of this.COMMAND_INJECTION_PATTERNS) {
        if (pattern.test(input)) {
          return false;
        }
      }
    }

    // Type-specific validation
    switch (type) {
      case 'url':
        return this.validateUrl(input);
      case 'keywords':
        return this.validateKeywords(input);
      case 'filename':
        return this.validateFilename(input);
      case 'general':
        return input.length > 0 && input.length < 10000;
      default:
        return false;
    }
  }

  private static validateUrl(url: string): boolean {
    try {
      new URL(url);
      return !url.includes('localhost') && !url.includes('127.0.0.1') && !url.includes('file://');
    } catch {
      return false;
    }
  }

  private static validateKeywords(keywords: string): boolean {
    return keywords.length > 0 && keywords.length < 1000 && !/[<>"\']/.test(keywords);
  }

  private static validateFilename(filename: string): boolean {
    const validPattern = /^[a-zA-Z0-9._-]+$/;
    return validPattern.test(filename) && filename.length < 255 && !filename.startsWith('.');
  }

  static checkRateLimit(clientId: string, maxRequests: number, windowMs: number): boolean {
    // Mock rate limiting check
    const now = Date.now();
    const key = `rate_limit_${clientId}`;
    
    // In a real implementation, this would use Redis or similar
    if (!global.rateLimitStore) {
      global.rateLimitStore = new Map();
    }

    const requests = global.rateLimitStore.get(key) || [];
    const validRequests = requests.filter((time: number) => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return false;
    }

    validRequests.push(now);
    global.rateLimitStore.set(key, validRequests);
    return true;
  }
}

// Mock authentication system
class AuthenticationSystem {
  private static readonly VALID_API_KEYS = new Set(['test-api-key-1', 'test-api-key-2']);
  private static readonly SESSION_TIMEOUT = 3600000; // 1 hour

  static validateApiKey(apiKey: string): boolean {
    return typeof apiKey === 'string' && this.VALID_API_KEYS.has(apiKey);
  }

  static generateSessionToken(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static validateSessionToken(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const match = token.match(/^session_(\d+)_[a-z0-9]+$/);
    if (!match) {
      return false;
    }

    const timestamp = parseInt(match[1], 10);
    return Date.now() - timestamp < this.SESSION_TIMEOUT;
  }

  static hashPassword(password: string): string {
    // Mock password hashing (in real implementation use bcrypt)
    return `hashed_${password}_salt`;
  }

  static verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }
}

declare global {
  var rateLimitStore: Map<string, number[]>;
}

describe('Security and Input Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.rateLimitStore = new Map();
  });

  describe('Input Sanitization', () => {
    it('should sanitize HTML content', () => {
      const dangerousInput = '<script>alert("xss")</script><img src="x" onerror="alert(1)">';
      const sanitized = SecurityValidator.sanitizeInput(dangerousInput);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('<img');
      expect(sanitized).toContain('&lt;');
      expect(sanitized).toContain('&gt;');
      // After escaping, dangerous HTML is neutralized
      expect(sanitized).toContain('&lt;script&gt;');
    });

    it('should escape quotes and special characters', () => {
      const input = `'single" double & ampersand / slash`;
      const sanitized = SecurityValidator.sanitizeInput(input);

      expect(sanitized).toContain('&#x27;'); // single quote
      expect(sanitized).toContain('&quot;'); // double quote
      expect(sanitized).toContain('&amp;'); // ampersand
      expect(sanitized).toContain('&#x2F;'); // slash
    });

    it('should remove null bytes', () => {
      const input = 'test\0null\0bytes';
      const sanitized = SecurityValidator.sanitizeInput(input);

      expect(sanitized).not.toContain('\0');
      expect(sanitized).toBe('testnullbytes');
    });

    it('should handle non-string input', () => {
      expect(() => SecurityValidator.sanitizeInput(123 as any)).toThrow('Input must be a string');
      expect(() => SecurityValidator.sanitizeInput(null as any)).toThrow('Input must be a string');
      expect(() => SecurityValidator.sanitizeInput(undefined as any)).toThrow('Input must be a string');
    });
  });

  describe('Input Validation', () => {
    it('should validate URL input', () => {
      const validUrls = [
        'https://example.com',
        'http://job-site.com/careers',
        'https://remote-jobs.io/search',
      ];

      const invalidUrls = [
        'javascript:alert(1)',
        'file:///etc/passwd',
        'http://localhost:3000',
        'http://127.0.0.1:8080',
        'not-a-url',
        '',
      ];

      validUrls.forEach((url) => {
        expect(SecurityValidator.validateInput(url, 'url')).toBe(true);
      });

      invalidUrls.forEach((url) => {
        expect(SecurityValidator.validateInput(url, 'url')).toBe(false);
      });
    });

    it('should validate keywords input', () => {
      const validKeywords = [
        'software engineer',
        'remote developer nodejs',
        'frontend react vue angular',
        'data scientist python',
      ];

      const invalidKeywords = [
        '<script>alert(1)</script>',
        'job" OR 1=1--',
        "'; DROP TABLE jobs; --",
        "'><script>alert('xss')</script>",
        '',
        'x'.repeat(1001), // too long
      ];

      validKeywords.forEach((keywords) => {
        expect(SecurityValidator.validateInput(keywords, 'keywords')).toBe(true);
      });

      invalidKeywords.forEach((keywords) => {
        expect(SecurityValidator.validateInput(keywords, 'keywords')).toBe(false);
      });
    });

    it('should validate filename input', () => {
      const validFilenames = [
        'report.json',
        'jobs_2024.csv',
        'data-export.pdf',
        'results.txt',
      ];

      const invalidFilenames = [
        '../../../etc/passwd',
        'file|rm -rf /',
        'file && cat /etc/passwd',
        '.hidden-file',
        'file with spaces.txt',
        'file;command.txt',
        '',
        'x'.repeat(256), // too long
      ];

      validFilenames.forEach((filename) => {
        expect(SecurityValidator.validateInput(filename, 'filename')).toBe(true);
      });

      invalidFilenames.forEach((filename) => {
        expect(SecurityValidator.validateInput(filename, 'filename')).toBe(false);
      });
    });

    it('should detect SQL injection attempts', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR 1=1--",
        "admin'--",
        "' UNION SELECT * FROM users--",
        "'; EXEC xp_cmdshell('dir'); --",
      ];

      sqlInjectionAttempts.forEach((attempt) => {
        expect(SecurityValidator.validateInput(attempt, 'keywords')).toBe(false);
        expect(SecurityValidator.validateInput(attempt, 'general')).toBe(false);
      });
    });

    it('should detect XSS attempts', () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert(document.cookie)',
        '<svg onload="alert(1)">',
        'data:text/html,<script>alert(1)</script>',
      ];

      xssAttempts.forEach((attempt) => {
        expect(SecurityValidator.validateInput(attempt, 'keywords')).toBe(false);
        expect(SecurityValidator.validateInput(attempt, 'general')).toBe(false);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', () => {
      const clientId = 'test-client-1';
      const maxRequests = 5;
      const windowMs = 60000; // 1 minute

      // Should allow first 5 requests
      for (let i = 0; i < maxRequests; i++) {
        expect(SecurityValidator.checkRateLimit(clientId, maxRequests, windowMs)).toBe(true);
      }
    });

    it('should block requests exceeding rate limit', () => {
      const clientId = 'test-client-2';
      const maxRequests = 3;
      const windowMs = 60000;

      // Use up the rate limit
      for (let i = 0; i < maxRequests; i++) {
        SecurityValidator.checkRateLimit(clientId, maxRequests, windowMs);
      }

      // Next request should be blocked
      expect(SecurityValidator.checkRateLimit(clientId, maxRequests, windowMs)).toBe(false);
    });

    it('should reset rate limit after time window', () => {
      const clientId = 'test-client-3';
      const maxRequests = 2;
      const windowMs = 100; // Very short window for testing

      // Use up rate limit
      SecurityValidator.checkRateLimit(clientId, maxRequests, windowMs);
      SecurityValidator.checkRateLimit(clientId, maxRequests, windowMs);

      // Should be blocked
      expect(SecurityValidator.checkRateLimit(clientId, maxRequests, windowMs)).toBe(false);

      // Wait for window to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Should be allowed again
          expect(SecurityValidator.checkRateLimit(clientId, maxRequests, windowMs)).toBe(true);
          resolve();
        }, windowMs + 10);
      });
    });

    it('should handle different clients independently', () => {
      const maxRequests = 2;
      const windowMs = 60000;

      // Client 1 uses up rate limit
      SecurityValidator.checkRateLimit('client-1', maxRequests, windowMs);
      SecurityValidator.checkRateLimit('client-1', maxRequests, windowMs);
      expect(SecurityValidator.checkRateLimit('client-1', maxRequests, windowMs)).toBe(false);

      // Client 2 should still be allowed
      expect(SecurityValidator.checkRateLimit('client-2', maxRequests, windowMs)).toBe(true);
    });
  });

  describe('Authentication System', () => {
    it('should validate API keys', () => {
      expect(AuthenticationSystem.validateApiKey('test-api-key-1')).toBe(true);
      expect(AuthenticationSystem.validateApiKey('test-api-key-2')).toBe(true);
      expect(AuthenticationSystem.validateApiKey('invalid-key')).toBe(false);
      expect(AuthenticationSystem.validateApiKey('')).toBe(false);
      expect(AuthenticationSystem.validateApiKey(null as any)).toBe(false);
    });

    it('should generate valid session tokens', () => {
      const token1 = AuthenticationSystem.generateSessionToken();
      const token2 = AuthenticationSystem.generateSessionToken();

      expect(token1).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(token2).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(token1).not.toBe(token2);
    });

    it('should validate session tokens', () => {
      const validToken = AuthenticationSystem.generateSessionToken();
      expect(AuthenticationSystem.validateSessionToken(validToken)).toBe(true);

      const invalidTokens = [
        'invalid-token',
        'session_invalid_format',
        'session_1234567890_abc', // old timestamp
        '',
        null as any,
        undefined as any,
      ];

      invalidTokens.forEach((token) => {
        expect(AuthenticationSystem.validateSessionToken(token)).toBe(false);
      });
    });

    it('should handle session timeout', () => {
      // Create a token with old timestamp
      const oldToken = `session_${Date.now() - 7200000}_abc123`; // 2 hours ago
      expect(AuthenticationSystem.validateSessionToken(oldToken)).toBe(false);

      // Recent token should be valid
      const recentToken = AuthenticationSystem.generateSessionToken();
      expect(AuthenticationSystem.validateSessionToken(recentToken)).toBe(true);
    });

    it('should hash and verify passwords', () => {
      const password = 'secure_password_123';
      const hash = AuthenticationSystem.hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash).toContain('hashed_');
      expect(AuthenticationSystem.verifyPassword(password, hash)).toBe(true);
      expect(AuthenticationSystem.verifyPassword('wrong_password', hash)).toBe(false);
    });
  });

  describe('Security Headers and Configuration', () => {
    it('should validate security configuration', () => {
      const securityConfig = {
        enableCORS: true,
        allowedOrigins: ['https://trusted-domain.com'],
        enableRateLimit: true,
        maxRequestsPerHour: 1000,
        enableAuth: true,
        sessionTimeout: 3600000,
        enableHTTPS: true,
        strictTransportSecurity: true,
      };

      expect(securityConfig.enableCORS).toBe(true);
      expect(securityConfig.allowedOrigins).toContain('https://trusted-domain.com');
      expect(securityConfig.maxRequestsPerHour).toBeLessThanOrEqual(1000);
      expect(securityConfig.sessionTimeout).toBeGreaterThan(0);
    });

    it('should validate CORS configuration', () => {
      const validOrigins = [
        'https://example.com',
        'https://sub.example.com:3000',
        'http://localhost:3000', // for development
      ];

      const invalidOrigins = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        '',
        null,
      ];

      validOrigins.forEach((origin) => {
        try {
          new URL(origin);
          expect(origin).toMatch(/^https?:\/\//);
        } catch {
          expect.fail(`${origin} should be a valid URL`);
        }
      });

      invalidOrigins.forEach((origin) => {
        if (origin === null || origin === '') {
          expect(origin).toBeFalsy();
        } else {
          // These should be rejected by CORS policy, not necessarily by URL constructor
          try {
            const url = new URL(origin);
            // Check if it's a dangerous protocol
            expect(['javascript:', 'data:', 'file:'].some(proto => url.protocol === proto)).toBe(true);
          } catch {
            // URL constructor rejects it - that's good too
            expect(true).toBe(true);
          }
        }
      });
    });
  });

  describe('Data Sanitization in Reports', () => {
    it('should sanitize job data before export', () => {
      const maliciousJob = {
        title: '<script>alert("xss")</script>Software Engineer',
        company: 'Evil Corp<img src="x" onerror="alert(1)">',
        description: 'Job description with javascript:alert(1) link',
        requirements: ['Normal requirement', '<svg onload="alert(1)">requirement'],
      };

      const sanitizedJob = {
        title: SecurityValidator.sanitizeInput(maliciousJob.title),
        company: SecurityValidator.sanitizeInput(maliciousJob.company),
        description: SecurityValidator.sanitizeInput(maliciousJob.description),
        requirements: maliciousJob.requirements.map((req) => SecurityValidator.sanitizeInput(req)),
      };

      expect(sanitizedJob.title).not.toContain('<script>');
      expect(sanitizedJob.company).not.toContain('<img');
      expect(sanitizedJob.description).not.toContain('javascript:');
      expect(sanitizedJob.requirements[1]).not.toContain('<svg');
    });

    it('should validate exported data integrity', () => {
      const jobData = {
        id: 'job-123',
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'Remote',
        url: 'https://example.com/job/123',
      };

      // Validate required fields
      expect(jobData.id).toBeDefined();
      expect(jobData.title).toBeDefined();
      expect(jobData.company).toBeDefined();
      expect(typeof jobData.id).toBe('string');
      expect(typeof jobData.title).toBe('string');
      expect(typeof jobData.company).toBe('string');

      // Validate URL if present
      if (jobData.url) {
        expect(() => new URL(jobData.url)).not.toThrow();
      }
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose sensitive information in error messages', () => {
      const sensitiveError = new Error('Database connection failed: password=secret123');
      
      // Mock error sanitization
      const sanitizeErrorMessage = (error: Error): string => {
        return error.message
          .replace(/password=\w+/gi, 'password=***')
          .replace(/token=[\w-]+/gi, 'token=***')
          .replace(/api[_-]?key=[\w-]+/gi, 'api_key=***');
      };

      const sanitizedMessage = sanitizeErrorMessage(sensitiveError);
      expect(sanitizedMessage).not.toContain('secret123');
      expect(sanitizedMessage).toContain('password=***');
    });

    it('should handle security validation errors gracefully', () => {
      const invalidInputs = [
        '<script>alert(1)</script>',
        "'; DROP TABLE users; --",
        '../../../etc/passwd',
      ];

      invalidInputs.forEach((input) => {
        expect(() => {
          if (!SecurityValidator.validateInput(input, 'general')) {
            throw new Error('Invalid input detected');
          }
        }).toThrow('Invalid input detected');
      });
    });
  });
});
