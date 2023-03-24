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
  /** This is the list of operators which are supported in the frontend implementation */
  private static operatorValidationTypeMap: Partial<
    Record<Operator, (v: Validation) => FrontendValidation>
  > = {
    Present: () => ({ type: 'is present', message: 'Field is required', value: null }),
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
      message: `Value must contain ${rule.value}`,
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

    // Tell the rule conversion routine to ignore these operators
    Missing: null,
  } as const;

  /** Convert a list of our validation rules to what we'll be sending to the frontend */
  static convertValidationList(column: ColumnSchema): FrontendValidation[] {
    if (!column.validation) return [];

    const rules = column.validation.flatMap(rule => this.simplifyRule(column.columnType, rule));
    this.removeDuplicatesInPlace(rules);

    return rules.map(rule => this.operatorValidationTypeMap[rule.operator](rule));
  }

  /** Convert one of our validation rules to a given number of frontend validation rules */
  private static simplifyRule(columnType: ColumnType, rule: Validation): Validation[] {
    // Operators which are natively supported by the frontend
    if (this.operatorValidationTypeMap[rule.operator]) {
      return [rule];
    }

    try {
      // Add the `Missing` operator to unlock the `In -> Match` replacement rule.
      // This is a bit hacky, but works well: the `Missing` operator won't be used as long as
      // the final user did not ask for `IN(null, 'some-value', 'some-other-value')`.
      //
      // If the user does ask for it, then a `OR(Missing, Match)` will be generated, and we'll
      // ignore that rule because the frontend does not supports OR.
      const operators = new Set(Object.keys(this.operatorValidationTypeMap)) as Set<Operator>;
      operators.add('Missing');

      // Rewrite the rule to use only operators that the frontend supports.
      const leaf = new ConditionTreeLeaf('field', rule.operator, rule.value);
      const timezone = 'Europe/Paris'; // we're sending the schema => use random tz
      const tree = ConditionTreeEquivalent.getEquivalentTree(leaf, operators, columnType, timezone);

      if (tree instanceof ConditionTreeLeaf) {
        return this.simplifyRule(columnType, { operator: tree.operator, value: tree.value });
      }

      if (
        tree instanceof ConditionTreeBranch &&
        tree.aggregator === 'And' &&
        tree.conditions.every(c => c instanceof ConditionTreeLeaf)
      ) {
        return tree.conditions.flatMap(cond => {
          const t = cond as ConditionTreeLeaf;

          return this.simplifyRule(columnType, { operator: t.operator, value: t.value });
        });
      }
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
    } else if (rule.operator !== 'Present') {
      // Drop the rule if we don't know how to deduplicate it (we could log a warning here).
    }
  }
}
