import { ConditionTree, ConditionTreeFactory } from '@forestadmin/datasource-toolkit';

export default function buildDefaultCondition(isNegated: boolean): ConditionTree {
  return isNegated ? ConditionTreeFactory.MatchAll : ConditionTreeFactory.MatchNone;
}
