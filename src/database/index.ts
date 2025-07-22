/**
 * Main database setup and initialization
 * Coordinates connection, migrations, and repository setup
 */

import { dbConnection } from './connection.js';
import MigrationManager from './migrations/manager.js';
import JobRepository from './models/job.model.js';
import { logger } from '@/utils/logger.js';

export interface DatabaseServices {
  jobs: JobRepository;
  connection: typeof dbConnection;
  migrate: () => Promise<void>;
  reset: () => Promise<void>;
  backup: (filename: string) => Promise<void>;
  getStats: () => any;
  close: () => void;
}

/**
 * Initialize database and all services
 */
export async function initializeDatabase(): Promise<DatabaseServices> {
  try {
    // Connect to database
    logger.debug('Connecting to database...');
    const db = dbConnection.connect();
    logger.info('Database connected successfully');

    // Initialize repositories
    logger.debug('Initializing job repository...');
    const jobs = new JobRepository(db);
    logger.debug('Job repository initialized');
    
    // Setup migration manager
    logger.debug('Setting up migration manager...');
    const migrationManager = new MigrationManager(db);
    logger.debug('Migration manager set up');

    // Run pending migrations
    logger.debug('Running pending migrations...');
    await migrationManager.migrate();
    logger.debug('Migrations completed');

    logger.info('Database initialization completed');

    return {
      jobs,
      connection: dbConnection,
      migrate: async () => {
        await migrationManager.migrate();
      },
      reset: async () => {
        await migrationManager.reset();
      },
      backup: async (filename: string) => {
        await dbConnection.backup(filename);
      },
      getStats: () => {
        return dbConnection.getStats();
      },
      close: () => {
        dbConnection.close();
      },
    };
  } catch (error) {
    logger.error('Failed to initialize database', { 
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error 
    });
    throw error;
  }
}

/**
 * Get database services (assumes already initialized)
 */
export function getDatabaseServices(): DatabaseServices {
  if (!dbConnection.isConnected()) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }

  const db = dbConnection.getDatabase();
  const jobs = new JobRepository(db);
  const migrationManager = new MigrationManager(db);

  return {
    jobs,
    connection: dbConnection,
    migrate: async () => {
      await migrationManager.migrate();
    },
    reset: async () => {
      await migrationManager.reset();
    },
    backup: async (filename: string) => {
      await dbConnection.backup(filename);
    },
    getStats: () => {
      return dbConnection.getStats();
    },
    close: () => {
      dbConnection.close();
    },
  };
}

// Export default services
export { dbConnection, JobRepository, MigrationManager };
export default initializeDatabase;
