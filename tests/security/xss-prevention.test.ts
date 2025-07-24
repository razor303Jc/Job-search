/**
 * XSS Prevention Tests for Staging Readiness
 * Validates that all user input is properly sanitized
 */

import { SecurityConfig } from '../../src/web/utils/security-config.js';
import { SecurityUtils } from '../../src/web/utils/security-utils.js';

describe('XSS Prevention', () => {
  describe('Template Sanitization', () => {
    test('should sanitize HTML entities', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const sanitized = SecurityConfig.sanitizeForTemplate(maliciousInput);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('should handle null and undefined values', () => {
      expect(SecurityConfig.sanitizeForTemplate(null)).toBe('');
      expect(SecurityConfig.sanitizeForTemplate(undefined)).toBe('');
    });

    test('should preserve safe content', () => {
      const safeInput = 'Software Engineer at Google';
      const sanitized = SecurityConfig.sanitizeForTemplate(safeInput);
      expect(sanitized).toBe(safeInput);
    });
  });

  describe('Input Validation', () => {
    test('should validate job IDs', () => {
      expect(SecurityConfig.validate('job-123', 'jobId')).toBe(true);
      expect(SecurityConfig.validate('<script>alert(1)</script>', 'jobId')).toBe(false);
    });

    test('should validate skill names', () => {
      expect(SecurityConfig.validate('JavaScript', 'skillName')).toBe(true);
      expect(SecurityConfig.validate('C++', 'skillName')).toBe(true);
      expect(SecurityConfig.validate('<script>', 'skillName')).toBe(false);
    });
  });

  describe('DOM Manipulation Security', () => {
    test('should use SecurityUtils for DOM updates', () => {
      const mockElement = document.createElement('div');
      const maliciousHTML = '<img src=x onerror=alert(1)>';

      SecurityUtils.setSecureHTML(mockElement, maliciousHTML);

      // Should not contain dangerous attributes
      expect(mockElement.innerHTML).not.toContain('onerror');
      expect(mockElement.innerHTML).not.toContain('alert(1)');
    });
  });
});
