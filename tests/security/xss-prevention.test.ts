/**
 * XSS Prevention Tests for Staging Readiness
 * Validates that all user input is properly sanitized
 */

import { describe, test, expect, vi } from 'vitest';
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
      // Mock minimal DOM environment for Node.js testing
      const mockElement = {
        textContent: '',
        appendChild: vi.fn()
      };

      const mockTempElement = {
        innerHTML: '',
        firstChild: { nodeName: 'SPAN' }, // Start with a child node
        appendChild: vi.fn()
      };

      // After first appendChild call, simulate removing the child
      let callCount = 0;
      Object.defineProperty(mockTempElement, 'firstChild', {
        get: () => {
          callCount++;
          return callCount === 1 ? { nodeName: 'SPAN' } : null; // Return null after first access
        }
      });

      const mockDocument = {
        createElement: vi.fn().mockReturnValue(mockTempElement)
      };

      // Mock global document object
      Object.defineProperty(global, 'document', {
        value: mockDocument,
        writable: true
      });
      
      const maliciousHTML = '<img src=x onerror=alert(1)>';

      // Test that SecurityUtils properly sanitizes content
      SecurityUtils.setSecureHTML(mockElement as any, maliciousHTML);

      // Verify document.createElement was called
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      
      // Verify element.textContent was cleared
      expect(mockElement.textContent).toBe('');
      
      // Verify appendChild was called at least once
      expect(mockElement.appendChild).toHaveBeenCalled();

      // The temp element should have received sanitized HTML (dangerous attributes removed)
      expect(mockTempElement.innerHTML).not.toContain('onerror'); // Event handler should be removed
      expect(mockTempElement.innerHTML).toContain('<img src=x'); // Safe part should remain
    });
  });
});
