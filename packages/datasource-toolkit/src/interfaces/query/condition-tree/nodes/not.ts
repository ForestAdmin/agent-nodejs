import { AsyncLeafReplacer, LeafCallback, LeafReplacer, LeafTester } from './leaf';
import { Collection } from '../../../collection';
import { RecordData } from '../../../record';
import ConditionTree from './base';
import Projection from '../../projection';

export default class ConditionTreeNot extends ConditionTree {
  condition: ConditionTree;

  get projection(): Projection {
    return this.condition.projection;
  }

  constructor(condition: ConditionTree) {
    super();
    this.condition = condition;
  }

  forEachLeaf(handler: LeafCallback): void {
    this.condition.forEachLeaf(c => c.forEachLeaf(handler));
  }

  everyLeaf(handler: LeafTester): boolean {
    return this.condition.everyLeaf(handler);
  }

  someLeaf(handler: LeafTester): boolean {
    return this.condition.someLeaf(handler);
  }

  inverse(): ConditionTree {
    return this.condition;
  }

  replaceLeafs(handler: LeafReplacer, bind?: unknown): ConditionTree {
    return new ConditionTreeNot(this.condition.replaceLeafs(handler, bind));
  }

  async replaceLeafsAsync(handler: AsyncLeafReplacer, bind?: unknown): Promise<ConditionTree> {
    return new ConditionTreeNot(await this.condition.replaceLeafsAsync(handler, bind));
  }

  match(record: RecordData, collection: Collection, timezone: string): boolean {
    return !this.condition.match(record, collection, timezone);
  }
}
