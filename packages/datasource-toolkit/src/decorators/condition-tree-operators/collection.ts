import { Filter, Operator } from '../../interfaces/query/selection';
import {
  CollectionSchema,
  ColumnSchema,
  FieldTypes,
  PrimitiveTypes,
} from '../../interfaces/schema';
import CollectionUtils from '../../utils/collection';
import ConditionTreeUtils from '../../utils/condition-tree';
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
    const fields = {};

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

  protected override refineFilter(filter?: Filter): Filter {
    const conditionTree = ConditionTreeUtils.replaceLeafs(filter.conditionTree, leaf => {
      const schema = CollectionUtils.getFieldSchema(this.childCollection, leaf.field);

      return this.getReplacer(leaf.operator, schema as ColumnSchema)(leaf, filter.timezone);
    });

    return { ...filter, conditionTree };
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
          return this.chain(replacer, dependsOn, dependsReplacers);
        }
      }
    }

    return null;
  }

  /** Chain multiple replacers */
  private chain(replacer: Replacer, dependsOn: string[], dependsReplacers: Replacer[]): Replacer {
    return (leaf, timezone) => {
      const tree = replacer(leaf, timezone);

      return ConditionTreeUtils.replaceLeafs(tree, subLeaf => {
        const subReplacerIndex = dependsOn.indexOf(subLeaf.operator);

        return dependsReplacers[subReplacerIndex](subLeaf, timezone);
      });
    };
  }
}
