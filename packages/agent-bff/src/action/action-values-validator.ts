import type { ActionForm } from './agent-action-client';

import { invalidActionValue, missingRequiredActionFields } from '../validation/validation-errors';

// The scalar types the published field schemas (openapi/field-schemas.ts) declare as JSON strings.
// Json, File and anything unrecognized stay unconstrained at the BFF: the agent owns their final
// validation (agent-client already rejects a malformed File value inside setFields).
const STRING_TYPES = new Set([
  'Binary',
  'Date',
  'Dateonly',
  'Enum',
  'Point',
  'String',
  'Time',
  'Timeonly',
  'Uuid',
]);

// The expectation a value must meet, or undefined when the BFF deliberately does not constrain it.
function expectedScalar(type: string, options: string[] | undefined): string | undefined {
  if (options?.length) return `one of: ${options.join(', ')}`;

  if (type === 'Number') return 'a number';
  if (type === 'Boolean') return 'a boolean';

  return STRING_TYPES.has(type) ? 'a string' : undefined;
}

// Returns the violated expectation, or undefined when the value fits the published field schema.
// A nullish value is never a type violation: for a required field it is reported as missing, for
// an optional one it is a legitimate "left empty".
function expectedWhenViolated(
  type: string | [string],
  value: unknown,
  options: string[] | undefined,
): string | undefined {
  if (value === null || value === undefined) return undefined;

  if (Array.isArray(type)) {
    const [itemType] = type;

    if (!Array.isArray(value)) {
      return `an array of ${expectedScalar(itemType, options) ?? 'any value'}`;
    }

    for (const item of value) {
      const expected = expectedWhenViolated(itemType, item, options);
      if (expected) return expected;
    }

    return undefined;
  }

  const expected = expectedScalar(type, options);

  if (expected === undefined) return undefined;

  if (options?.length) {
    return typeof value === 'string' && options.includes(value) ? undefined : expected;
  }

  if (type === 'Number') {
    return typeof value === 'number' && Number.isFinite(value) ? undefined : expected;
  }

  if (type === 'Boolean') return typeof value === 'boolean' ? undefined : expected;

  return typeof value === 'string' ? undefined : expected;
}

/**
 * Enforces, at execute time, the field contract the BFF publishes: a required field must hold a
 * value (a form default counts, mirroring the form endpoint's canExecute), and enum membership and
 * JSON types must match the field schema. Runs AFTER setFields so hooks have rebuilt the form: what
 * is validated is exactly the state execute() will submit.
 */
export default function assertActionValuesExecutable(action: ActionForm): void {
  const missing: string[] = [];
  const violations: { field: string; expected: string }[] = [];

  for (const field of action.getFields()) {
    const name = field.getName();
    const value = field.getValue();

    if (field.isRequired() && (value === undefined || value === null)) {
      missing.push(name);
    } else {
      const expected = expectedWhenViolated(
        field.getType(),
        value,
        action.getEnumField(name).getOptions(),
      );

      if (expected) violations.push({ field: name, expected });
    }
  }

  if (missing.length > 0) throw missingRequiredActionFields(missing);
  if (violations.length > 0) throw invalidActionValue(violations);
}
