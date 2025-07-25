import type { FastifyReply, FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationService } from '../../../../src/services/auth-service.js';
import { authMiddleware, optionalAuthMiddleware } from '../../../../src/web/middleware/auth.js';

const mockDatabase = {
  prepare: vi.fn(),
  exec: vi.fn(),
};

// Mock the database connection
vi.mock('../../../../src/database/connection', () => ({
  dbConnection: {
    getDatabase: vi.fn(() => mockDatabase),
    isConnected: vi.fn(() => true),
  },
}));

// Mock the authentication service
vi.mock('../../../../src/services/auth-service');

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const MockAuthenticationService = AuthenticationService as any;

describe('Authentication Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockAuthService: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    mockRequest = {
      headers: {},
    };

    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    mockAuthService = {
      verifyToken: vi.fn(),
    };

    MockAuthenticationService.mockImplementation(() => mockAuthService);
  });

  describe('authMiddleware', () => {
    it('should reject request without authorization header', async () => {
      await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'No authorization token',
        message: 'Authorization header with Bearer token is required',
      });
    });

    it('should reject request with invalid authorization header format', async () => {
      mockRequest.headers = {
        authorization: 'Invalid token',
      };

      await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'No authorization token',
        message: 'Authorization header with Bearer token is required',
      });
    });

    it('should reject request with invalid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      mockAuthService.verifyToken.mockResolvedValue(null);

      await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
        message: 'Please login again',
      });
    });

    it('should reject request for inactive user', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      const mockUser = {
        id: 'user1',
        username: 'testuser',
        email: 'test@example.com',
        isActive: false,
        emailVerified: true,
      };

      mockAuthService.verifyToken.mockResolvedValue(mockUser);

      await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Account is disabled',
        message: 'Your account has been disabled. Please contact support.',
      });
    });

    it('should successfully authenticate valid user', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      const mockUser = {
        id: 'user1',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        emailVerified: true,
      };

      mockAuthService.verifyToken.mockResolvedValue(mockUser);

      await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect((mockRequest as any).user).toEqual({
        id: 'user1',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        emailVerified: true,
      });

      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should handle authentication service errors', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      mockAuthService.verifyToken.mockRejectedValue(new Error('Database error'));

      await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'Internal server error during authentication',
      });
    });
  });

  describe('optionalAuthMiddleware', () => {
    it('should continue without authentication when no header provided', async () => {
      await optionalAuthMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect((mockRequest as any).user).toBeUndefined();
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
      expect(mockAuthService.verifyToken).not.toHaveBeenCalled();
    });

    it('should continue without authentication when header format is invalid', async () => {
      mockRequest.headers = {
        authorization: 'Invalid token',
      };

      await optionalAuthMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect((mockRequest as any).user).toBeUndefined();
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
      expect(mockAuthService.verifyToken).not.toHaveBeenCalled();
    });

    it('should add user context when valid token provided', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      const mockUser = {
        id: 'user1',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        emailVerified: true,
      };

      mockAuthService.verifyToken.mockResolvedValue(mockUser);

      await optionalAuthMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect((mockRequest as any).user).toEqual({
        id: 'user1',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        emailVerified: true,
      });

      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should continue without user context when token is invalid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      mockAuthService.verifyToken.mockResolvedValue(null);

      await optionalAuthMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect((mockRequest as any).user).toBeUndefined();
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should continue without user context when user is inactive', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      const mockUser = {
        id: 'user1',
        username: 'testuser',
        email: 'test@example.com',
        isActive: false,
        emailVerified: true,
      };

      mockAuthService.verifyToken.mockResolvedValue(mockUser);

      await optionalAuthMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect((mockRequest as any).user).toBeUndefined();
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should handle authentication service errors gracefully', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      mockAuthService.verifyToken.mockRejectedValue(new Error('Database error'));

      await optionalAuthMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect((mockRequest as any).user).toBeUndefined();
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });
  });
});
