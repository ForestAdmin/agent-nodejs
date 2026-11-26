import type { ActionForm } from './agent-action-client';
import type { Logger } from '../ports/logger-port';
import type { InvalidActionValue } from '@forestadmin/agent-client';

import { describeActionForm, findActionValueProblems } from '@forestadmin/agent-client';

import { invalidActionValue, missingRequiredActionFields } from '../validation/validation-errors';

const PACKED_ID_EXPECTATION = 'a string holding a packed record id';

// The Gateway hands out record ids as packed strings, so a reference must be one, where
// agent-client's own rule also accepts a number.
function violationsOf(
  action: ActionForm,
  invalidValues: InvalidActionValue[],
): InvalidActionValue[] {
  return action.getFields().flatMap(field => {
    const name = field.getName();
    const value = field.getValue();

    if (!field.getReference()) return invalidValues.filter(invalid => invalid.field === name);

    return value !== undefined && value !== null && typeof value !== 'string'
      ? [{ field: name, expected: PACKED_ID_EXPECTATION }]
      : [];
  });
}

export default function assertActionValuesExecutable(action: ActionForm, logger: Logger): void {
  const { missingRequiredFields, invalidValues } = findActionValueProblems(action);

  if (missingRequiredFields.length > 0) {
    logger('Warn', 'Action execute rejected: required fields left empty', {
      fields: missingRequiredFields,
    });

    throw missingRequiredActionFields(missingRequiredFields);
  }

  describeActionForm(action)
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

  const violations = violationsOf(action, invalidValues);

  if (violations.length > 0) {
    logger('Warn', 'Action execute rejected: invalid values', {
      fields: violations.map(violation => violation.field),
    });

    throw invalidActionValue(violations);
  }
}
