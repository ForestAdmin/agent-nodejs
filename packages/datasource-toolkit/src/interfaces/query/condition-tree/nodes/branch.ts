import { AsyncLeafReplacer, LeafCallback, LeafComponents, LeafReplacer, LeafTester } from './leaf';
import { Collection } from '../../../collection';
import { RecordData } from '../../../record';
import ConditionTree from './base';
import Projection from '../../projection';

export type Aggregator = 'And' | 'Or';

export type BranchComponents = {
  aggregator: Aggregator;
  conditions: Array<BranchComponents | LeafComponents>;
};

export default class ConditionTreeBranch extends ConditionTree {
  aggregator: Aggregator;
  conditions: ConditionTree[];

  get projection(): Projection {
    return this.conditions.reduce(
      (memo, condition) => memo.union(condition.projection),
      new Projection(),
    );
  }

  constructor(aggregator: Aggregator, conditions: ConditionTree[]) {
    super();
    this.aggregator = aggregator;
    this.conditions = conditions;
  }

  forEachLeaf(handler: LeafCallback): void {
    this.conditions.forEach(c => c.forEachLeaf(handler));
  }

  everyLeaf(handler: LeafTester): boolean {
    return this.conditions.every(c => c.everyLeaf(handler));
  }

  someLeaf(handler: LeafTester): boolean {
    return this.conditions.some(c => c.someLeaf(handler));
  }

  inverse(): ConditionTree {
    const aggregator = this.aggregator === 'Or' ? 'And' : 'Or';

    return new ConditionTreeBranch(
      aggregator,
      this.conditions.map(c => c.inverse()),
    );
  }

  replaceLeafs(handler: LeafReplacer, bind?: unknown): ConditionTree {
    return new ConditionTreeBranch(
      this.aggregator,
      this.conditions.map(c => c.replaceLeafs(handler, bind)),
    );
  }

  async replaceLeafsAsync(handler: AsyncLeafReplacer, bind?: unknown): Promise<ConditionTree> {
    return new ConditionTreeBranch(
      this.aggregator,
      await Promise.all(this.conditions.map(c => c.replaceLeafsAsync(handler, bind))),
    );
  }

  match(record: RecordData, collection: Collection, timezone: string): boolean {
    return this.aggregator === 'And'
      ? this.conditions.every(c => c.match(record, collection, timezone))
      : this.conditions.some(c => c.match(record, collection, timezone));
  }
}
