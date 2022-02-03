import { Operator } from '../../interfaces/query/condition-tree/leaf';
import PaginatedFilter from '../../interfaces/query/filter/paginated';
import {
  CollectionSchema,
  ColumnSchema,
  FieldSchema,
  FieldTypes,
  PrimitiveTypes,
} from '../../interfaces/schema';
import CollectionUtils from '../../utils/collection';
import CollectionDecorator from '../collection-decorator';
import equalityTransforms from './transforms/comparison';
import patternTransforms from './transforms/pattern';
import timeTransforms from './transforms/time';
import { Alternative, Replacer } from './types';

/**
 * Decorator which emulates filter operators from others.
 */
export default class OperatorsDecorator extends CollectionDecorator {
  private static alternatives: Partial<Record<Operator, Alternative[]>> = {
    ...equalityTransforms,
    ...patternTransforms,
    ...timeTransforms,
  };

  protected refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [name, schema] of Object.entries(childSchema.fields)) {
      if (schema.type === FieldTypes.Column) {
        const newOperators = Object.values(Operator).filter(op => !!this.getReplacer(op, schema));

        fields[name] = { ...schema, filterOperators: new Set(newOperators) };
      } else {
        fields[name] = schema;
      }
    }

    return { ...childSchema, fields };
  }

  protected override async refineFilter(filter?: PaginatedFilter): Promise<PaginatedFilter> {
    return filter?.override({
      conditionTree: filter.conditionTree?.replaceLeafs(leaf => {
        const schema = CollectionUtils.getFieldSchema(this.childCollection, leaf.field);

        return this.getReplacer(leaf.operator, schema as ColumnSchema)(leaf, filter.timezone);
      }),
    });
  }

  /** Find a way to replace an operator by recursively exploring the transforms graph */
  private getReplacer(op: Operator, schema: ColumnSchema, visited: unknown[] = []): Replacer {
    const { filterOperators, columnType } = schema;

    if (filterOperators.has(op)) return leaf => leaf;

    for (const alt of OperatorsDecorator.alternatives[op] ?? []) {
      const { replacer, dependsOn } = alt;
      const valid = !alt.forTypes || alt.forTypes.includes(columnType as PrimitiveTypes);

      if (valid && !visited.includes(alt)) {
        const dependsReplacers = dependsOn.map(replacement => {
          return this.getReplacer(replacement, schema, [...visited, alt]);
        });

        if (dependsReplacers.every(r => !!r)) {
          return (leaf, timezone) =>
            replacer(leaf, timezone).replaceLeafs(subLeaf =>
              dependsReplacers[dependsOn.indexOf(subLeaf.operator)](subLeaf, timezone),
            );
        }
      }
    }

    return null;
  }
}
