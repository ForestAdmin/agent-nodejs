import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import { addSchemaManager } from '../packages/plugin-schema-manager/src';

/**
 * Test Veterinary Service Database
 *
 * This test demonstrates the schema-manager plugin by creating
 * a complete veterinary service database schema.
 */

const DATABASE_URL = 'sqlite://./veterinary.db';

async function main() {
  console.log('🏥 Starting Veterinary Service Test\n');
  console.log('Database:', DATABASE_URL);
  console.log('='`.repeat(60));

  const agent = createAgent({
    authSecret: process.env.FOREST_AUTH_SECRET || 'test-secret-key',
    envSecret: process.env.FOREST_ENV_SECRET || 'test-env-secret',
    isProduction: false,
    loggerLevel: 'Info',
  });

  // Add SQLite datasource
  agent.addDataSource(
    createSqlDataSource(DATABASE_URL, {
      dialect: 'sqlite',
    }),
  );

  // Add Schema Manager plugin with development settings
  agent.use(addSchemaManager, {
    // Security (permissive for testing)
    restrictTo: ['admin', 'developer', 'editor'],
    requireConfirmation: false,  // Disable confirmations for automated testing
    dryRunMode: false,

    // Enable all features
    enableTableCreation: true,
    enableTableDeletion: true,
    enableColumnModification: true,
    enableColumnDeletion: true,
    enableIndexManagement: true,
    enableForeignKeyManagement: true,

    // No restrictions for testing
    forbiddenTables: [],
    forbiddenColumns: [],

    // Callbacks for logging
    beforeSchemaChange: async (operation) => {
      console.log(`\n⚙️  Executing: ${operation.type} on ${operation.collection}`);
      return true;
    },

    afterSchemaChange: async (operation) => {
      console.log(`✅ Success: ${operation.type} completed`);
    },

    onError: async (error, operation) => {
      console.error(`❌ Error: ${operation.type} failed - ${error.message}`);
    },
  });

  console.log('\n✅ Forest Admin Agent configured with Schema Manager plugin');
  console.log('📋 Available actions:');
  console.log('   - Schema: Create Table');
  console.log('   - Schema: Add Column');
  console.log('   - Schema: Create Index');
  console.log('   - Schema: Create Foreign Key');
  console.log('   - And more...\n');

  // Note: In a real scenario, you would call agent.start() here
  // For testing, we'll use the executor directly

  return agent;
}

// Export for testing
export { main };

if (require.main === module) {
  main().catch(console.error);
}
