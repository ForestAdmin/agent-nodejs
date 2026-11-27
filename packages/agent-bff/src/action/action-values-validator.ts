import type { ActionForm } from './agent-action-client';
import type { Logger } from '../ports/logger-port';
import type { ActionValuesNotExecutableError } from '@forestadmin/agent-client';

import { invalidActionValue, missingRequiredActionFields } from '../validation/validation-errors';

export function logEnumValuesWithoutOptions(action: ActionForm, logger: Logger): void {
  action
    .describeForm()
    .fields.filter(
      field =>
        field.enumValues !== undefined &&
        !field.enumValues?.length &&
        field.value !== undefined &&
        field.value !== null,
    )
    .forEach(field => {
      logger('Warn', 'Action enum field accepted without its options', { field: field.name });
    });
}

export function actionValuesError(error: ActionValuesNotExecutableError, logger: Logger) {
  const { missingRequiredFields, invalidValues } = error;

  if (missingRequiredFields.length > 0) {
    logger('Warn', 'Action execute rejected: required fields left empty', {
      fields: missingRequiredFields,
    });

    return missingRequiredActionFields(missingRequiredFields);
  }

  logger('Warn', 'Action execute rejected: invalid values', {
    fields: invalidValues.map(invalid => invalid.field),
  });

  return invalidActionValue(invalidValues);
}
