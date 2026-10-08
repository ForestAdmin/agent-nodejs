import { CollectionCustomizer } from '@forestadmin/datasource-customizer';
import { SchemaExecutor, SchemaManagerOptions, SchemaOperation } from '../types';
import { ActionHelpers } from '../utils/action-helpers';

export function addCreateIndexAction(
  collection: CollectionCustomizer,
  executor: SchemaExecutor,
  options: SchemaManagerOptions,
): void {
  if (!executor.supportsOperation('CREATE_INDEX')) {
    return;
  }

  collection.addAction('Schema: Create Index', {
    scope: 'Global',
    form: [
      {
        label: 'Index Name',
        type: 'String',
        description: 'Name of the index (auto-generated if empty)',
      },
      {
        label: 'Columns (comma-separated)',
        type: 'String',
        isRequired: true,
        description: 'Column names separated by commas (e.g., "email" or "user_id,status")',
      },
      {
        label: 'Unique',
        type: 'Boolean',
        defaultValue: false,
        description: 'Should this be a unique index?',
      },
      {
        label: 'Index Type',
        type: 'Enum',
        enumValues: ['BTREE', 'HASH', 'GIST', 'GIN', 'FULLTEXT', 'SPATIAL'],
        defaultValue: 'BTREE',
        description: 'Type of index (not all types supported by all databases)',
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
        const columnsStr = context.formValues['Columns (comma-separated)'];
        const unique = context.formValues['Unique'];
        const indexType = context.formValues['Index Type'];

        // Parse columns
        const columns = columnsStr
          .split(',')
          .map((c: string) => c.trim())
          .filter((c: string) => c.length > 0);

        if (columns.length === 0) {
          return resultBuilder.error('At least one column is required');
        }

        // Validate columns exist
        const tableDesc = await executor.describeTable(collection.name);
        for (const col of columns) {
          const exists = tableDesc.columns.find(
            c => c.name.toLowerCase() === col.toLowerCase(),
          );
          if (!exists) {
            return resultBuilder.error(`Column "${col}" does not exist`);
          }
        }

        const generatedName = indexName || `idx_${collection.name}_${columns.join('_')}`;

        const operation: SchemaOperation = {
          type: 'CREATE_INDEX',
          datasource: 'default',
          collection: collection.name,
          timestamp: new Date(),
          caller: {
            id: context.caller.id,
            email: context.caller.email,
            permissionLevel: context.caller.permissionLevel,
          },
          details: {
            indexName: generatedName,
            columns,
            unique,
            type: indexType,
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
          await executor.createIndex(collection.name, {
            name: generatedName,
            columns,
            unique,
            type: indexType as any,
          });
        });

        if (!result.success) {
          return resultBuilder.error(result.error!);
        }

        return resultBuilder.success(`✅ Index "${generatedName}" created successfully`);
      } catch (error: any) {
        return resultBuilder.error(`Failed to create index: ${error.message}`);
      }
    },
  });
}
