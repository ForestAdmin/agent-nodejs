import type {
  AsyncLeafReplacer,
  LeafCallback,
  LeafReplacer,
  LeafTester,
  PlainConditionTreeLeaf,
} from './leaf';
import type { Collection } from '../../../collection';
import type { RecordData } from '../../../record';

import ConditionTree from './base';
import Projection from '../../projection';

export type Aggregator = 'And' | 'Or';

export type PlainConditionTreeBranch = {
  aggregator: Aggregator;
  conditions: Array<PlainConditionTreeBranch | PlainConditionTreeLeaf>;
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

  override createMatcher(
    collection: Collection,
    timezone: string,
  ): (record: RecordData) => boolean {
    // A condition built by another copy of the toolkit (e.g. deduplicated in a plugin) may predate
    // createMatcher.
    const matchers = this.conditions.map(c =>
      c.createMatcher
        ? c.createMatcher(collection, timezone)
        : (record: RecordData) => c.match(record, collection, timezone),
    );

    return this.aggregator === 'And'
      ? record => matchers.every(matcher => matcher(record))
      : record => matchers.some(matcher => matcher(record));
  }

  match(record: RecordData, collection: Collection, timezone: string): boolean {
    return this.createMatcher(collection, timezone)(record);
  }

  toPlainObject(): PlainConditionTreeBranch {
    return {
      aggregator: this.aggregator,
      conditions: this.conditions.map(c => c.toPlainObject()),
    };
  }
}
