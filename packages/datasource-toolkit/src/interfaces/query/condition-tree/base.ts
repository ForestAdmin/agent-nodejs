import { RecordData } from '../../record';
import Projection from '../projection';
import { AsyncLeafReplacer, LeafCallback, LeafReplacer, LeafTester } from './leaf';

export default abstract class ConditionTree {
  abstract inverse(): ConditionTree;
  abstract replaceLeafs(handler: LeafReplacer, bind?: unknown): ConditionTree;
  abstract replaceLeafsAsync(handler: AsyncLeafReplacer, bind?: unknown): Promise<ConditionTree>;

  abstract match(record: RecordData): boolean;

  abstract forEachLeaf(handler: LeafCallback): void;
  abstract everyLeaf(handler: LeafTester): boolean;
  abstract someLeaf(handler: LeafTester): boolean;

  abstract get projection(): Projection;

  apply(records: RecordData[]): RecordData[] {
    return records.filter(r => this.match(r));
  }

  nest(field: string): ConditionTree {
    return this.replaceLeafs(leaf => leaf.override({ field: `${field}:${leaf.field}` }));
  }

  unnest(): ConditionTree {
    let prefix = null;
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
