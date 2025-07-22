/**
 * Push Notification API Routes
 * Handles PWA push notification subscription and management
 * Stage 6 PWA Implementation - Phase 7
 */

const pushService = require('../../services/push-notification-service');

async function pushRoutes(fastify, _options) {
  /**
   * Subscribe to push notifications
   * POST /api/v2/push/subscribe
   */
  fastify.post(
    '/subscribe',
    {
      schema: {
        body: {
          type: 'object',
          required: ['subscription'],
          properties: {
            subscription: {
              type: 'object',
              required: ['endpoint', 'keys'],
              properties: {
                endpoint: { type: 'string' },
                keys: {
                  type: 'object',
                  required: ['p256dh', 'auth'],
                  properties: {
                    p256dh: { type: 'string' },
                    auth: { type: 'string' },
                  },
                },
              },
            },
            userAgent: { type: 'string' },
            timestamp: { type: 'number' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              subscriptionId: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { subscription, userAgent } = request.body;

        const subscriptionId = await pushService.addSubscription(
          subscription,
          userAgent || request.headers['user-agent'],
        );

        reply.send({
          success: true,
          subscriptionId: subscriptionId,
          message: 'Push subscription added successfully',
        });
      } catch (error) {
        console.error('[Push API] Subscription failed:', error);
        reply.code(500).send({
          success: false,
          error: 'Failed to add push subscription',
          details: error.message,
        });
      }
    },
  );

  /**
   * Unsubscribe from push notifications
   * DELETE /api/v2/push/subscribe/:subscriptionId
   */
  fastify.delete(
    '/subscribe/:subscriptionId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string' },
          },
          required: ['subscriptionId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { subscriptionId } = request.params;

        const removed = await pushService.removeSubscription(subscriptionId);

        if (removed) {
          reply.send({
            success: true,
            message: 'Push subscription removed successfully',
          });
        } else {
          reply.code(404).send({
            success: false,
            error: 'Subscription not found',
          });
        }
      } catch (error) {
        console.error('[Push API] Unsubscribe failed:', error);
        reply.code(500).send({
          success: false,
          error: 'Failed to remove push subscription',
          details: error.message,
        });
      }
    },
  );

  /**
   * Send test notification
   * POST /api/v2/push/test/:subscriptionId
   */
  fastify.post(
    '/test/:subscriptionId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string' },
          },
          required: ['subscriptionId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { subscriptionId } = request.params;

        await pushService.sendTestNotification(subscriptionId);

        reply.send({
          success: true,
          message: 'Test notification sent successfully',
        });
      } catch (error) {
        console.error('[Push API] Test notification failed:', error);
        reply.code(500).send({
          success: false,
          error: 'Failed to send test notification',
          details: error.message,
        });
      }
    },
  );

  /**
   * Send job alert notification
   * POST /api/v2/push/job-alert
   */
  fastify.post(
    '/job-alert',
    {
      schema: {
        body: {
          type: 'object',
          required: ['jobData'],
          properties: {
            jobData: {
              type: 'object',
              required: ['id', 'title', 'company'],
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                company: { type: 'string' },
                location: { type: 'string' },
                salary: { type: 'string' },
              },
            },
            targetSubscriptions: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              results: {
                type: 'object',
                properties: {
                  success: { type: 'number' },
                  failed: { type: 'number' },
                  expired: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { jobData, targetSubscriptions } = request.body;

        const results = await pushService.sendJobAlert(jobData, targetSubscriptions);

        reply.send({
          success: true,
          results: results,
        });
      } catch (error) {
        console.error('[Push API] Job alert failed:', error);
        reply.code(500).send({
          success: false,
          error: 'Failed to send job alert',
          details: error.message,
        });
      }
    },
  );

  /**
   * Send scraping status notification
   * POST /api/v2/push/scraping-status
   */
  fastify.post(
    '/scraping-status',
    {
      schema: {
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'object',
              required: ['completed', 'found'],
              properties: {
                completed: { type: 'boolean' },
                found: { type: 'number' },
                errors: { type: 'number' },
                duration: { type: 'number' },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { status } = request.body;

        const results = await pushService.sendScrapingStatus(status);

        reply.send({
          success: true,
          results: results,
        });
      } catch (error) {
        console.error('[Push API] Scraping status notification failed:', error);
        reply.code(500).send({
          success: false,
          error: 'Failed to send scraping status',
          details: error.message,
        });
      }
    },
  );

  /**
   * Send weekly summary notification
   * POST /api/v2/push/weekly-summary
   */
  fastify.post(
    '/weekly-summary',
    {
      schema: {
        body: {
          type: 'object',
          required: ['summaryData'],
          properties: {
            summaryData: {
              type: 'object',
              required: ['newJobs', 'applications'],
              properties: {
                newJobs: { type: 'number' },
                applications: { type: 'number' },
                interviews: { type: 'number' },
                saves: { type: 'number' },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { summaryData } = request.body;

        const results = await pushService.sendWeeklySummary(summaryData);

        reply.send({
          success: true,
          results: results,
        });
      } catch (error) {
        console.error('[Push API] Weekly summary notification failed:', error);
        reply.code(500).send({
          success: false,
          error: 'Failed to send weekly summary',
          details: error.message,
        });
      }
    },
  );

  /**
   * Get push notification statistics
   * GET /api/v2/push/stats
   */
  fastify.get(
    '/stats',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              active: { type: 'number' },
              recentlyUsed: { type: 'number' },
              vapidConfigured: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      try {
        const stats = pushService.getStats();

        reply.send(stats);
      } catch (error) {
        console.error('[Push API] Stats request failed:', error);
        reply.code(500).send({
          success: false,
          error: 'Failed to get push notification stats',
          details: error.message,
        });
      }
    },
  );

  /**
   * Clean up expired subscriptions
   * POST /api/v2/push/cleanup
   */
  fastify.post(
    '/cleanup',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              cleaned: { type: 'number' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      try {
        const cleaned = await pushService.cleanupExpiredSubscriptions();

        reply.send({
          success: true,
          cleaned: cleaned,
          message: `Cleaned up ${cleaned} expired subscriptions`,
        });
      } catch (error) {
        console.error('[Push API] Cleanup failed:', error);
        reply.code(500).send({
          success: false,
          error: 'Failed to cleanup expired subscriptions',
          details: error.message,
        });
      }
    },
  );

  /**
   * Get VAPID public key
   * GET /api/v2/push/vapid-key
   */
  fastify.get(
    '/vapid-key',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              publicKey: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      try {
        reply.send({
          publicKey: process.env.VAPID_PUBLIC_KEY || 'BExample-VAPID-Public-Key-Here',
        });
      } catch (error) {
        console.error('[Push API] VAPID key request failed:', error);
        reply.code(500).send({
          success: false,
          error: 'Failed to get VAPID key',
        });
      }
    },
  );
}

module.exports = pushRoutes;
