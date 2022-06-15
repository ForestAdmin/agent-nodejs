/* eslint-disable */
import {
  ConditionTreeBranch as Branch,
  ConditionTreeLeaf as Leaf,
  ConditionTree as Tree,
  Aggregator,
} from '@forestadmin/datasource-toolkit';
import { Condition } from 'dynamoose';

export default class ConditionBuilder {
  static fromTree(tree: Tree) {
    if (!tree) return undefined;
    if (tree instanceof Branch) return this.convertBranch(tree);
    if (tree instanceof Leaf) return this.addCondition(new Condition(tree.field), tree);

    throw new Error(`Unexpected Tree subclass`);
  }

  private static convertBranch(branch: Branch) {
    // Process all leafs first.
    const [firstLeaf, ...otherLeafs] = branch.conditions.filter(c => c instanceof Leaf) as Leaf[];
    let condition = new Condition(firstLeaf.field);
    condition = this.addCondition(condition, firstLeaf);

    for (const otherLeaf of otherLeafs) {
      condition = this.andOr(branch.aggregator, condition);
      condition = condition.where(otherLeaf.field);
      condition = this.addCondition(condition, otherLeaf);
    }

    // dynamoose seems to have trouble finding indexes when using parenthesis()
    // so we're doing that only for nested ors
    const subBranches = branch.conditions.filter(c => c instanceof Branch) as Branch[];

    for (const subBranch of subBranches) {
      condition = this.andOr(branch.aggregator, condition);
      condition = condition.parenthesis(this.fromTree(subBranch));
    }

    return condition;
  }

  private static andOr(aggregator: Aggregator, condition: any) {
    return aggregator === 'And' ? condition : condition.or();
  }

  private static addCondition(condition: any, leaf: Leaf) {
    if (leaf.operator === 'Equal') return condition.eq(leaf.value);
    if (leaf.operator === 'Present') return condition.exists();
    if (leaf.operator === 'LessThan') return condition.lt(leaf.value);
    if (leaf.operator === 'GreaterThan') return condition.gt(leaf.value);
    if (leaf.operator === 'StartsWith') return condition.beginsWith(leaf.value);
    if (leaf.operator === 'Contains') return condition.contains(leaf.value);
    if (leaf.operator === 'In') return condition.in(leaf.value);
    if (leaf.operator === 'NotEqual') return condition.not().eq(leaf.value);
    if (leaf.operator === 'NotContains') return condition.not().contains(leaf.value);
    if (leaf.operator === 'Missing') return condition.not().exists();

    throw new Error(`Unexpected Leaf operator: ${leaf.operator}`);
  }
}
