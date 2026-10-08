import { CollectionCustomizer } from '@forestadmin/datasource-customizer';
import { SchemaExecutor, SchemaManagerOptions, SchemaOperation } from '../types';
import { ActionHelpers } from '../utils/action-helpers';

export function addDropIndexAction(
  collection: CollectionCustomizer,
  executor: SchemaExecutor,
  options: SchemaManagerOptions,
): void {
  if (!executor.supportsOperation('DROP_INDEX')) {
    return;
  }

  collection.addAction('Schema: Drop Index', {
    scope: 'Global',
    form: [
      {
        label: 'Index Name',
        type: 'String',
        isRequired: true,
        description: 'Name of the index to drop',
      },
    ],
    execute: async (context, resultBuilder) => {
      try {
        // Permissions
        const permCheck = await ActionHelpers.validatePermissions(context.caller, options);
        if (!permCheck.isValid) {
          return resultBuilder.error(permCheck.error!);
        }

        const indexName = context.formValues['Index Name'];

        // Check if index exists
        const indexes = await executor.listIndexes(collection.name);
        const index = indexes.find(idx => idx.name === indexName);
        if (!index) {
          return resultBuilder.error(`Index "${indexName}" does not exist`);
        }

        const operation: SchemaOperation = {
          type: 'DROP_INDEX',
          datasource: 'default',
          collection: collection.name,
          timestamp: new Date(),
          caller: {
            id: context.caller.id,
            email: context.caller.email,
            permissionLevel: context.caller.permissionLevel,
          },
          details: { indexName },
          dryRun: options.dryRunMode || false,
        };

        // Dry-run mode
        if (options.dryRunMode) {
          const ddl = executor.buildDDL(operation);
          return resultBuilder.success(
            `DRY RUN - The following DDL would be executed:\n\n${ddl}\n\nNo changes were made.`,
          );
        }

        // Execute with callbacks
        const result = await ActionHelpers.runWithCallbacks(operation, options, async () => {
          await executor.dropIndex(collection.name, indexName);
        });

        if (!result.success) {
          return resultBuilder.error(result.error!);
        }

        return resultBuilder.success(`✅ Index "${indexName}" dropped successfully`);
      } catch (error: any) {
        return resultBuilder.error(`Failed to drop index: ${error.message}`);
      }
    },
  });
}
