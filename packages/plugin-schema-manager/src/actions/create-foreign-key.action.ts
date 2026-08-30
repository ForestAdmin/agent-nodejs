import { CollectionCustomizer } from '@forestadmin/datasource-customizer';
import { SchemaExecutor, SchemaManagerOptions, SchemaOperation } from '../types';
import { ActionHelpers } from '../utils/action-helpers';

export function addCreateForeignKeyAction(
  collection: CollectionCustomizer,
  executor: SchemaExecutor,
  options: SchemaManagerOptions,
): void {
  if (!executor.supportsOperation('CREATE_FOREIGN_KEY')) {
    return;
  }

  collection.addAction('Schema: Create Foreign Key', {
    scope: 'Global',
    form: [
      {
        label: 'FK Name',
        type: 'String',
        description: 'Name of the foreign key constraint (auto-generated if empty)',
      },
      {
        label: 'Columns (comma-separated)',
        type: 'String',
        isRequired: true,
        description: 'Local column names (e.g., "user_id" or "user_id,tenant_id")',
      },
      {
        label: 'Referenced Table',
        type: 'String',
        isRequired: true,
        description: 'Name of the referenced table',
      },
      {
        label: 'Referenced Columns (comma-separated)',
        type: 'String',
        isRequired: true,
        description: 'Referenced column names (e.g., "id" or "id,id")',
      },
      {
        label: 'On Delete',
        type: 'Enum',
        enumValues: ['CASCADE', 'SET NULL', 'NO ACTION', 'RESTRICT', 'SET DEFAULT'],
        defaultValue: 'NO ACTION',
        description: 'Action when referenced row is deleted',
      },
      {
        label: 'On Update',
        type: 'Enum',
        enumValues: ['CASCADE', 'SET NULL', 'NO ACTION', 'RESTRICT', 'SET DEFAULT'],
        defaultValue: 'NO ACTION',
        description: 'Action when referenced row is updated',
      },
    ],
    execute: async (context, resultBuilder) => {
      try {
        // Permissions
        const permCheck = await ActionHelpers.validatePermissions(context.caller, options);
        if (!permCheck.isValid) {
          return resultBuilder.error(permCheck.error!);
        }

        const fkName = context.formValues['FK Name'];
        const columnsStr = context.formValues['Columns (comma-separated)'];
        const referencedTable = context.formValues['Referenced Table'];
        const referencedColumnsStr = context.formValues['Referenced Columns (comma-separated)'];
        const onDelete = context.formValues['On Delete'];
        const onUpdate = context.formValues['On Update'];

        // Parse columns
        const columns = columnsStr
          .split(',')
          .map((c: string) => c.trim())
          .filter((c: string) => c.length > 0);
        const referencedColumns = referencedColumnsStr
          .split(',')
          .map((c: string) => c.trim())
          .filter((c: string) => c.length > 0);

        if (columns.length !== referencedColumns.length) {
          return resultBuilder.error(
            'Number of columns must match number of referenced columns',
          );
        }

        // Validate columns exist
        const tableDesc = await executor.describeTable(collection.name);
        for (const col of columns) {
          const exists = tableDesc.columns.find(
            c => c.name.toLowerCase() === col.toLowerCase(),
          );
          if (!exists) {
            return resultBuilder.error(`Column "${col}" does not exist in current table`);
          }
        }

        // Validate referenced table exists
        const tables = await executor.listTables();
        if (!tables.map(t => t.toLowerCase()).includes(referencedTable.toLowerCase())) {
          return resultBuilder.error(`Referenced table "${referencedTable}" does not exist`);
        }

        const generatedName =
          fkName || `fk_${collection.name}_${columns.join('_')}`;

        const operation: SchemaOperation = {
          type: 'CREATE_FOREIGN_KEY',
          datasource: 'default',
          collection: collection.name,
          timestamp: new Date(),
          caller: {
            id: context.caller.id,
            email: context.caller.email,
            permissionLevel: context.caller.permissionLevel,
          },
          details: {
            fkName: generatedName,
            columns,
            referencedTable,
            referencedColumns,
            onDelete,
            onUpdate,
          },
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
          await executor.createForeignKey(collection.name, {
            name: generatedName,
            columns,
            referencedTable,
            referencedColumns,
            onDelete: onDelete as any,
            onUpdate: onUpdate as any,
          });
        });

        if (!result.success) {
          return resultBuilder.error(result.error!);
        }

        return resultBuilder.success(`✅ Foreign key "${generatedName}" created successfully`);
      } catch (error: any) {
        return resultBuilder.error(`Failed to create foreign key: ${error.message}`);
      }
    },
  });
}
