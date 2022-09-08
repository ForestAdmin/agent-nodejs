import { ColumnSchema, Operator } from '@forestadmin/datasource-toolkit';
import { ForestServerField, ValidationType } from './types';

type FrontendValidation = ForestServerField['validations'][number];
type Validation = ColumnSchema['validation'][number];

export default class FrontendValidationUtils {
  private static operatorValidationTypeMap: Partial<Record<Operator, ValidationType>> = {
    Present: ValidationType.Present,
    GreaterThan: ValidationType.GreaterThan,
    LessThan: ValidationType.LessThan,
    LongerThan: ValidationType.LongerThan,
    ShorterThan: ValidationType.ShorterThan,
    Contains: ValidationType.Contains,
    Like: ValidationType.Like,
  };

  static convertValidationList(rules?: Validation[]): FrontendValidation[] {
    if (!rules) return [];

    return rules
      .map(rule => {
        const type = FrontendValidationUtils.operatorValidationTypeMap[rule.operator];
        const error = `${rule.operator}${rule.value !== undefined ? `(${rule.value})` : ``}`;
        const message = `Failed validation rule: '${error}'`;

        return type ? { type, value: rule.value, message } : null;
      })
      .filter(Boolean);
  }
}
