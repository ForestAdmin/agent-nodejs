import type { ActionForm } from './agent-action-client';
import type { Logger } from '../ports/logger-port';

import { invalidActionValue, missingRequiredActionFields } from '../validation/validation-errors';

export default function assertActionValuesExecutable(action: ActionForm, logger: Logger): void {
  const { fields, requiredFields, invalidValues } = action.describeForm();

  if (requiredFields.length > 0) {
    logger('Warn', 'Action execute rejected: required fields left empty', {
      fields: requiredFields,
    });

    throw missingRequiredActionFields(requiredFields);
  }

  fields
    .filter(
      field =>
        field.enumValues !== undefined &&
        !field.enumValues?.length &&
        field.value !== undefined &&
        field.value !== null,
    )
    .forEach(field => {
      logger('Warn', 'Action enum field accepted without its options', { field: field.name });
    });

  if (invalidValues.length > 0) {
    logger('Warn', 'Action execute rejected: invalid values', {
      fields: invalidValues.map(invalid => invalid.field),
    });

    throw invalidActionValue(invalidValues);
  }
}
