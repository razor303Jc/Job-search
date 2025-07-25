import { getDatabase } from './dist/database/connection.js';
import MigrationManager from './dist/database/migrations/manager.js';

async function runMigrations() {
  try {
    const db = getDatabase();
    const migrationManager = new MigrationManager(db);
    
    console.log('Current migration status:');
    const status = migrationManager.getStatus();
    console.log('Applied migrations:', status.appliedMigrations.length);
    console.log('Pending migrations:', status.pendingMigrations.length);
    
    if (status.pendingMigrations.length > 0) {
      console.log('Running pending migrations...');
      const results = await migrationManager.migrate();
      
      console.log('Migration results:');
      for (const result of results) {
        console.log(`- ${result.migration.name}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        if (!result.success) {
          console.error(`  Error: ${result.error}`);
        }
      }
    } else {
      console.log('No pending migrations to run.');
    }
    
    db.close();
    console.log('Database migration process completed.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
