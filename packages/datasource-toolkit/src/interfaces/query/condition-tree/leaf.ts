import RecordUtils from '../../../utils/record';
import { RecordData } from '../../record';
import Projection from '../projection';
import ConditionTree from './base';
import ConditionTreeNot from './not';

export enum Operator {
  Blank = 'blank',
  Contains = 'contains',
  EndsWith = 'ends_with',
  Equal = 'equal',
  GreaterThan = 'greater_than',
  In = 'in',
  IncludesAll = 'includes_all',
  LessThan = 'less_than',
  Missing = 'missing',
  NotContains = 'not_contains',
  NotEqual = 'not_equal',
  NotIn = 'not_in',
  Present = 'present',
  StartsWith = 'starts_with',

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

  LongerThan = 'longer_than',
  ShorterThan = 'shorter_than',
  Like = 'like',
}

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

    return result instanceof ConditionTree ? result : ConditionTreeFactory.fromJson(result);
  }

  async replaceLeafsAsync(handler: AsyncLeafReplacer, bind?: unknown): Promise<ConditionTree> {
    const result: ConditionTree | LeafComponents = await handler.call(bind, this);

    return result instanceof ConditionTree ? result : ConditionTreeFactory.fromJson(result);
  }

  match(record: RecordData): boolean {
    const fieldValue = RecordUtils.getFieldValue(record, this.field);

    switch (this.operator) {
      case Operator.Blank:
        return fieldValue === null || fieldValue === '';
      case Operator.Contains:
        return !!(fieldValue as string)
          ?.toLocaleLowerCase?.()
          ?.includes?.((this.value as string).toLocaleLowerCase?.());
      case Operator.StartsWith:
        return !!(fieldValue as string)?.startsWith(this.value as string);
      case Operator.EndsWith:
        return !!(fieldValue as string)?.endsWith(this.value as string);
      case Operator.LessThan:
        return fieldValue < this.value;
      case Operator.Equal:
        return fieldValue == this.value; // eslint-disable-line eqeqeq
      case Operator.GreaterThan:
        return fieldValue > this.value;
      case Operator.In:
        return !!(this.value as unknown[])?.includes?.(fieldValue);
      case Operator.IncludesAll:
        return !!(this.value as unknown[])?.every(v => (fieldValue as unknown[])?.includes(v));
      case Operator.ShorterThan:
        return (fieldValue as string).length < this.value;
      case Operator.LongerThan:
        return (fieldValue as string).length > this.value;

      default:
        try {
          return !this.inverse().match(record);
        } catch (e) {
          throw new Error(`Unsupported operator: '${this.operator}'`);
        }
    }
  }

  override(params: Partial<LeafComponents>): ConditionTreeLeaf {
    return ConditionTreeFactory.fromJson({ ...this, ...params }) as ConditionTreeLeaf;
  }
}
