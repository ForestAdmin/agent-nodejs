import type { ConditionTree } from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory } from '@forestadmin/datasource-toolkit';

export default function buildDefaultCondition(isNegated: boolean): ConditionTree {
  return isNegated ? ConditionTreeFactory.MatchAll : ConditionTreeFactory.MatchNone;
}
