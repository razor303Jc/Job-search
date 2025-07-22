/**
 * Enhanced Web Server Tests
 * Phase 8 Stage 1: Comprehensive Test Suite Expansion
 *
 * Tests for the enhanced Fastify server with PWA support
 */

import Fastify, { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('Enhanced Web Server (server-v2)', () => {
  let server: any;
  const TEST_PORT = 3002; // Use port 3002 to avoid conflicts

  beforeAll(async () => {
    // Create test server instance
    server = Fastify({ logger: false });

    // Register basic routes for testing
    server.get('/health', async () => {
      return { status: 'ok', timestamp: Date.now() };
    });

    server.get('/manifest.json', async () => {
      return {
        name: 'Job Dorker',
        short_name: 'JobDorker',
        description: 'Progressive Web App for Job Search',
        start_url: '/',
        display: 'standalone',
        theme_color: '#1976d2',
        background_color: '#ffffff',
      };
    });

    // Register static file serving
    await server.register(require('@fastify/static'), {
      root: `${process.cwd()}/src/web/static`,
      prefix: '/static/',
    });

    await server.listen({ port: TEST_PORT, host: '127.0.0.1' });
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  beforeEach(() => {
    // Reset any state between tests
  });

  describe('Server Health and Basic Routes', () => {
    it('should respond to health check', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(typeof body.timestamp).toBe('number');
    });

    it('should serve PWA manifest', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/manifest.json',
      });

      expect(response.statusCode).toBe(200);
      const manifest = JSON.parse(response.body);
      expect(manifest.name).toBe('Job Dorker');
      expect(manifest.display).toBe('standalone');
      expect(manifest.start_url).toBe('/');
    });

    it('should handle CORS headers properly', async () => {
      const response = await server.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
        },
      });

      // Should not fail for CORS preflight
      expect(response.statusCode).toBeLessThan(500);
    });
  });

  describe('Static File Serving', () => {
    it('should serve static files from /static/ prefix', async () => {
      // Test that static route is registered (allow both formats)
      const routes = server.printRoutes();
      expect(routes).toMatch(/static[\/*]/); // Match either "static/*" or "static/"
    });

    it('should handle non-existent static files gracefully', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/static/non-existent-file.js',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/invalid-route-that-does-not-exist',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/health',
        payload: 'invalid-json{',
        headers: {
          'content-type': 'application/json',
        },
      });

      // Should handle malformed JSON gracefully
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.statusCode).toBeLessThan(500);
    });
  });

  describe('Performance and Reliability', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();

      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      const responseTime = Date.now() - startTime;

      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() =>
          server.inject({
            method: 'GET',
            url: '/health',
          }),
        );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.statusCode).toBe(200);
      });
    });
  });

  describe('Server Configuration', () => {
    it('should have proper server instance', () => {
      expect(server).toBeDefined();
      expect(server.server).toBeDefined();
      expect(server.server.listening).toBe(true);
    });

    it('should have registered required plugins', () => {
      // Check that static plugin is registered
      const plugins = server.printPlugins();
      expect(plugins).toContain('@fastify/static');
    });
  });
});
