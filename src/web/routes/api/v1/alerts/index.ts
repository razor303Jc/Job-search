/**
 * Job Alerts API Routes
 * Provides REST endpoints for managing job alerts and notifications
 */

import { DatabaseAlertService } from '@/services/alert-service.js';
import type { AlertCriteria } from '@/services/alert-service.js';
import { NodemailerEmailService } from '@/services/email-service.js';
import { type AuthenticatedRequest, authMiddleware } from '@/web/middleware/auth.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

interface CreateAlertRequest {
  Body: {
    name: string;
    criteria: AlertCriteria;
    frequency?: 'immediate' | 'hourly' | 'daily' | 'weekly';
  };
}

interface UpdateAlertRequest {
  Params: {
    alertId: string;
  };
  Body: {
    name?: string;
    criteria?: AlertCriteria;
    frequency?: 'immediate' | 'hourly' | 'daily' | 'weekly';
    isActive?: boolean;
  };
}

interface DeleteAlertRequest {
  Params: {
    alertId: string;
  };
}

interface GetUserAlertsRequest {
  Params: {
    userId: string;
  };
}

interface ProcessAlertsRequest {
  Body: {
    alertId?: string;
  };
}

/**
 * Initialize Alert API service
 */
let alertService: DatabaseAlertService;

async function initializeAlertService(): Promise<void> {
  if (!alertService) {
    const emailService = new NodemailerEmailService();
    alertService = new DatabaseAlertService(undefined, emailService);
  }
}

/**
 * Register alert API routes
 */
export async function registerAlertRoutes(fastify: FastifyInstance): Promise<void> {
  await initializeAlertService();

  // Health check for alerts service
  fastify.get('/api/v1/alerts/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return {
        status: 'healthy',
        service: 'alerts',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };
    } catch (error) {
      reply.code(500);
      return {
        status: 'error',
        message: 'Alert service health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Create a new alert - requires authentication
  fastify.post<CreateAlertRequest>(
    '/api/v1/alerts',
    {
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      try {
        const { name, criteria, frequency = 'daily' } = request.body;
        const user = (request as AuthenticatedRequest).user;

        const alert = await alertService.createAlert(user.id, name, criteria, frequency);

        reply.code(201);
        return {
          success: true,
          data: alert,
          message: 'Alert created successfully',
        };
      } catch (error) {
        reply.code(500);
        return {
          success: false,
          message: 'Failed to create alert',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Get all alerts for a user
  fastify.get<GetUserAlertsRequest>('/api/v1/alerts/user/:userId', async (request, reply) => {
    try {
      const { userId } = request.params;
      const alerts = await alertService.getUserAlerts(userId);

      return {
        success: true,
        data: alerts,
        count: alerts.length,
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        message: 'Failed to fetch alerts',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get current user's alerts (using default user for now)
  fastify.get('/api/v1/alerts/my', async (_request, reply) => {
    try {
      // For now, use default user. This should be extracted from authentication
      const userId = 'default-user-123';
      const alerts = await alertService.getUserAlerts(userId);

      return {
        success: true,
        data: alerts,
        count: alerts.length,
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        message: 'Failed to fetch alerts',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Update an alert
  fastify.put<UpdateAlertRequest>('/api/v1/alerts/:alertId', async (request, reply) => {
    try {
      const { alertId } = request.params;
      const updates = request.body;

      const alert = await alertService.updateAlert(alertId, updates);

      return {
        success: true,
        data: alert,
        message: 'Alert updated successfully',
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        message: 'Failed to update alert',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Delete an alert
  fastify.delete<DeleteAlertRequest>('/api/v1/alerts/:alertId', async (request, reply) => {
    try {
      const { alertId } = request.params;
      const success = await alertService.deleteAlert(alertId);

      if (!success) {
        reply.code(404);
        return {
          success: false,
          message: 'Alert not found',
        };
      }

      return {
        success: true,
        message: 'Alert deleted successfully',
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        message: 'Failed to delete alert',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Process alerts (trigger alert checking)
  fastify.post<ProcessAlertsRequest>('/api/v1/alerts/process', async (request, reply) => {
    try {
      const { alertId } = request.body;

      if (alertId) {
        // Get specific alert and trigger it if needed
        const alert = await alertService.getAlert(alertId);
        if (!alert) {
          return reply.code(404).send({
            error: 'Alert not found',
            message: `Alert ${alertId} does not exist`,
          });
        }
        // For individual alerts, we'll just trigger all active alerts since there's no individual trigger method
        await alertService.triggerAlerts();
        return {
          success: true,
          message: 'Alert processing triggered (affects all active alerts)',
        };
      }

      // Process all active alerts
      await alertService.triggerAlerts();
      return {
        success: true,
        message: 'All alerts processed successfully',
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        message: 'Failed to process alerts',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get alert statistics
  fastify.get('/api/v1/alerts/stats', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const authRequest = request as AuthenticatedRequest;
      const stats = await alertService.getUserStats(authRequest.user.id);

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        message: 'Failed to fetch alert statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get alert delivery history
  fastify.get(
    '/api/v1/alerts/deliveries',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;

        // Get all user alerts and then get deliveries for each
        const alerts = await alertService.getUserAlerts(authRequest.user.id);
        const allDeliveries = [];

        for (const alert of alerts) {
          const deliveries = await alertService.getAlertDeliveries(alert.id);
          allDeliveries.push(...deliveries);
        }

        // Sort by delivery date, newest first
        allDeliveries.sort(
          (a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime(),
        );

        return {
          success: true,
          data: allDeliveries,
          count: allDeliveries.length,
        };
      } catch (error) {
        reply.code(500);
        return {
          success: false,
          message: 'Failed to fetch delivery history',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );
}
