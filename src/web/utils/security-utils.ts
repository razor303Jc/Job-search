/**
 * Security utilities for safe DOM manipulation
 */

export class SecurityUtils {
  /**
   * Safely set HTML content by sanitizing it first
   * @param element - Target DOM element
   * @param htmlContent - HTML content to set (will be sanitized)
   */
  static setSecureHTML(element: HTMLElement, htmlContent: string): void {
    // Remove potentially dangerous elements and attributes
    const sanitized = SecurityUtils.sanitizeHTML(htmlContent);

    // Clear existing content
    element.textContent = '';

    // Create temporary container for parsing
    const temp = document.createElement('div');
    temp.innerHTML = sanitized;

    // Move sanitized nodes to target element
    while (temp.firstChild) {
      element.appendChild(temp.firstChild);
    }
  }

  /**
   * Sanitize HTML content to prevent XSS attacks
   * @param html - Raw HTML content
   * @returns Sanitized HTML content
   */
  static sanitizeHTML(html: string): string {
    // Basic XSS prevention - remove script tags and dangerous attributes
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick, onload, etc.
      .replace(/data:/gi, '') // Remove data: protocols
      .replace(/vbscript:/gi, '') // Remove vbscript: protocols
      .replace(/<iframe\b[^>]*>/gi, '') // Remove iframe tags
      .replace(/<object\b[^>]*>/gi, '') // Remove object tags
      .replace(/<embed\b[^>]*>/gi, '') // Remove embed tags
      .replace(/<form\b[^>]*>/gi, '') // Remove form tags
      .replace(/<input\b[^>]*>/gi, '') // Remove input tags
      .replace(/style\s*=\s*["'][^"']*["']/gi, ''); // Remove inline styles
  }

  /**
   * Safely set text content (no HTML parsing)
   * @param element - Target DOM element
   * @param textContent - Text content to set
   */
  static setSecureText(element: HTMLElement, textContent: string): void {
    element.textContent = textContent;
  }

  /**
   * Validate PostMessage origin
   * @param event - MessageEvent
   * @param allowedOrigins - Array of allowed origins
   * @returns True if origin is allowed
   */
  static validatePostMessageOrigin(event: MessageEvent, allowedOrigins: string[]): boolean {
    if (!event.origin) {
      return false;
    }

    return (
      allowedOrigins.includes(event.origin) ||
      allowedOrigins.includes('*') ||
      (allowedOrigins.includes('self') && event.origin === window.location.origin)
    );
  }

  /**
   * Escape HTML characters to prevent XSS
   * @param unsafe - Unsafe string that may contain HTML
   * @returns Escaped string safe for HTML insertion
   */
  static escapeHTML(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Create a safe DOM element with text content
   * @param tagName - HTML tag name
   * @param textContent - Text content (will be escaped)
   * @param attributes - Safe attributes to set
   * @returns Created DOM element
   */
  static createSecureElement(
    tagName: string,
    textContent?: string,
    attributes?: Record<string, string>,
  ): HTMLElement {
    const element = document.createElement(tagName);

    if (textContent) {
      element.textContent = textContent;
    }

    if (attributes) {
      // Only allow safe attributes
      const safeAttributes = ['class', 'id', 'data-*', 'aria-*', 'role', 'title', 'alt'];

      for (const [key, value] of Object.entries(attributes)) {
        const isSafe = safeAttributes.some((safe) =>
          safe.endsWith('*') ? key.startsWith(safe.slice(0, -1)) : key === safe,
        );

        if (isSafe) {
          element.setAttribute(key, value);
        }
      }
    }

    return element;
  }
}
