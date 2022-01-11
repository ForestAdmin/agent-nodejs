import { Aggregator, ConditionTree, ConditionTreeBranch } from '../interfaces/query/selection';

export const ConditionTreeNotMatchAnyResult = Object.freeze({
  aggregator: 'or',
  conditions: [],
});

export default class ConditionTreeUtils {
  static buildConditionsTree(...conditionTrees: ConditionTree[]): ConditionTree {
    const conditions = conditionTrees.reduce((currentConditions, condition) => {
      if (!condition) return currentConditions;

      return ConditionTreeUtils.isConditionTreeBranch(condition) &&
        condition.aggregator === Aggregator.And
        ? [...currentConditions, ...condition.conditions]
        : [...currentConditions, condition];
    }, []);

    if (conditions.length === 1) {
      return conditions[0];
    }

    return { aggregator: Aggregator.And, conditions };
  }

  static isConditionTreeBranch(conditionTree: ConditionTree): conditionTree is ConditionTreeBranch {
    return (conditionTree as ConditionTreeBranch).aggregator !== undefined;
  }
}
