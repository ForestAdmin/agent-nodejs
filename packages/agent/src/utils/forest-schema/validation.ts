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
  private static operatorValidationTypeMap = {
    After: 'is after',
    Before: 'is before',
    Contains: 'contains',
    GreaterThan: 'is greater than',
    LessThan: 'is less than',
    LongerThan: 'is longer than',
    Present: 'is present',
    ShorterThan: 'is shorter than',
    Match: 'is like', // This is correct, don't change it :)
  } as const;

  static convertValidationList(column: ColumnSchema): FrontendValidation[] {
    if (!column.validation) return [];

    return column.validation.flatMap(rule => {
      const error = `${rule.operator}${rule.value !== undefined ? `(${rule.value})` : ``}`;
      const message = `Failed validation rule: '${error}'`;

      return this.convertValidationRule(column.columnType, rule).map(validation => ({
        ...validation,
        message,
      }));
    });
  }

  private static convertValidationRule(
    columnType: ColumnType,
    rule: Validation,
  ): Pick<FrontendValidation, 'type' | 'value'>[] {
    // Operators which are natively supported by the frontend
    if (this.operatorValidationTypeMap[rule.operator]) {
      const type = this.operatorValidationTypeMap[rule.operator];
      const value = rule.operator === 'Match' ? rule.value.toString() : rule.value;

      return [{ type, value }];
    }

    try {
      const leaf = new ConditionTreeLeaf('field', rule.operator, rule.value);
      const operators = new Set(Object.keys(this.operatorValidationTypeMap)) as Set<Operator>;
      const timezone = 'Europe/Paris'; // we're sending the schema => use random tz
      const tree = ConditionTreeEquivalent.getEquivalentTree(leaf, operators, columnType, timezone);

      if (tree instanceof ConditionTreeLeaf) {
        return this.convertValidationRule(columnType, tree);
      }

      if (tree instanceof ConditionTreeBranch && tree.aggregator === 'And') {
        return tree.conditions.flatMap(c =>
          this.convertValidationRule(columnType, c as ConditionTreeLeaf),
        );
      }

      return [];
    } catch {
      return null;
    }
  }
}
