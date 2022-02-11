import { Collection } from '../../../collection';
import { ColumnSchema } from '../../../schema';
import { RecordData } from '../../../record';
import CollectionUtils from '../../../../utils/collection';
import ConditionTree from './base';
import ConditionTreeEquivalent from '../equivalence';
import ConditionTreeFactory from '../factory';
import ConditionTreeNot from './not';
import Projection from '../../projection';
import RecordUtils from '../../../../utils/record';

export enum Operator {
  // All types
  Present = 'present',
  Blank = 'blank',
  Missing = 'missing',

  // All types besides arrays
  Equal = 'equal',
  NotEqual = 'not_equal',
  LessThan = 'less_than',
  GreaterThan = 'greater_than',
  In = 'in',
  NotIn = 'not_in',

  // Strings
  Like = 'like',
  StartsWith = 'starts_with',
  EndsWith = 'ends_with',
  Contains = 'contains',
  NotContains = 'not_contains',
  LongerThan = 'longer_than',
  ShorterThan = 'shorter_than',

  // Dates
  Before = 'before',
  After = 'after',
  AfterXHoursAgo = 'after_x_hours_ago',
  BeforeXHoursAgo = 'before_x_hours_ago',
  Future = 'future',
  Past = 'past',
  PreviousMonthToDate = 'previous_month_to_date',
  PreviousMonth = 'previous_month',
  PreviousQuarterToDate = 'previous_quarter_to_date',
  PreviousQuarter = 'previous_quarter',
  PreviousWeekToDate = 'previous_week_to_date',
  PreviousWeek = 'previous_week',
  PreviousXDaysToDate = 'previous_x_days_to_date',
  PreviousXDays = 'previous_x_days',
  PreviousYearToDate = 'previous_year_to_date',
  PreviousYear = 'previous_year',
  Today = 'today',
  Yesterday = 'yesterday',

  // Arrays
  IncludesAll = 'includes_all',
}

// This set of operators is enough to implement them all with replacements
const uniqueOperators = new Set([
  Operator.Equal,
  Operator.NotEqual,
  Operator.LessThan,
  Operator.GreaterThan,
  Operator.Like,
  Operator.NotContains,
  Operator.LongerThan,
  Operator.ShorterThan,
  Operator.IncludesAll,
]);

type LeafHandler<R> = (leaf: ConditionTreeLeaf) => R;

export type LeafReplacer = LeafHandler<ConditionTree | LeafComponents>;
export type AsyncLeafReplacer = LeafHandler<Promise<ConditionTree | LeafComponents>>;
export type LeafTester = LeafHandler<boolean>;
export type LeafCallback = LeafHandler<void>;
export type LeafComponents = { field: string; operator: Operator; value?: unknown };

export default class ConditionTreeLeaf extends ConditionTree {
  field: string;
  operator: Operator;
  value?: unknown;

  get projection(): Projection {
    return new Projection(this.field);
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
    const operators = Object.values(Operator) as string[];

    if (operators.includes(`not_${this.operator}`)) {
      return this.override({ operator: `not_${this.operator}` as Operator });
    }

    if (this.operator.startsWith('not_')) {
      return this.override({ operator: this.operator.substring(4) as Operator });
    }

    switch (this.operator) {
      case Operator.Blank:
        return this.override({ operator: Operator.Present });
      case Operator.Present:
        return this.override({ operator: Operator.Blank });
      default:
        return new ConditionTreeNot(this);
    }
  }

  replaceLeafs(handler: LeafReplacer, bind?: unknown): ConditionTree {
    const result: ConditionTree | LeafComponents = handler.call(bind, this);

    return result instanceof ConditionTree ? result : ConditionTreeFactory.fromPlainObject(result);
  }

  async replaceLeafsAsync(handler: AsyncLeafReplacer, bind?: unknown): Promise<ConditionTree> {
    const result: ConditionTree | LeafComponents = await handler.call(bind, this);

    return result instanceof ConditionTree ? result : ConditionTreeFactory.fromPlainObject(result);
  }

  match(record: RecordData, collection: Collection, timezone: string): boolean {
    const fieldValue = RecordUtils.getFieldValue(record, this.field);
    const { columnType } = CollectionUtils.getFieldSchema(collection, this.field) as ColumnSchema;

    switch (this.operator) {
      case Operator.Equal:
        return fieldValue == this.value; // eslint-disable-line eqeqeq
      case Operator.LessThan:
        return fieldValue < this.value;
      case Operator.GreaterThan:
        return fieldValue > this.value;
      case Operator.Like:
        return this.like(fieldValue as string, this.value as string);
      case Operator.LongerThan:
        return (fieldValue as string).length > this.value;
      case Operator.ShorterThan:
        return (fieldValue as string).length < this.value;
      case Operator.IncludesAll:
        return !!(this.value as unknown[])?.every(v => (fieldValue as unknown[])?.includes(v));

      case Operator.NotEqual:
      case Operator.NotContains:
        return !this.inverse().match(record, collection, timezone);

      default:
        return ConditionTreeEquivalent.getEquivalentTree(
          this,
          uniqueOperators,
          columnType,
          timezone,
        ).match(record, collection, timezone);
    }
  }

  override(params: Partial<LeafComponents>): ConditionTreeLeaf {
    return ConditionTreeFactory.fromPlainObject({ ...this, ...params }) as ConditionTreeLeaf;
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
