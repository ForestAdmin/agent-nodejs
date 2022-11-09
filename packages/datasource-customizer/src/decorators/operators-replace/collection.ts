import {
  Caller,
  CollectionSchema,
  ColumnSchema,
  ConditionTreeEquivalent,
  FieldSchema,
  PaginatedFilter,
  allOperators,
} from '@forestadmin/datasource-toolkit';

import CollectionDecorator from '../collection-decorator';

/**
 * Decorator which emulates filter operators from others.
 */
export default class OperatorsDecorator extends CollectionDecorator {
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

    return Object.assign(new CollectionSchema(), { ...childSchema, fields });
  }

  protected override async refineFilter(
    caller: Caller,
    filter?: PaginatedFilter,
  ): Promise<PaginatedFilter> {
    return filter?.override({
      conditionTree: filter.conditionTree?.replaceLeafs(leaf => {
        const schema = this.childCollection.getFieldSchema(leaf.field) as ColumnSchema;

        return ConditionTreeEquivalent.getEquivalentTree(
          leaf,
          schema.filterOperators,
          schema.columnType,
          caller.timezone,
        );
      }),
    });
  }
}
