import {
  Caller,
  CollectionCapabilities,
  CollectionDecorator,
  CollectionSchema,
  CollectionUtils,
  ColumnSchema,
  ConditionTreeEquivalent,
  FieldSchema,
  PaginatedFilter,
  allOperators,
} from '@forestadmin/datasource-toolkit';

/**
 * Replace unsupported operators in conditions trees by an equivalent subtree which is supported.
 *
 * For example, the "IContains" operator is not supported by most driver, so it is replaced by a
 * "ILike" operator.
 */
export default class OperatorsEquivalenceCollectionDecorator extends CollectionDecorator {
  protected override refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [name, schema] of Object.entries(childSchema.fields)) {
      if (schema.type === 'Column') {
        const newOperators = allOperators.filter(operator =>
          ConditionTreeEquivalent.hasEquivalentTree(
            operator,
            schema.filterOperators,
            schema.columnType,
          ),
        );

        fields[name] = { ...schema, filterOperators: new Set(newOperators) };
      } else {
        fields[name] = schema;
      }
    }

    return { ...childSchema, fields };
  }

  protected override async refineFilter(
    caller: Caller,
    filter?: PaginatedFilter,
  ): Promise<PaginatedFilter> {
    return filter?.override({
      conditionTree: filter.conditionTree?.replaceLeafs(leaf => {
        const schema = CollectionUtils.getFieldSchema(
          this.childCollection,
          leaf.field,
        ) as ColumnSchema;

        return ConditionTreeEquivalent.getEquivalentTree(
          leaf,
          schema.filterOperators,
          schema.columnType,
          caller.timezone,
        );
      }),
    });
  }

  private pascalCaseToSnakeCase(str: string): string {
    return str
      .split(/\.?(?=[A-Z])/)
      .join('_')
      .toLowerCase();
  }

  override refineCapabilities(capabilities: CollectionCapabilities): CollectionCapabilities {
    const fields = Object.entries(this.schema.fields)
      .map(([fieldName, field]) => {
        return field.type === 'Column'
          ? {
              name: fieldName,
              type: field.columnType,
              operators: [...field.filterOperators].map(this.pascalCaseToSnakeCase),
            }
          : null;
      })
      .filter(Boolean);

    return { ...capabilities, fields };
  }
}
