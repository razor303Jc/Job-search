import { dbConnection } from '@/database/connection.js';
import { AuthenticationService } from '@/services/auth-service.js';
import { logger } from '@/utils/logger.js';
import type { FastifyInstance } from 'fastify';

export async function registerAuthRoutes(fastify: FastifyInstance, _options: any): Promise<void> {
  const db = dbConnection.getDatabase();
  const authService = new AuthenticationService(db);

  // Health check for auth system
  fastify.get('/health', async (_request, _reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'authentication',
    };
  });

  // Register new user
  fastify.post('/register', async (request, reply) => {
    try {
      const body = request.body as any;

      // Validate required fields
      if (!body.username || !body.email || !body.password) {
        return reply.code(400).send({
          error: 'Missing required fields: username, email, password',
        });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return reply.code(400).send({
          error: 'Invalid email format',
        });
      }

      // Password strength validation
      if (body.password.length < 8) {
        return reply.code(400).send({
          error: 'Password must be at least 8 characters long',
        });
      }

      const authToken = await authService.register({
        username: body.username,
        email: body.email,
        password: body.password,
        firstName: body.firstName,
        lastName: body.lastName,
      });

      reply.code(201).send({
        success: true,
        data: {
          token: authToken.token,
          expiresAt: authToken.expiresAt,
          user: {
            id: authToken.user.id,
            username: authToken.user.username,
            email: authToken.user.email,
            firstName: authToken.user.firstName,
            lastName: authToken.user.lastName,
            emailVerified: authToken.user.emailVerified,
          },
        },
      });
    } catch (error) {
      logger.error('Registration error:', error);

      if (error instanceof Error) {
        if (error.message.includes('already')) {
          return reply.code(409).send({
            error: error.message,
          });
        }
      }

      reply.code(500).send({
        error: 'Registration failed',
      });
    }
  });

  // Login user
  fastify.post('/login', async (request, reply) => {
    try {
      const body = request.body as any;

      if (!body.email || !body.password) {
        return reply.code(400).send({
          error: 'Missing email or password',
        });
      }

      const authToken = await authService.login({
        email: body.email,
        password: body.password,
      });

      reply.send({
        success: true,
        data: {
          token: authToken.token,
          expiresAt: authToken.expiresAt,
          user: {
            id: authToken.user.id,
            username: authToken.user.username,
            email: authToken.user.email,
            firstName: authToken.user.firstName,
            lastName: authToken.user.lastName,
            emailVerified: authToken.user.emailVerified,
            lastLogin: authToken.user.lastLogin,
          },
        },
      });
    } catch (error) {
      logger.error('Login error:', error);

      if (error instanceof Error && error.message.includes('Invalid')) {
        return reply.code(401).send({
          error: 'Invalid credentials',
        });
      }

      if (error instanceof Error && error.message.includes('disabled')) {
        return reply.code(403).send({
          error: 'Account is disabled',
        });
      }

      reply.code(500).send({
        error: 'Login failed',
      });
    }
  });

  // Verify token and get user profile
  fastify.get(
    '/profile',
    {
      preHandler: async (request, reply) => {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return reply.code(401).send({
            error: 'Missing or invalid authorization header',
          });
        }

        const token = authHeader.substring(7);
        const user = await authService.verifyToken(token);

        if (!user) {
          return reply.code(401).send({
            error: 'Invalid or expired token',
          });
        }

        // Add user to request context
        (request as any).user = user;
      },
    },
    async (request, reply) => {
      const user = (request as any).user;

      reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            emailVerified: user.emailVerified,
            notificationPreferences: user.notificationPreferences,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
          },
        },
      });
    },
  );

  // Update user profile
  fastify.put(
    '/profile',
    {
      preHandler: async (request, reply) => {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return reply.code(401).send({
            error: 'Missing or invalid authorization header',
          });
        }

        const token = authHeader.substring(7);
        const user = await authService.verifyToken(token);

        if (!user) {
          return reply.code(401).send({
            error: 'Invalid or expired token',
          });
        }

        (request as any).user = user;
      },
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const body = request.body as any;

        const updatedUser = await authService.updateProfile(user.id, {
          username: body.username,
          email: body.email,
          firstName: body.firstName,
          lastName: body.lastName,
        });

        reply.send({
          success: true,
          data: {
            user: {
              id: updatedUser.id,
              username: updatedUser.username,
              email: updatedUser.email,
              firstName: updatedUser.firstName,
              lastName: updatedUser.lastName,
              emailVerified: updatedUser.emailVerified,
            },
          },
        });
      } catch (error) {
        logger.error('Profile update error:', error);

        if (error instanceof Error && error.message.includes('already')) {
          return reply.code(409).send({
            error: error.message,
          });
        }

        reply.code(500).send({
          error: 'Profile update failed',
        });
      }
    },
  );

  // Request password reset
  fastify.post('/password-reset-request', async (request, reply) => {
    try {
      const body = request.body as any;

      if (!body.email) {
        return reply.code(400).send({
          error: 'Email is required',
        });
      }

      await authService.requestPasswordReset(body.email);

      // Always return success for security (don't reveal if email exists)
      reply.send({
        success: true,
        message: 'If the email exists, a reset link has been sent',
      });
    } catch (error) {
      logger.error('Password reset request error:', error);

      reply.code(500).send({
        error: 'Failed to process password reset request',
      });
    }
  });

  // Reset password with token
  fastify.post('/password-reset', async (request, reply) => {
    try {
      const body = request.body as any;

      if (!body.token || !body.newPassword) {
        return reply.code(400).send({
          error: 'Token and new password are required',
        });
      }

      if (body.newPassword.length < 8) {
        return reply.code(400).send({
          error: 'Password must be at least 8 characters long',
        });
      }

      await authService.resetPassword({
        token: body.token,
        newPassword: body.newPassword,
      });

      reply.send({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      logger.error('Password reset error:', error);

      if (error instanceof Error && error.message.includes('Invalid')) {
        return reply.code(400).send({
          error: 'Invalid or expired reset token',
        });
      }

      reply.code(500).send({
        error: 'Password reset failed',
      });
    }
  });

  // Verify email address
  fastify.get('/verify-email/:token', async (request, reply) => {
    try {
      const params = request.params as any;

      await authService.verifyEmail(params.token);

      reply.send({
        success: true,
        message: 'Email verified successfully',
      });
    } catch (error) {
      logger.error('Email verification error:', error);

      if (error instanceof Error && error.message.includes('Invalid')) {
        return reply.code(400).send({
          error: 'Invalid verification token',
        });
      }

      reply.code(500).send({
        error: 'Email verification failed',
      });
    }
  });

  // Logout (client-side token invalidation)
  fastify.post(
    '/logout',
    {
      preHandler: async (request, reply) => {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return reply.code(401).send({
            error: 'Missing or invalid authorization header',
          });
        }

        const token = authHeader.substring(7);
        const user = await authService.verifyToken(token);

        if (!user) {
          return reply.code(401).send({
            error: 'Invalid or expired token',
          });
        }

        (request as any).user = user;
      },
    },
    async (_request, reply) => {
      // In a stateless JWT implementation, logout is handled client-side
      // by removing the token. For enhanced security, you could implement
      // a token blacklist here.

      reply.send({
        success: true,
        message: 'Logged out successfully',
      });
    },
  );
}
