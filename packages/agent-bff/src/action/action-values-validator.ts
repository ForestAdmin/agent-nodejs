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

const PACKED_ID_EXPECTATION = 'a string holding a packed record id';

// The expectation a value must meet, or undefined when the BFF deliberately does not constrain it.
function expectedScalar(type: string, options: string[] | undefined): string | undefined {
  if (Array.isArray(options) && options.length > 0) return `one of: ${options.join(', ')}`;

  if (type === 'Number') return 'a number';
  if (type === 'Boolean') return 'a boolean';

  return STRING_TYPES.has(type) ? 'a string' : undefined;
}

// Enum membership only applies to Enum fields (scalar or list), mirroring the form endpoint: a
// leftover enums array on a typed field is ignored, and a malformed (non-array) one must not crash.
function isEnumType(type: string | [string]): boolean {
  return Array.isArray(type) ? type[0] === 'Enum' : type === 'Enum';
}

// Returns the violated expectation, or undefined when the value fits the published field schema.
// Strict at every nesting level: a null list item violates a constrained item type, because the
// published array schemas mark no item as nullable. Field-level nullishness is handled by the
// caller: a required field without a value is "missing", an optional one is legitimately empty.
function expectedWhenViolated(
  type: string | [string],
  value: unknown,
  options: string[] | undefined,
): string | undefined {
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

  if (Array.isArray(options) && options.length > 0) {
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

    if (value === undefined || value === null) {
      if (field.isRequired()) missing.push(name);
    } else if (field.getReference()) {
      // A record-picker field publishes its target PK's column type, but the value it exchanges is
      // a packed id string ("42", "1|2") whatever that type is: the agent unpacks strings only,
      // so enforcing the published JSON type here would reject the only shape that executes.
      if (typeof value !== 'string') {
        violations.push({ field: name, expected: PACKED_ID_EXPECTATION });
      }
    } else {
      const type = field.getType();
      // Options are consulted for Enum fields only, mirroring the form endpoint.
      const options = isEnumType(type) ? action.getEnumField(name).getOptions() : undefined;
      const expected = expectedWhenViolated(type, value, options);

      if (expected) violations.push({ field: name, expected });
    }
  }

  if (missing.length > 0) throw missingRequiredActionFields(missing);
  if (violations.length > 0) throw invalidActionValue(violations);
}
