import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthenticationService } from '../../../src/services/auth-service';

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  let database: Database.Database;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary database for testing
    tempDir = await mkdtemp(join(tmpdir(), 'auth-test-'));
    const dbPath = join(tempDir, 'test.db');
    database = new Database(dbPath);

    // Create users table
    database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        is_active BOOLEAN DEFAULT 1,
        email_verified BOOLEAN DEFAULT 0,
        email_verification_token TEXT,
        password_reset_token TEXT,
        password_reset_expires DATETIME,
        notification_preferences TEXT DEFAULT '{"email": true, "push": true, "frequency": "daily"}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);

    authService = new AuthenticationService(database, 'test-secret-key');
  });

  afterEach(async () => {
    database.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await authService.register(userData);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.user.email).toBe(userData.email);
      expect(result.user.username).toBe(userData.username);
      expect(result.user.firstName).toBe(userData.firstName);
      expect(result.user.lastName).toBe(userData.lastName);
      expect(result.user.emailVerified).toBe(false);
      expect(result.user.isActive).toBe(true);
    });

    it('should reject duplicate email addresses', async () => {
      const userData = {
        username: 'testuser1',
        email: 'test@example.com',
        password: 'password123',
      };

      await authService.register(userData);

      const duplicateUser = {
        username: 'testuser2',
        email: 'test@example.com',
        password: 'password456',
      };

      await expect(authService.register(duplicateUser)).rejects.toThrow('Email already registered');
    });

    it('should reject duplicate usernames', async () => {
      const userData = {
        username: 'testuser',
        email: 'test1@example.com',
        password: 'password123',
      };

      await authService.register(userData);

      const duplicateUser = {
        username: 'testuser',
        email: 'test2@example.com',
        password: 'password456',
      };

      await expect(authService.register(duplicateUser)).rejects.toThrow('Username already taken');
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      await authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    it('should login with valid credentials', async () => {
      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.username).toBe('testuser');
    });

    it('should reject invalid email', async () => {
      await expect(
        authService.login({
          email: 'wrong@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject invalid password', async () => {
      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('Token Verification', () => {
    let validToken: string;

    beforeEach(async () => {
      const result = await authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });
      validToken = result.token;
    });

    it('should verify valid token', async () => {
      const user = await authService.verifyToken(validToken);

      expect(user).toBeDefined();
      expect(user?.email).toBe('test@example.com');
      expect(user?.username).toBe('testuser');
    });

    it('should reject invalid token', async () => {
      const user = await authService.verifyToken('invalid-token');
      expect(user).toBeNull();
    });

    it('should reject token for inactive user', async () => {
      // Deactivate user
      database.prepare('UPDATE users SET is_active = 0 WHERE email = ?').run('test@example.com');

      const user = await authService.verifyToken(validToken);
      expect(user).toBeNull();
    });
  });

  describe('Password Reset', () => {
    beforeEach(async () => {
      await authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should generate password reset token', async () => {
      const token = await authService.requestPasswordReset('test@example.com');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should handle non-existent email gracefully', async () => {
      const result = await authService.requestPasswordReset('nonexistent@example.com');
      expect(result).toBe('If the email exists, a reset link has been sent');
    });

    it('should reset password with valid token', async () => {
      const resetToken = await authService.requestPasswordReset('test@example.com');

      const result = await authService.resetPassword({
        token: resetToken,
        newPassword: 'newpassword123',
      });

      expect(result).toBe(true);

      // Verify old password doesn't work
      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow('Invalid email or password');

      // Verify new password works
      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'newpassword123',
      });
      expect(loginResult).toBeDefined();
    });

    it('should reject invalid reset token', async () => {
      await expect(
        authService.resetPassword({
          token: 'invalid-token',
          newPassword: 'newpassword123',
        }),
      ).rejects.toThrow('Invalid or expired reset token');
    });
  });

  describe('Email Verification', () => {
    let verificationToken: string;

    beforeEach(async () => {
      await authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });

      // Get verification token from database
      const user = database
        .prepare('SELECT email_verification_token FROM users WHERE email = ?')
        .get('test@example.com') as any;
      verificationToken = user.email_verification_token;
    });

    it('should verify email with valid token', async () => {
      const result = await authService.verifyEmail(verificationToken);
      expect(result).toBe(true);

      // Check that email is now verified
      const user = database
        .prepare('SELECT email_verified FROM users WHERE email = ?')
        .get('test@example.com') as any;
      expect(user.email_verified).toBe(1);
    });

    it('should reject invalid verification token', async () => {
      await expect(authService.verifyEmail('invalid-token')).rejects.toThrow(
        'Invalid verification token',
      );
    });
  });

  describe('Profile Updates', () => {
    let userId: string;

    beforeEach(async () => {
      const result = await authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      });
      userId = result.user.id;
    });

    it('should update user profile', async () => {
      const updatedUser = await authService.updateProfile(userId, {
        firstName: 'Jane',
        lastName: 'Smith',
      });

      expect(updatedUser.firstName).toBe('Jane');
      expect(updatedUser.lastName).toBe('Smith');
      expect(updatedUser.email).toBe('test@example.com'); // Should remain unchanged
    });

    it('should update username if available', async () => {
      const updatedUser = await authService.updateProfile(userId, {
        username: 'newusername',
      });

      expect(updatedUser.username).toBe('newusername');
    });

    it('should reject duplicate username', async () => {
      // Create another user
      await authService.register({
        username: 'anotheruser',
        email: 'another@example.com',
        password: 'password123',
      });

      await expect(
        authService.updateProfile(userId, {
          username: 'anotheruser',
        }),
      ).rejects.toThrow('Username already taken');
    });

    it('should reject duplicate email', async () => {
      // Create another user
      await authService.register({
        username: 'anotheruser',
        email: 'another@example.com',
        password: 'password123',
      });

      await expect(
        authService.updateProfile(userId, {
          email: 'another@example.com',
        }),
      ).rejects.toThrow('Email already registered');
    });
  });
});
