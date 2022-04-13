import { Collection } from '../../../collection';
import { ColumnSchema } from '../../../schema';
import { Operator, allOperators, intervalOperators, uniqueOperators } from './operators';
import { RecordData } from '../../../record';
import CollectionUtils from '../../../../utils/collection';
import ConditionTree, { PlainConditionTree } from './base';
import ConditionTreeEquivalent from '../equivalence';
import ConditionTreeFactory from '../factory';
import Projection from '../../projection';
import RecordUtils from '../../../../utils/record';

export type PlainConditionTreeLeaf = { field: string; operator: Operator; value?: unknown };

type LeafHandler<R> = (leaf: ConditionTreeLeaf) => R;
export type LeafReplacer = LeafHandler<ConditionTree | PlainConditionTree>;
export type AsyncLeafReplacer = LeafHandler<Promise<ConditionTree | PlainConditionTree>>;
export type LeafTester = LeafHandler<boolean>;
export type LeafCallback = LeafHandler<void>;

export default class ConditionTreeLeaf extends ConditionTree {
  field: string;
  operator: Operator;
  value?: unknown;

  get projection(): Projection {
    return new Projection(this.field);
  }

  get useIntervalOperator() {
    return intervalOperators.includes(this.operator as typeof intervalOperators[number]);
  }

  constructor(field: string, operator: Operator, value?: unknown) {
    super();
    this.field = field;
    this.operator = operator;
    this.value = value;
  }

  forEachLeaf(handler: LeafCallback): void {
    handler(this);
  }

  everyLeaf(handler: LeafTester): boolean {
    return handler(this);
  }

  someLeaf(handler: LeafTester): boolean {
    return handler(this);
  }

  inverse(): ConditionTree {
    if (allOperators.includes(`Not${this.operator}` as Operator)) {
      return this.override({ operator: `Not${this.operator}` as Operator });
    }

    if (this.operator.startsWith('Not')) {
      return this.override({ operator: this.operator.substring(3) as Operator });
    }

    switch (this.operator) {
      case 'Blank':
        return this.override({ operator: 'Present' });
      case 'Present':
        return this.override({ operator: 'Blank' });
      default:
        throw new Error(`Operator '${this.operator}' cannot be inverted.`);
    }
  }

  replaceLeafs(handler: LeafReplacer, bind?: unknown): ConditionTree {
    const result: ConditionTree | PlainConditionTree = handler.call(bind, this);

    return result instanceof ConditionTree ? result : ConditionTreeFactory.fromPlainObject(result);
  }

  async replaceLeafsAsync(handler: AsyncLeafReplacer, bind?: unknown): Promise<ConditionTree> {
    const result: ConditionTree | PlainConditionTree = await handler.call(bind, this);

    return result instanceof ConditionTree ? result : ConditionTreeFactory.fromPlainObject(result);
  }

  match(record: RecordData, collection: Collection, timezone: string): boolean {
    const fieldValue = RecordUtils.getFieldValue(record, this.field);
    const { columnType } = CollectionUtils.getFieldSchema(collection, this.field) as ColumnSchema;

    switch (this.operator) {
      case 'Equal':
        return fieldValue == this.value; // eslint-disable-line eqeqeq
      case 'LessThan':
        return fieldValue < this.value;
      case 'GreaterThan':
        return fieldValue > this.value;
      case 'Like':
        return this.like(fieldValue as string, this.value as string);
      case 'LongerThan':
        return (fieldValue as string).length > this.value;
      case 'ShorterThan':
        return (fieldValue as string).length < this.value;
      case 'IncludesAll':
        return !!(this.value as unknown[])?.every(v => (fieldValue as unknown[])?.includes(v));

      case 'NotEqual':
      case 'NotContains':
        return !this.inverse().match(record, collection, timezone);

      default:
        return ConditionTreeEquivalent.getEquivalentTree(
          this,
          new Set(uniqueOperators),
          columnType,
          timezone,
        ).match(record, collection, timezone);
    }
  }

  override(params: Partial<PlainConditionTreeLeaf>): ConditionTreeLeaf {
    return ConditionTreeFactory.fromPlainObject({ ...this, ...params }) as ConditionTreeLeaf;
  }

  override unnest(): ConditionTreeLeaf {
    return super.unnest() as ConditionTreeLeaf;
  }

  /** @see https://stackoverflow.com/a/18418386/1897495 */
  private like(value: string, pattern: string): boolean {
    if (!value) return false;

    let regexp = pattern;

    // eslint-disable-next-line no-useless-escape
    regexp = regexp.replace(/([\.\\\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:\-])/g, '\\$1');
    regexp = regexp.replace(/%/g, '.*').replace(/_/g, '.');

    return RegExp(`^${regexp}$`, 'gi').test(value);
  }
}
