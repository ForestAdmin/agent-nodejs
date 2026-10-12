import {
  DataSourceCustomizer,
  CollectionCustomizer,
  Plugin,
} from '@forestadmin/datasource-customizer';

import { ExecutorFactory } from './executors/executor-factory';
import { SchemaManagerOptions } from './types';

import {
  addCreateTableAction,
  addDropTableAction,
  addCreateColumnAction,
  addDropColumnAction,
  addModifyColumnAction,
  addCreateIndexAction,
  addDropIndexAction,
  addCreateForeignKeyAction,
} from './actions';

// Export types
export * from './types';
export { ExecutorFactory } from './executors/executor-factory';
export { SequelizeSchemaExecutor } from './executors/sequelize-executor';
export { MongoSchemaExecutor } from './executors/mongo-executor';

// Default options
const DEFAULT_OPTIONS: SchemaManagerOptions = {
  restrictTo: ['admin', 'developer'],
  requireConfirmation: true,
  dryRunMode: false,
  enableTableCreation: true,
  enableTableDeletion: false, // Disabled by default for safety
  enableColumnModification: true,
  enableColumnDeletion: true,
  enableIndexManagement: true,
  enableForeignKeyManagement: true,
  autoRefreshSchema: false, // TODO: implement
};

/**
 * Forest Admin Schema Manager Plugin
 *
 * Adds DDL (Data Definition Language) actions to collections, allowing
 * live schema modifications directly from the Forest Admin UI.
 *
 * @param dataSourceCustomizer - The datasource customizer
 * @param collectionCustomizer - Optional specific collection (if null, applies to all)
 * @param options - Configuration options
 * @param logger - Optional logger
 *
 * @example
 * ```typescript
 * import { createAgent } from '@forestadmin/agent';
 * import { createSqlDataSource } from '@forestadmin/datasource-sql';
 * import { addSchemaManager } from '@forestadmin/plugin-schema-manager';
 *
 * createAgent(options)
 *   .addDataSource(createSqlDataSource(connectionString))
 *   .use(addSchemaManager, {
 *     restrictTo: ['admin'],
 *     dryRunMode: false,
 *     enableTableDeletion: false,
 *   })
 *   .start();
 * ```
 */
export const addSchemaManager: Plugin<SchemaManagerOptions> = async (
  dataSourceCustomizer: DataSourceCustomizer,
  collectionCustomizer: CollectionCustomizer | null,
  options?: SchemaManagerOptions,
  logger?,
) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Log activation
  if (logger) {
    const targetCollections = collectionCustomizer ? [collectionCustomizer.name] : 'all';
    logger('Info', `Schema Manager plugin activated - Options: ${JSON.stringify(opts)}, Target collections: ${JSON.stringify(targetCollections)}`);
  }

  // Determine collections to process
  const collections = collectionCustomizer
    ? [collectionCustomizer]
    : dataSourceCustomizer.collections;

  let activatedCount = 0;
  let skippedCount = 0;

  for (const collection of collections) {
    try {
      // Get native driver from collection
      const nativeDriver = (collection as any).nativeDriver;

      if (!nativeDriver) {
        if (logger) {
          logger(
            'Warn',
            `No native driver found for collection "${collection.name}", skipping schema manager`,
          );
        }
        skippedCount++;
        continue;
      }

      // Create appropriate executor
      const executor = ExecutorFactory.create(nativeDriver);

      // Check if executor supports at least one operation
      const supportedOps = [
        'CREATE_TABLE',
        'CREATE_COLUMN',
        'DROP_COLUMN',
        'CREATE_INDEX',
      ].filter(op => executor.supportsOperation(op as any));

      if (supportedOps.length === 0) {
        if (logger) {
          logger(
            'Info',
            `Schema manager not supported for collection "${collection.name}" (${executor.dialect})`,
          );
        }
        skippedCount++;
        continue;
      }

      // Add actions based on options and executor capabilities
      if (opts.enableTableCreation) {
        addCreateTableAction(collection, executor, opts);
      }

      if (opts.enableTableDeletion) {
        addDropTableAction(collection, executor, opts);
      }

      if (opts.enableColumnModification) {
        addCreateColumnAction(collection, executor, opts);
        addModifyColumnAction(collection, executor, opts);
      }

      if (opts.enableColumnDeletion) {
        addDropColumnAction(collection, executor, opts);
      }

      if (opts.enableIndexManagement) {
        addCreateIndexAction(collection, executor, opts);
        addDropIndexAction(collection, executor, opts);
      }

      if (opts.enableForeignKeyManagement) {
        addCreateForeignKeyAction(collection, executor, opts);
      }

      activatedCount++;

      if (logger) {
        logger(
          'Info',
          `Schema manager actions added to collection "${collection.name}" - Dialect: ${executor.dialect}, Supported operations: ${JSON.stringify(supportedOps)}`,
        );
      }
    } catch (error: any) {
      if (logger) {
        logger(
          'Error',
          `Failed to add schema manager to collection "${collection.name}": ${error.message}`,
        );
      }
      skippedCount++;
      // Continue with other collections
    }
  }

  if (logger) {
    logger('Info', `Schema Manager plugin initialization complete - Activated: ${activatedCount}, Skipped: ${skippedCount}, Total: ${collections.length}`);
  }
};

// Default export
export default addSchemaManager;
