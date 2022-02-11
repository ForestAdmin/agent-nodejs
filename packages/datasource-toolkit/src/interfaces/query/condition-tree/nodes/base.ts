import { AsyncLeafReplacer, LeafCallback, LeafReplacer, LeafTester } from './leaf';
import { Collection } from '../../../collection';
import { RecordData } from '../../../record';
import Projection from '../../projection';

export default abstract class ConditionTree {
  abstract inverse(): ConditionTree;
  abstract replaceLeafs(handler: LeafReplacer, bind?: unknown): ConditionTree;
  abstract replaceLeafsAsync(handler: AsyncLeafReplacer, bind?: unknown): Promise<ConditionTree>;

  abstract match(record: RecordData, collection: Collection, timezone: string): boolean;

  abstract forEachLeaf(handler: LeafCallback): void;
  abstract everyLeaf(handler: LeafTester): boolean;
  abstract someLeaf(handler: LeafTester): boolean;

  abstract get projection(): Projection;

  apply(records: RecordData[], collection: Collection, timezone: string): RecordData[] {
    return records.filter(record => this.match(record, collection, timezone));
  }

  nest(prefix: string): ConditionTree {
    return prefix && prefix.length
      ? this.replaceLeafs(leaf => leaf.override({ field: `${prefix}:${leaf.field}` }))
      : this;
  }

  unnest(): ConditionTree {
    let prefix: string = null;
    this.someLeaf(leaf => {
      [prefix] = leaf.field.split(':');

      return false;
    });

    if (!this.everyLeaf(leaf => leaf.field.startsWith(prefix))) {
      throw new Error('Cannot unnest condition tree.');
    }

    return this.replaceLeafs(leaf =>
      leaf.override({ field: leaf.field.substring(prefix.length + 1) }),
    );
  }

  replaceFields(handler: (field: string) => string): ConditionTree {
    return this.replaceLeafs(leaf => leaf.override({ field: handler(leaf.field) }));
  }
}
