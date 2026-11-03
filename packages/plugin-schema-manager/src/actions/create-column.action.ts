import { CollectionCustomizer } from '@forestadmin/datasource-customizer';
import { SchemaExecutor, SchemaManagerOptions, SchemaOperation } from '../types';
import { ActionHelpers } from '../utils/action-helpers';
import { TypeValidator } from '../validators/type-validator';

export function addCreateColumnAction(
  collection: CollectionCustomizer,
  executor: SchemaExecutor,
  options: SchemaManagerOptions,
): void {
  if (!executor.supportsOperation('CREATE_COLUMN')) {
    return;
  }

  collection.addAction('Schema: Add Column', {
    scope: 'Global',
    form: [
      {
        label: 'Column Name',
        type: 'String',
        isRequired: true,
        description: 'Name of the new column (snake_case recommended)',
      },
      {
        label: 'Data Type',
        type: 'Enum',
        enumValues: executor.getSupportedTypes(),
        isRequired: true,
        description: 'Data type for the column',
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
        description: 'Default value (leave empty for no default)',
      },
      {
        label: 'Comment',
        type: 'String',
        description: 'Optional comment/description for this column',
      },
      {
        label: 'Unique',
        type: 'Boolean',
        defaultValue: false,
        description: 'Should this column have unique values?',
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
        const dataType = context.formValues['Data Type'];
        const allowNull = context.formValues['Allow Null'];
        const defaultValue = context.formValues['Default Value'];
        const comment = context.formValues['Comment'];
        const unique = context.formValues['Unique'];

        // Validate column name
        const nameCheck = ActionHelpers.validateIdentifier(columnName, 'column', options);
        if (!nameCheck.isValid) {
          return resultBuilder.error(nameCheck.error!);
        }

        // Validate type
        const typeValidator = new TypeValidator();
        const typeCheck = typeValidator.validateType(dataType, executor.getSupportedTypes());
        if (!typeCheck.isValid) {
          return resultBuilder.error(typeCheck.errors.join(', '));
        }

        // Validate default value
        if (defaultValue) {
          const defaultCheck = typeValidator.validateDefaultValue(defaultValue, dataType);
          if (!defaultCheck.isValid) {
            return resultBuilder.error(defaultCheck.errors.join(', '));
          }
        }

        // Check if column already exists
        const tableDesc = await executor.describeTable(collection.name);
        const existingColumn = tableDesc.columns.find(
          col => col.name.toLowerCase() === columnName.toLowerCase(),
        );
        if (existingColumn) {
          return resultBuilder.error(`Column "${columnName}" already exists`);
        }

        const operation: SchemaOperation = {
          type: 'CREATE_COLUMN',
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
            type: dataType,
            allowNull,
            defaultValue: defaultValue || undefined,
            comment: comment || undefined,
            unique,
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
          await executor.createColumn(collection.name, {
            name: columnName,
            type: dataType,
            allowNull,
            defaultValue: defaultValue || undefined,
            comment: comment || undefined,
            unique,
          });
        });

        if (!result.success) {
          return resultBuilder.error(result.error!);
        }

        return resultBuilder.success(ActionHelpers.formatSuccessMessage(operation));
      } catch (error: any) {
        return resultBuilder.error(`Failed to create column: ${error.message}`);
      }
    },
  });
}
