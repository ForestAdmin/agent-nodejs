import { Alternative } from '../equivalence';
import ConditionTreeFactory from '../factory';
import ConditionTree from '../nodes/base';
import ConditionTreeLeaf from '../nodes/leaf';
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
      dependsOn: ['Equal', 'Match'],
      forTypes: ['String'],
      replacer: leaf => {
        const values = leaf.value as string[];
        const conditions = [];

        for (const value of [null, ''])
          if (values.includes(value))
            conditions.push(new ConditionTreeLeaf(leaf.field, 'Equal', value));

        if (values.some(v => v !== null && v !== '')) {
          const escaped = values.filter(Boolean).map(str => str.replace(/[.|[\]]/g, m => `\\${m}`));
          const regexp = new RegExp(`^${escaped.join('|')}$`, 'g');
          conditions.push(new ConditionTreeLeaf(leaf.field, 'Match', regexp));
        }

        return ConditionTreeFactory.union(...conditions);
      },
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
      dependsOn: ['NotEqual', 'Match'],
      forTypes: ['String'],
      replacer: leaf => {
        const values = leaf.value as string[];
        const conditions = [];

        for (const value of [null, ''])
          if (values.includes(value))
            conditions.push(new ConditionTreeLeaf(leaf.field, 'NotEqual', value));

        if (values.some(v => v !== null && v !== '')) {
          const escaped = values.filter(Boolean).map(str => str.replace(/[.|[\]]/g, m => `\\${m}`));
          const regexp = new RegExp(`(?!${escaped.join('|')})`, 'g');
          conditions.push(new ConditionTreeLeaf(leaf.field, 'Match', regexp));
        }

        return ConditionTreeFactory.intersect(...conditions);
      },
    },
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
