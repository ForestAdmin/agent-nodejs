import type { PlainConditionTree } from './base';
import type { Operator } from './operators';
import type { Collection } from '../../../collection';
import type { RecordData } from '../../../record';
import type { ColumnSchema } from '../../../schema';

import ConditionTree from './base';
import { allOperators, intervalOperators } from './operators';
import CollectionUtils from '../../../../utils/collection';
import RecordUtils from '../../../../utils/record';
import Projection from '../../projection';
import ConditionTreeEquivalent from '../equivalence';
import ConditionTreeFactory from '../factory';

export type PlainConditionTreeLeaf = { field: string; operator: Operator; value?: unknown };

type LeafHandler<R> = (leaf: ConditionTreeLeaf) => R;
export type LeafReplacer = LeafHandler<ConditionTree | PlainConditionTree>;
export type AsyncLeafReplacer = LeafHandler<Promise<ConditionTree | PlainConditionTree>>;
export type LeafTester = LeafHandler<boolean>;
export type LeafCallback = LeafHandler<void>;

type FieldMatcher = (record: RecordData, fieldValue: unknown) => boolean;

const SUPPORTED_OPERATORS = new Set<Operator>([
  'In',
  'Equal',
  'LessThan',
  'GreaterThan',
  'LessThanOrEqual',
  'GreaterThanOrEqual',
  'Match',
  'StartsWith',
  'EndsWith',
  'LongerThan',
  'ShorterThan',
  'IncludesAll',
  'IncludesNone',
  'NotIn',
  'NotEqual',
  'NotContains',
]);

export default class ConditionTreeLeaf extends ConditionTree {
  field: string;
  operator: Operator;
  value?: unknown;

  get projection(): Projection {
    return new Projection(this.field);
  }

  get useIntervalOperator() {
    return intervalOperators.includes(this.operator as (typeof intervalOperators)[number]);
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

  override createMatcher(
    collection: Collection,
    timezone: string,
  ): (record: RecordData) => boolean {
    let evaluate: FieldMatcher;

    return record => {
      const fieldValue = RecordUtils.getFieldValue(record, this.field);
      evaluate ??= this.resolveFieldMatcher(collection, timezone);

      return evaluate(record, fieldValue);
    };
  }

  match(record: RecordData, collection: Collection, timezone: string): boolean {
    return this.createMatcher(collection, timezone)(record);
  }

  private resolveFieldMatcher(collection: Collection, timezone: string): FieldMatcher {
    const { columnType } = CollectionUtils.getFieldSchema(collection, this.field) as ColumnSchema;
    const { value } = this;

    switch (this.operator) {
      case 'In':
        return (_, fieldValue) => (value as unknown[])?.includes(fieldValue);
      case 'Equal':
        return (_, fieldValue) => fieldValue == value; // eslint-disable-line eqeqeq
      case 'LessThan':
        return (_, fieldValue) => fieldValue < value;
      case 'GreaterThan':
        return (_, fieldValue) => fieldValue > value;
      case 'LessThanOrEqual':
        return (_, fieldValue) => fieldValue <= value;
      case 'GreaterThanOrEqual':
        return (_, fieldValue) => fieldValue >= value;
      case 'Match':
        return (_, fieldValue) =>
          typeof fieldValue === 'string' && (value as RegExp).test(fieldValue);
      case 'StartsWith':
        return (_, fieldValue) =>
          typeof fieldValue === 'string' && fieldValue.startsWith(value as string);
      case 'EndsWith':
        return (_, fieldValue) =>
          typeof fieldValue === 'string' && fieldValue.endsWith(value as string);
      case 'LongerThan':
        return (_, fieldValue) =>
          typeof fieldValue === 'string' ? fieldValue.length > (value as number) : false;
      case 'ShorterThan':
        return (_, fieldValue) =>
          typeof fieldValue === 'string' ? fieldValue.length < (value as number) : false;
      case 'IncludesAll':
        return (_, fieldValue) =>
          !!(value as unknown[])?.every(v => (fieldValue as unknown[])?.includes(v));
      case 'IncludesNone':
        return (_, fieldValue) =>
          !(value as unknown[])?.some(v => (fieldValue as unknown[])?.includes(v));
      case 'NotIn':
      case 'NotEqual':
      case 'NotContains':
      case 'NotIContains':
        return this.createInverseMatcher(collection, timezone);

      default: {
        const equivalent = ConditionTreeEquivalent.getEquivalentTree(
          this,
          SUPPORTED_OPERATORS,
          columnType,
          timezone,
        );

        if (!equivalent) return record => equivalent.match(record, collection, timezone);

        const matcher = equivalent.createMatcher(collection, timezone);
        const statefulRegExps: RegExp[] = [];
        equivalent.forEachLeaf(({ value: leafValue }) => {
          if (leafValue instanceof RegExp && (leafValue.global || leafValue.sticky)) {
            statefulRegExps.push(leafValue);
          }
        });

        // The equivalent tree used to be rebuilt for every record, so its global regexps (from the
        // Like transforms) always started from lastIndex 0.
        return record => {
          for (const regExp of statefulRegExps) regExp.lastIndex = 0;

          return matcher(record);
        };
      }
    }
  }

  private createInverseMatcher(collection: Collection, timezone: string): FieldMatcher {
    const inverse = this.inverse().createMatcher(collection, timezone);

    return record => !inverse(record);
  }

  override(params: Partial<PlainConditionTreeLeaf>): ConditionTreeLeaf {
    return ConditionTreeFactory.fromPlainObject({ ...this, ...params }) as ConditionTreeLeaf;
  }

  override unnest(): ConditionTreeLeaf {
    return super.unnest() as ConditionTreeLeaf;
  }

  toPlainObject(): PlainConditionTree {
    return {
      field: this.field,
      operator: this.operator,
      value: this.value,
    };
  }
}
