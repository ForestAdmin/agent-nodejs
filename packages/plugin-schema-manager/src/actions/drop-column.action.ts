import { CollectionCustomizer } from '@forestadmin/datasource-customizer';
import { SchemaExecutor, SchemaManagerOptions, SchemaOperation } from '../types';
import { ActionHelpers } from '../utils/action-helpers';

export function addDropColumnAction(
  collection: CollectionCustomizer,
  executor: SchemaExecutor,
  options: SchemaManagerOptions,
): void {
  if (!executor.supportsOperation('DROP_COLUMN')) {
    return;
  }

  collection.addAction('Schema: Drop Column', {
    scope: 'Global',
    form: [
      {
        label: 'Column Name',
        type: 'String',
        isRequired: true,
        description: 'Name of the column to drop',
      },
      {
        label: 'Confirmation',
        type: 'String',
        isRequired: true,
        description: 'Type "DELETE" to confirm this destructive operation',
      },
    ],
    execute: async (context, resultBuilder) => {
      try {
        // Permissions
        const permCheck = await ActionHelpers.validatePermissions(context.caller, options);
        if (!permCheck.isValid) {
          return resultBuilder.error(permCheck.error!);
        }

        const columnName = context.formValues['Column Name'];
        const confirmation = context.formValues['Confirmation'];

        // Check confirmation
        if (confirmation !== 'DELETE') {
          return resultBuilder.error('Confirmation failed. Type "DELETE" to confirm.');
        }

        // Check if column exists
        const tableDesc = await executor.describeTable(collection.name);
        const column = tableDesc.columns.find(
          col => col.name.toLowerCase() === columnName.toLowerCase(),
        );
        if (!column) {
          return resultBuilder.error(`Column "${columnName}" does not exist`);
        }

        // Check if it's a primary key
        if (column.primaryKey) {
          return resultBuilder.error(
            `Cannot drop primary key column "${columnName}". Drop constraints first.`,
          );
        }

        const operation: SchemaOperation = {
          type: 'DROP_COLUMN',
          datasource: 'default',
          collection: collection.name,
          timestamp: new Date(),
          caller: {
            id: context.caller.id,
            email: context.caller.email,
            permissionLevel: context.caller.permissionLevel,
          },
          details: { columnName },
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
          await executor.dropColumn(collection.name, columnName);
        });

        if (!result.success) {
          return resultBuilder.error(result.error!);
        }

        return resultBuilder.success(ActionHelpers.formatSuccessMessage(operation));
      } catch (error: any) {
        return resultBuilder.error(`Failed to drop column: ${error.message}`);
      }
    },
  });
}
