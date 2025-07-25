import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  emailVerified: boolean;
  notificationPreferences: {
    email: boolean;
    push: boolean;
    frequency: 'immediate' | 'daily' | 'weekly';
  };
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
  user: User;
}

export interface ResetPasswordData {
  token: string;
  newPassword: string;
}

export class AuthenticationService {
  private db: Database;
  private jwtSecret: string;
  private saltRounds = 12;

  constructor(database: Database, jwtSecret?: string) {
    this.db = database;
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || this.generateSecret();
  }

  private generateSecret(): string {
    return randomBytes(64).toString('hex');
  }

  private generateUserId(): string {
    return `user_${randomBytes(16).toString('hex')}`;
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Register a new user
   */
  async register(userData: RegisterData): Promise<AuthToken> {
    try {
      // Check if email already exists
      const existingEmail = this.db
        .prepare('SELECT id FROM users WHERE email = ?')
        .get(userData.email);

      if (existingEmail) {
        throw new Error('Email already registered');
      }

      // Check if username already exists
      const existingUsername = this.db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(userData.username);

      if (existingUsername) {
        throw new Error('Username already taken');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, this.saltRounds);
      const userId = this.generateUserId();
      const emailVerificationToken = this.generateToken();

      const defaultPreferences = {
        email: true,
        push: true,
        frequency: 'daily' as const,
      };

      // Insert new user
      const insertUser = this.db.prepare(`
                INSERT INTO users (
                    id, username, email, password_hash, first_name, last_name,
                    email_verification_token, notification_preferences
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

      insertUser.run(
        userId,
        userData.username,
        userData.email,
        passwordHash,
        userData.firstName || null,
        userData.lastName || null,
        emailVerificationToken,
        JSON.stringify(defaultPreferences),
      );

      logger.info(`User registered successfully: ${userData.email}`);

      // Get the created user
      const user = this.getUserById(userId);
      if (!user) {
        throw new Error('Failed to create user');
      }

      // Generate JWT token
      const token = this.generateJWT(user);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      return {
        token,
        expiresAt,
        user,
      };
    } catch (error) {
      logger.error('Registration failed:', error);
      throw error;
    }
  }

  /**
   * Login user with credentials
   */
  async login(credentials: LoginCredentials): Promise<AuthToken> {
    try {
      // Get user by email
      const userRow = this.db
        .prepare(`
                SELECT id, username, email, password_hash, first_name, last_name,
                       is_active, email_verified, notification_preferences,
                       created_at, updated_at, last_login
                FROM users WHERE email = ?
            `)
        .get(credentials.email) as any;

      if (!userRow) {
        throw new Error('Invalid email or password');
      }

      // Check if user is active
      if (!userRow.is_active) {
        throw new Error('Account is disabled');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(credentials.password, userRow.password_hash);

      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Update last login
      this.db
        .prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
        .run(userRow.id);

      const user = this.mapRowToUser(userRow);
      const token = this.generateJWT(user);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      logger.info(`User logged in successfully: ${credentials.email}`);

      return {
        token,
        expiresAt,
        user,
      };
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Verify JWT token and get user
   */
  async verifyToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;

      if (!decoded.userId) {
        return null;
      }

      const user = this.getUserById(decoded.userId);

      if (!user || !user.isActive) {
        return null;
      }

      return user;
    } catch (error) {
      logger.warn('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<string> {
    try {
      const user = this.db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;

      if (!user) {
        // Don't reveal if email exists for security
        logger.warn(`Password reset requested for non-existent email: ${email}`);
        return 'If the email exists, a reset link has been sent';
      }

      const resetToken = this.generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      this.db
        .prepare(`
                UPDATE users 
                SET password_reset_token = ?, password_reset_expires = ?
                WHERE id = ?
            `)
        .run(resetToken, expiresAt.toISOString(), user.id);

      logger.info(`Password reset token generated for user: ${email}`);

      return resetToken;
    } catch (error) {
      logger.error('Password reset request failed:', error);
      throw error;
    }
  }

  /**
   * Reset password using token
   */
  async resetPassword(data: ResetPasswordData): Promise<boolean> {
    try {
      const user = this.db
        .prepare(`
                SELECT id FROM users 
                WHERE password_reset_token = ? 
                AND password_reset_expires > CURRENT_TIMESTAMP
            `)
        .get(data.token) as any;

      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      const passwordHash = await bcrypt.hash(data.newPassword, this.saltRounds);

      this.db
        .prepare(`
                UPDATE users 
                SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL
                WHERE id = ?
            `)
        .run(passwordHash, user.id);

      logger.info(`Password reset successfully for user ID: ${user.id}`);

      return true;
    } catch (error) {
      logger.error('Password reset failed:', error);
      throw error;
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<boolean> {
    try {
      const user = this.db
        .prepare('SELECT id FROM users WHERE email_verification_token = ?')
        .get(token) as any;

      if (!user) {
        throw new Error('Invalid verification token');
      }

      this.db
        .prepare(`
                UPDATE users 
                SET email_verified = 1, email_verification_token = NULL
                WHERE id = ?
            `)
        .run(user.id);

      logger.info(`Email verified for user ID: ${user.id}`);

      return true;
    } catch (error) {
      logger.error('Email verification failed:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<RegisterData>): Promise<User> {
    try {
      const user = this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (updates.username) {
        // Check if username is taken by another user
        const existing = this.db
          .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
          .get(updates.username, userId);

        if (existing) {
          throw new Error('Username already taken');
        }

        updateFields.push('username = ?');
        updateValues.push(updates.username);
      }

      if (updates.email) {
        // Check if email is taken by another user
        const existing = this.db
          .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
          .get(updates.email, userId);

        if (existing) {
          throw new Error('Email already registered');
        }

        updateFields.push('email = ?', 'email_verified = 0');
        updateValues.push(updates.email, 0);
      }

      if (updates.firstName !== undefined) {
        updateFields.push('first_name = ?');
        updateValues.push(updates.firstName || null);
      }

      if (updates.lastName !== undefined) {
        updateFields.push('last_name = ?');
        updateValues.push(updates.lastName || null);
      }

      if (updateFields.length === 0) {
        return user; // No updates needed
      }

      updateValues.push(userId);

      this.db
        .prepare(`
                UPDATE users SET ${updateFields.join(', ')} WHERE id = ?
            `)
        .run(...updateValues);

      logger.info(`User profile updated: ${userId}`);

      const updatedUser = this.getUserById(userId);
      if (!updatedUser) {
        throw new Error('Failed to fetch updated user');
      }

      return updatedUser;
    } catch (error) {
      logger.error('Profile update failed:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  private getUserById(userId: string): User | null {
    try {
      const userRow = this.db
        .prepare(`
                SELECT id, username, email, first_name, last_name,
                       is_active, email_verified, notification_preferences,
                       created_at, updated_at, last_login
                FROM users WHERE id = ?
            `)
        .get(userId) as any;

      if (!userRow) {
        return null;
      }

      return this.mapRowToUser(userRow);
    } catch (error) {
      logger.error('Failed to get user by ID:', error);
      return null;
    }
  }

  /**
   * Map database row to User object
   */
  private mapRowToUser(row: any): User {
    let notificationPreferences: any;
    try {
      notificationPreferences = JSON.parse(row.notification_preferences || '{}');
    } catch {
      notificationPreferences = { email: true, push: true, frequency: 'daily' };
    }

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      firstName: row.first_name || undefined,
      lastName: row.last_name || undefined,
      isActive: Boolean(row.is_active),
      emailVerified: Boolean(row.email_verified),
      notificationPreferences,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login || undefined,
    };
  }

  /**
   * Generate JWT token for user
   */
  private generateJWT(user: User): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
      },
      this.jwtSecret,
      {
        expiresIn: '24h',
        issuer: 'job-dorker',
        subject: user.id,
      },
    );
  }
}
