import { dbConnection } from '@/database/connection.js';
import { AuthenticationService } from '@/services/auth-service.js';
import { logger } from '@/utils/logger.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    isActive: boolean;
    emailVerified: boolean;
  };
}

/**
 * Authentication middleware for Fastify routes
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: 'No authorization token',
        message: 'Authorization header with Bearer token is required',
      });
    }

    const token = authHeader.substring(7);

    const db = dbConnection.getDatabase();
    const authService = new AuthenticationService(db);

    const user = await authService.verifyToken(token);

    if (!user) {
      return reply.code(401).send({
        error: 'Invalid or expired token',
        message: 'Please login again',
      });
    }

    if (!user.isActive) {
      return reply.code(403).send({
        error: 'Account is disabled',
        message: 'Your account has been disabled. Please contact support.',
      });
    }

    // Add user to request context
    (request as AuthenticatedRequest).user = {
      id: user.id,
      username: user.username,
      email: user.email,
      ...(user.firstName !== undefined && { firstName: user.firstName }),
      ...(user.lastName !== undefined && { lastName: user.lastName }),
      isActive: user.isActive,
      emailVerified: user.emailVerified,
    };
  } catch (error) {
    logger.error('Authentication middleware error:', error);

    return reply.code(500).send({
      error: 'Authentication failed',
      message: 'Internal server error during authentication',
    });
  }
}

/**
 * Optional authentication middleware - continues if no token provided
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No authentication provided, continue without user context
      return;
    }

    const token = authHeader.substring(7);

    const db = dbConnection.getDatabase();
    const authService = new AuthenticationService(db);

    const user = await authService.verifyToken(token);

    if (user?.isActive) {
      // Add user to request context if valid
      (request as AuthenticatedRequest).user = {
        id: user.id,
        username: user.username,
        email: user.email,
        ...(user.firstName !== undefined && { firstName: user.firstName }),
        ...(user.lastName !== undefined && { lastName: user.lastName }),
        isActive: user.isActive,
        emailVerified: user.emailVerified,
      };
    }
  } catch (error) {
    logger.warn('Optional authentication middleware error:', error);
    // Continue without authentication on error
  }
}
