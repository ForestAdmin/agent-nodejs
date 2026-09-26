import { CollectionCustomizer } from '@forestadmin/datasource-customizer';
import { SchemaExecutor, SchemaManagerOptions, SchemaOperation } from '../types';
import { ActionHelpers } from '../utils/action-helpers';

export function addDropTableAction(
  collection: CollectionCustomizer,
  executor: SchemaExecutor,
  options: SchemaManagerOptions,
): void {
  if (!executor.supportsOperation('DROP_TABLE')) {
    return;
  }

  collection.addAction('Schema: Drop Table', {
    scope: 'Global',
    form: [
      {
        label: 'Table Name',
        type: 'String',
        isRequired: true,
        description: 'Name of the table to drop',
      },
      {
        label: 'Type DELETE to confirm',
        type: 'String',
        isRequired: true,
        description: '⚠️  WARNING: THIS WILL PERMANENTLY DELETE ALL DATA IN THE TABLE',
      },
      {
        label: 'Backup Confirmation',
        type: 'Boolean',
        isRequired: true,
        description: 'I confirm that I have a backup of this table',
      },
    ],
    execute: async (context, resultBuilder) => {
      try {
        // Permissions
        const permCheck = await ActionHelpers.validatePermissions(context.caller, options);
        if (!permCheck.isValid) {
          return resultBuilder.error(permCheck.error!);
        }

        const tableName = context.formValues['Table Name'];
        const confirmation = context.formValues['Type DELETE to confirm'];
        const backupConfirm = context.formValues['Backup Confirmation'];

        // Check confirmations
        if (confirmation !== 'DELETE') {
          return resultBuilder.error('Confirmation failed. Type "DELETE" to confirm.');
        }

        if (!backupConfirm) {
          return resultBuilder.error('You must confirm that you have a backup');
        }

        // Validate table name
        const nameCheck = ActionHelpers.validateIdentifier(tableName, 'table', options);
        if (!nameCheck.isValid) {
          return resultBuilder.error(nameCheck.error!);
        }

        // Check if table exists
        const tables = await executor.listTables();
        if (!tables.map(t => t.toLowerCase()).includes(tableName.toLowerCase())) {
          return resultBuilder.error(`Table "${tableName}" does not exist`);
        }

        const operation: SchemaOperation = {
          type: 'DROP_TABLE',
          datasource: 'default',
          collection: tableName,
          timestamp: new Date(),
          caller: {
            id: context.caller.id,
            email: context.caller.email,
            permissionLevel: context.caller.permissionLevel,
          },
          details: { tableName },
          dryRun: options.dryRunMode || false,
        };

        // Dry-run mode
        if (options.dryRunMode) {
          const ddl = executor.buildDDL(operation);
          return resultBuilder.success(
            `DRY RUN - The following DDL would be executed:\n\n${ddl}\n\n⚠️  This would PERMANENTLY DELETE all data in table "${tableName}"\n\nNo changes were made.`,
          );
        }

        // Execute with callbacks
        const result = await ActionHelpers.runWithCallbacks(operation, options, async () => {
          await executor.dropTable(tableName);
        });

        if (!result.success) {
          return resultBuilder.error(result.error!);
        }

        return resultBuilder.success(`✅ Table "${tableName}" dropped successfully`);
      } catch (error: any) {
        return resultBuilder.error(`Failed to drop table: ${error.message}`);
      }
    },
  });
}
