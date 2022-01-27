import { RecordData } from '../../record';
import RecordUtils from '../../../utils/record';
import ConditionTree from './base';
import ConditionTreeBranch, { Aggregator } from './branch';
import Projection from '../projection';

export enum Operator {
  Blank = 'blank',
  Contains = 'contains',
  EndsWith = 'ends_with',
  Equal = 'equal',
  GreaterThan = 'greater_than',
  In = 'in',
  IncludesAll = 'includes_all',
  LessThan = 'less_than',
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
export type AsyncLeafReplacer = LeafHandler<Promise<ConditionTree>>;
export type LeafTester = LeafHandler<boolean>;
export type LeafCallback = LeafHandler<void>;
export type LeafComponents = { field: string; operator: Operator; value?: unknown };

export default class ConditionTreeLeaf extends ConditionTree {
  field: string;
  operator: Operator;
  value: unknown;

  get projection(): Projection {
    return new Projection(this.field);
  }

  constructor(components: LeafComponents) {
    super();
    this.field = components.field;
    this.operator = components.operator;
    this.value = components.value;
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
    switch (this.operator) {
      case Operator.Contains:
        return this.override({ operator: Operator.NotContains });
      case Operator.Equal:
        return this.override({ operator: Operator.NotEqual });
      case Operator.In:
        return this.override({ operator: Operator.NotIn });
      case Operator.Blank:
        return this.override({ operator: Operator.Present });
      case Operator.NotContains:
        return this.override({ operator: Operator.Contains });
      case Operator.NotEqual:
        return this.override({ operator: Operator.Equal });
      case Operator.NotIn:
        return this.override({ operator: Operator.In });
      case Operator.Present:
        return this.override({ operator: Operator.Blank });
      case Operator.LessThan:
        return new ConditionTreeBranch(Aggregator.Or, [
          this.override({ operator: Operator.Equal }),
          this.override({ operator: Operator.GreaterThan }),
        ]);
      case Operator.GreaterThan:
        return new ConditionTreeBranch(Aggregator.Or, [
          this.override({ operator: Operator.Equal }),
          this.override({ operator: Operator.LessThan }),
        ]);
      default:
        throw new Error('Method not implemented.');
    }
  }

  replaceLeafs(handler: LeafReplacer, bind?: unknown): ConditionTree {
    const result = handler.call(bind, this);

    return result instanceof ConditionTree ? result : new ConditionTreeLeaf(result);
  }

  replaceLeafsAsync(handler: AsyncLeafReplacer, bind?: unknown): Promise<ConditionTree> {
    return handler.call(bind, this);
  }

  match(record: RecordData): boolean {
    const fieldValue = RecordUtils.getFieldValue(record, this.field);

    switch (this.operator) {
      case Operator.Blank:
        return fieldValue === null || fieldValue === '';
      case Operator.Contains:
        return !!(fieldValue as string)?.toLocaleLowerCase?.()?.includes?.(this.value as string);
      case Operator.StartsWith:
        return !!(fieldValue as string)?.startsWith(this.value as string);
      case Operator.EndsWith:
        return !!(fieldValue as string)?.endsWith(this.value as string);
      case Operator.LessThan:
        return fieldValue < this.value;
      case Operator.Equal:
        // eslint-disable-next-line eqeqeq
        return fieldValue == this.value; // do not replace by ===
      case Operator.GreaterThan:
        return fieldValue > this.value;
      case Operator.In:
        return !!(this.value as unknown[])?.includes?.(fieldValue);
      case Operator.IncludesAll:
        return !!(this.value as unknown[])?.every(v => (fieldValue as unknown[])?.includes(v));

      case Operator.NotContains:
      case Operator.NotEqual:
      case Operator.NotIn:
      case Operator.Present:
        return !this.inverse().match(record);

      default:
        throw new Error(`Unsupported operator: ${this.operator}`);
    }
  }

  override(params: Partial<LeafComponents>): ConditionTreeLeaf {
    return new ConditionTreeLeaf({ ...this, ...params });
  }

  unnest(): ConditionTreeLeaf {
    const dotIndex = this.field.indexOf(':');
    if (dotIndex === -1) throw new Error('Cannot unnest leaf');

    return this.override({ field: this.field.substring(dotIndex + 1) });
  }
}
