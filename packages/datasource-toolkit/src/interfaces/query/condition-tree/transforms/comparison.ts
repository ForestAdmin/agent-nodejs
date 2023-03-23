import { Alternative } from '../equivalence';
import ConditionTreeFactory from '../factory';
import ConditionTree from '../nodes/base';
import { Operator } from '../nodes/operators';

export default (): Partial<Record<Operator, Alternative[]>> => ({
  Blank: [
    {
      dependsOn: ['In'],
      forTypes: ['String'],
      replacer: leaf => leaf.override({ operator: 'In', value: [null, ''] }),
    },
    {
      dependsOn: ['Missing'],
      replacer: leaf => leaf.override({ operator: 'Missing' }),
    },
  ],
  Missing: [
    {
      dependsOn: ['Equal'],
      replacer: leaf => leaf.override({ operator: 'Equal', value: null }),
    },
  ],
  Present: [
    {
      dependsOn: ['NotIn'],
      forTypes: ['String'],
      replacer: leaf => leaf.override({ operator: 'NotIn', value: [null, ''] }),
    },
    {
      dependsOn: ['NotEqual'],
      replacer: leaf => leaf.override({ operator: 'NotEqual', value: null }),
    },
  ],
  Equal: [
    {
      dependsOn: ['In'],
      replacer: leaf => leaf.override({ operator: 'In', value: [leaf.value] }),
    },
  ],
  In: [
    {
      dependsOn: ['Match'],
      forTypes: ['String'],
      replacer: leaf =>
        leaf.override({
          operator: 'Match',
          value: RegExp(
            `^${(leaf.value as string[])
              .map(str => str.replace(/[.|[\]]/g, m => `\\${m}`))
              .join('|')}$`,
            'gi',
          ),
        }),
    },
    {
      dependsOn: ['Equal'],
      replacer: leaf =>
        ConditionTreeFactory.union(
          ...(leaf.value as unknown[]).map<ConditionTree>(item =>
            leaf.override({ operator: 'Equal', value: item }),
          ),
        ),
    },
  ],
  NotEqual: [
    {
      dependsOn: ['NotIn'],
      replacer: leaf => leaf.override({ operator: 'NotIn', value: [leaf.value] }),
    },
  ],
  NotIn: [
    {
      dependsOn: ['NotEqual'],
      replacer: leaf =>
        ConditionTreeFactory.intersect(
          ...(leaf.value as unknown[]).map<ConditionTree>(item =>
            leaf.override({ operator: 'NotEqual', value: item }),
          ),
        ),
    },
  ],
});
