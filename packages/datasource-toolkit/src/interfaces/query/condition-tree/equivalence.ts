import { ColumnType, PrimitiveTypes } from '../../schema';
import ConditionTree from './nodes/base';
import ConditionTreeLeaf, { Operator } from './nodes/leaf';
import equalityTransforms from './transforms/comparison';
import patternTransforms from './transforms/pattern';
import timeTransforms from './transforms/time';

export type Replacer = (leaf: ConditionTreeLeaf, timezone: string) => ConditionTree;

export type Alternative = {
  dependsOn: Operator[];
  replacer: Replacer;
  forTypes?: PrimitiveTypes[];
};

export default class ConditionTreeEquivalent {
  private static alternatives: Partial<Record<Operator, Alternative[]>> = null;

  static getEquivalentTree(
    leaf: ConditionTreeLeaf,
    operators: Set<Operator>,
    columnType: ColumnType,
    timezone: string,
  ): ConditionTree {
    const { operator } = leaf;

    return ConditionTreeEquivalent.getReplacer(operator, operators, columnType)(leaf, timezone);
  }

  static hasEquivalentTree(
    operator: Operator,
    operators: Set<Operator>,
    columnType: ColumnType,
  ): boolean {
    return !!ConditionTreeEquivalent.getReplacer(operator, operators, columnType);
  }

  /** Find a way to replace an operator by recursively exploring the transforms graph */
  private static getReplacer(
    op: Operator,
    filterOperators: Set<Operator>,
    columnType: ColumnType,
    visited: unknown[] = [],
  ): Replacer {
    if (filterOperators?.has(op)) return leaf => leaf;

    for (const alt of ConditionTreeEquivalent.getAlternatives(op) ?? []) {
      const { replacer, dependsOn } = alt;
      const valid = !alt.forTypes || alt.forTypes.includes(columnType as PrimitiveTypes);

      if (valid && !visited.includes(alt)) {
        const dependsReplacers = dependsOn.map(replacement => {
          return this.getReplacer(replacement, filterOperators, columnType, [...visited, alt]);
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

  private static getAlternatives(operator: Operator): Alternative[] {
    // Init cache at first call to work around cyclic dependencies
    if (!ConditionTreeEquivalent.alternatives) {
      ConditionTreeEquivalent.alternatives = {
        ...equalityTransforms(),
        ...patternTransforms(),
        ...timeTransforms(),
      };
    }

    return ConditionTreeEquivalent.alternatives[operator];
  }
}
