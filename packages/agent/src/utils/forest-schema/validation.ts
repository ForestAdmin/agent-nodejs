import { ColumnSchema, Operator } from '@forestadmin/datasource-toolkit';

import { ForestServerField, ValidationType } from './types';

type FrontendValidation = ForestServerField['validations'][number];
type Validation = ColumnSchema['validation'][number];

export default class FrontendValidationUtils {
  private static operatorValidationTypeMap: Partial<Record<Operator, ValidationType>> = {
    [Operator.Present]: ValidationType.Present,
    [Operator.GreaterThan]: ValidationType.GreaterThan,
    [Operator.LessThan]: ValidationType.LessThan,
    [Operator.LongerThan]: ValidationType.LongerThan,
    [Operator.ShorterThan]: ValidationType.ShorterThan,
    [Operator.Contains]: ValidationType.Contains,
    [Operator.Like]: ValidationType.Like,
  };

  static convertValidationList(predicates?: Validation[]): FrontendValidation[] {
    if (!predicates) return [];

    return predicates
      .map(p => {
        const type = FrontendValidationUtils.operatorValidationTypeMap[p.operator];

        return type ? { type, value: p.value, message: null } : null;
      })
      .filter(Boolean);
  }
}
