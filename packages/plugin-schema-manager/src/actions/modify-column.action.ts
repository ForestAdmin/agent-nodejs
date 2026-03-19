import { CollectionCustomizer } from '@forestadmin/datasource-customizer';
import { SchemaExecutor, SchemaManagerOptions, SchemaOperation } from '../types';
import { ActionHelpers } from '../utils/action-helpers';
import { TypeValidator } from '../validators/type-validator';

export function addModifyColumnAction(
  collection: CollectionCustomizer,
  executor: SchemaExecutor,
  options: SchemaManagerOptions,
): void {
  if (!executor.supportsOperation('MODIFY_COLUMN')) {
    return;
  }

  collection.addAction('Schema: Modify Column', {
    scope: 'Global',
    form: [
      {
        label: 'Column Name',
        type: 'String',
        isRequired: true,
        description: 'Name of the column to modify',
      },
      {
        label: 'New Data Type',
        type: 'Enum',
        enumValues: executor.getSupportedTypes(),
        isRequired: true,
        description: 'New data type for the column',
      },
      {
        label: 'Allow Null',
        type: 'Boolean',
        defaultValue: true,
        description: 'Can this column contain NULL values?',
      },
      {
        label: 'Default Value',
        type: 'String',
        description: 'New default value (leave empty to keep existing)',
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
        const newType = context.formValues['New Data Type'];
        const allowNull = context.formValues['Allow Null'];
        const defaultValue = context.formValues['Default Value'];

        // Check if column exists
        const tableDesc = await executor.describeTable(collection.name);
        const column = tableDesc.columns.find(
          col => col.name.toLowerCase() === columnName.toLowerCase(),
        );
        if (!column) {
          return resultBuilder.error(`Column "${columnName}" does not exist`);
        }

        // Validate type change
        const typeValidator = new TypeValidator();
        const typeChangeCheck = typeValidator.validateTypeChange(
          column.type,
          newType,
          executor.dialect,
        );

        let warningMessage = '';
        if (typeChangeCheck.warnings && typeChangeCheck.warnings.length > 0) {
          warningMessage = '\n\n⚠️  Warnings:\n' + typeChangeCheck.warnings.join('\n');
        }

        const operation: SchemaOperation = {
          type: 'MODIFY_COLUMN',
          datasource: 'default',
          collection: collection.name,
          timestamp: new Date(),
          caller: {
            id: context.caller.id,
            email: context.caller.email,
            permissionLevel: context.caller.permissionLevel,
          },
          details: {
            columnName,
            type: newType,
            allowNull,
            defaultValue: defaultValue || undefined,
          },
          dryRun: options.dryRunMode || false,
        };

        // Dry-run mode
        if (options.dryRunMode) {
          const ddl = executor.buildDDL(operation);
          return resultBuilder.success(
            `DRY RUN - The following DDL would be executed:\n\n${ddl}${warningMessage}\n\nNo changes were made.`,
          );
        }

        // Execute with callbacks
        const result = await ActionHelpers.runWithCallbacks(operation, options, async () => {
          await executor.modifyColumn(collection.name, columnName, {
            name: columnName,
            type: newType,
            allowNull,
            defaultValue: defaultValue || undefined,
          });
        });

        if (!result.success) {
          return resultBuilder.error(result.error!);
        }

        return resultBuilder.success(
          `✅ Column "${columnName}" modified successfully${warningMessage}`,
        );
      } catch (error: any) {
        return resultBuilder.error(`Failed to modify column: ${error.message}`);
      }
    },
  });
}
