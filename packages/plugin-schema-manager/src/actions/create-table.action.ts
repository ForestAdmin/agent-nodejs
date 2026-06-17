import { CollectionCustomizer } from '@forestadmin/datasource-customizer';
import { SchemaExecutor, SchemaManagerOptions, SchemaOperation, ColumnDefinition } from '../types';
import { ActionHelpers } from '../utils/action-helpers';

export function addCreateTableAction(
  collection: CollectionCustomizer,
  executor: SchemaExecutor,
  options: SchemaManagerOptions,
): void {
  if (!executor.supportsOperation('CREATE_TABLE')) {
    return;
  }

  collection.addAction('Schema: Create Table', {
    scope: 'Global',
    form: [
      {
        label: 'Table Name',
        type: 'String',
        isRequired: true,
        description: 'Name of the new table (snake_case recommended)',
      },
      {
        label: 'Columns (JSON)',
        type: 'String',
        isRequired: true,
        description: 'Array of column definitions in JSON format. Example: [{"name":"id","type":"INTEGER","primaryKey":true},{"name":"name","type":"STRING","allowNull":false}]',
        widget: 'TextArea',
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
        const columnsJson = context.formValues['Columns (JSON)'];

        // Validate table name
        const nameCheck = ActionHelpers.validateIdentifier(tableName, 'table', options);
        if (!nameCheck.isValid) {
          return resultBuilder.error(nameCheck.error!);
        }

        // Parse columns
        let columns: ColumnDefinition[];
        try {
          columns = JSON.parse(columnsJson);
        } catch {
          return resultBuilder.error('Invalid JSON format for columns');
        }

        // Validate at least one column
        if (!Array.isArray(columns) || columns.length === 0) {
          return resultBuilder.error('At least one column is required');
        }

        // Check if table already exists
        const existingTables = await executor.listTables();
        if (existingTables.map(t => t.toLowerCase()).includes(tableName.toLowerCase())) {
          return resultBuilder.error(`Table "${tableName}" already exists`);
        }

        const operation: SchemaOperation = {
          type: 'CREATE_TABLE',
          datasource: 'default',
          collection: tableName,
          timestamp: new Date(),
          caller: {
            id: context.caller.id,
            email: context.caller.email,
            permissionLevel: context.caller.permissionLevel,
          },
          details: { tableName, columns },
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
          await executor.createTable(tableName, { name: tableName, columns });
        });

        if (!result.success) {
          return resultBuilder.error(result.error!);
        }

        return resultBuilder.success(ActionHelpers.formatSuccessMessage(operation));
      } catch (error: any) {
        return resultBuilder.error(`Failed to create table: ${error.message}`);
      }
    },
  });
}
