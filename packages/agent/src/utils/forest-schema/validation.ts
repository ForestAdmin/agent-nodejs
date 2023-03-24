import {
  ColumnSchema,
  ColumnType,
  ConditionTreeBranch,
  ConditionTreeEquivalent,
  ConditionTreeLeaf,
  Operator,
} from '@forestadmin/datasource-toolkit';
import { ForestServerField } from '@forestadmin/forestadmin-client';

type FrontendValidation = ForestServerField['validations'][number];
type Validation = ColumnSchema['validation'][number];

export default class FrontendValidationUtils {
  /**
   * Those operators depend on the current time so they won't work.
   * The reason is that we need now() to be evaluated at query time, not at schema generation time.
   */
  private static excluded: Set<Operator> = new Set([
    ...['Future', 'Past', 'Today', 'Yesterday'],
    ...['PreviousMonth', 'PreviousQuarter', 'PreviousWeek', 'PreviousXDays', 'PreviousYear'],
    ...['AfterXHoursAgo', 'BeforeXHoursAgo', 'PreviousXDaysToDate'],
    ...['PreviousMonthToDate', 'PreviousQuarterToDate', 'PreviousWeekToDate', 'PreviousYearToDate'],
  ] as const);

  /** This is the list of operators which are supported in the frontend implementation */
  private static supported: Partial<Record<Operator, (v: Validation) => FrontendValidation>> = {
    Present: () => ({ type: 'is present', message: 'Field is required' }),
    After: rule => ({
      type: 'is after',
      value: rule.value,
      message: `Value must be after ${rule.value}`,
    }),
    Before: rule => ({
      type: 'is before',
      value: rule.value,
      message: `Value must be before ${rule.value}`,
    }),
    Contains: rule => ({
      type: 'contains',
      value: rule.value,
      message: `Value must contain '${rule.value}'`,
    }),
    GreaterThan: rule => ({
      type: 'is greater than',
      value: rule.value,
      message: `Value must be greater than ${rule.value}`,
    }),
    LessThan: rule => ({
      type: 'is less than',
      value: rule.value,
      message: `Value must be lower than ${rule.value}`,
    }),
    LongerThan: rule => ({
      type: 'is longer than',
      value: rule.value,
      message: `Value must be longer than ${rule.value} characters`,
    }),
    ShorterThan: rule => ({
      type: 'is shorter than',
      value: rule.value,
      message: `Value must be shorter than ${rule.value} characters`,
    }),
    Match: rule => ({
      type: 'is like', // `is like` actually expects a regular expression, not a 'like pattern'
      value: rule.value.toString(),
      message: `Value must match ${rule.value}`,
    }),
  };

  /** Convert a list of our validation rules to what we'll be sending to the frontend */
  static convertValidationList(column: ColumnSchema): FrontendValidation[] {
    if (!column.validation) return [];

    const rules = column.validation.flatMap(rule => this.simplifyRule(column.columnType, rule));
    this.removeDuplicatesInPlace(rules);

    return rules.map(rule => this.supported[rule.operator](rule));
  }

  /** Convert one of our validation rules to a given number of frontend validation rules */
  private static simplifyRule(columnType: ColumnType, rule: Validation): Validation[] {
    // Operators which we don't want to end up the schema
    if (this.excluded.has(rule.operator)) return [];

    // Operators which are natively supported by the frontend
    if (this.supported[rule.operator]) return [rule];

    try {
      // Add the 'Equal|NotEqual' operators to unlock the `In|NotIn -> Match` replacement rules.
      // This is a bit hacky, but it allows to reuse the existing logic.
      const operators = new Set(Object.keys(this.supported)) as Set<Operator>;
      operators.add('Equal');
      operators.add('NotEqual');

      // Rewrite the rule to use only operators that the frontend supports.
      const leaf = new ConditionTreeLeaf('field', rule.operator, rule.value);
      const timezone = 'Europe/Paris'; // we're sending the schema => use random tz
      const tree = ConditionTreeEquivalent.getEquivalentTree(leaf, operators, columnType, timezone);

      let conditions = [];

      if (tree instanceof ConditionTreeLeaf) {
        conditions = [tree];
      } else if (tree instanceof ConditionTreeBranch && tree.aggregator === 'And') {
        conditions = tree.conditions;
      }

      return conditions
        .filter(c => c instanceof ConditionTreeLeaf)
        .filter(c => c.operator !== 'Equal' && c.operator !== 'NotEqual')
        .flatMap(c => this.simplifyRule(columnType, c));
    } catch {
      // Just ignore errors, they mean that the operator is not supported by the frontend
      // and that we don't have an automatic conversion for it.
      //
      // In that case we fallback to just validating the data entry in the agent (which is better
      // than nothing but will not be as user friendly as the frontend validation).
    }

    // Drop the rule if we don't know how to convert it (we could log a warning here).
    return [];
  }

  /**
   * The frontend crashes when it receives multiple rules of the same type.
   * This method merges the rules which can be merged and drops the others.
   */
  private static removeDuplicatesInPlace(rules: Validation[]): void {
    const used = new Map<string, number>();

    for (let i = 0; i < rules.length; i += 1) {
      if (used.has(rules[i].operator)) {
        const rule = rules[used.get(rules[i].operator)];
        const [newRule] = rules.splice(i, 1);
        i -= 1;

        this.mergeInto(rule, newRule);
      } else {
        used.set(rules[i].operator, i);
      }
    }
  }

  private static mergeInto(rule: Validation, newRule: Validation): void {
    if (
      rule.operator === 'GreaterThan' ||
      rule.operator === 'After' ||
      rule.operator === 'LongerThan'
    ) {
      rule.value = rule.value < newRule.value ? newRule.value : rule.value;
    } else if (
      rule.operator === 'LessThan' ||
      rule.operator === 'Before' ||
      rule.operator === 'ShorterThan'
    ) {
      rule.value = rule.value < newRule.value ? rule.value : newRule.value;
    } else if (rule.operator === 'Match') {
      // Make one big regex that matches both patterns
      // @see https://stackoverflow.com/a/870506/1897495
      const regexp = rule.value as RegExp;
      const newRegexp = newRule.value as RegExp;

      rule.value = new RegExp(`^(?=${regexp.source})(?=${newRegexp.source}).*$`, regexp.flags);
    } else {
      // Ignore the rules that we can't deduplicate (we could log a warning here).
    }
  }
}
