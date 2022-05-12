import { Caller } from '../../interfaces/caller';
import { CollectionSchema, ColumnSchema, FieldSchema } from '../../interfaces/schema';
import { allOperators } from '../../interfaces/query/condition-tree/nodes/operators';
import CollectionDecorator from '../collection-decorator';
import CollectionUtils from '../../utils/collection';
import ConditionTreeEquivalent from '../../interfaces/query/condition-tree/equivalence';
import PaginatedFilter from '../../interfaces/query/filter/paginated';

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
}
