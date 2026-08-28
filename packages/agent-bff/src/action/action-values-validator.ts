import type { ActionForm } from './agent-action-client';
import type { FieldType } from '../read-model/capabilities-cache';

import { isEnumFieldType, normalizeFieldType } from '../read-model/capabilities-cache';
import { invalidActionValue, missingRequiredActionFields } from '../validation/validation-errors';

const PACKED_ID_EXPECTATION = 'a string holding a packed record id';

// The JSON shape a Forest field type exchanges. This mirrors what the published document declares
// for the same types (openapi/field-schemas.ts): the mount-point invariant deliberately keeps the
// runtime and the document apart, so the two maps are maintained side by side on purpose.
// Json, File, and anything unrecognized stay unconstrained at the BFF: the agent owns their final
// validation (agent-client already rejects a malformed File value inside setFields).
type JsonShape = 'array' | 'boolean' | 'number' | 'string' | 'any';

const STRING_SHAPES = new Set([
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

function jsonShapeOf(type: FieldType): JsonShape {
  if (Array.isArray(type)) return 'array';
  if (type === 'Number') return 'number';
  if (type === 'Boolean') return 'boolean';
  if (typeof type === 'string' && STRING_SHAPES.has(type)) return 'string';

  return 'any';
}

// The human-readable expectation for a scalar shape. Options, when an Enum field carries them,
// override the shape: membership is the contract then.
function describeShape(shape: JsonShape, options: string[] | undefined): string {
  if (options !== undefined) return `one of: ${options.join(', ')}`;

  switch (shape) {
    case 'boolean':
      return 'a boolean';
    case 'number':
      return 'a number';
    case 'string':
      return 'a string';
    default:
      return 'any value';
  }
}

function valueMatchesShape(
  shape: JsonShape,
  value: unknown,
  options: string[] | undefined,
): boolean {
  if (options !== undefined) return typeof value === 'string' && options.includes(value);

  switch (shape) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'string':
      return typeof value === 'string';
    default:
      return true;
  }
}

// Returns the violated expectation, or undefined when the value fits the published field contract.
// Strict at every nesting level: a null list item violates a constrained item type, because the
// published array schemas mark no item as nullable. Field-level nullishness is handled by the
// caller: a required field without a value is "missing", an optional one is legitimately empty.
function expectedWhenViolated(
  type: FieldType,
  value: unknown,
  options: string[] | undefined,
): string | undefined {
  if (Array.isArray(type)) {
    const [itemType] = type;

    if (!Array.isArray(value)) {
      return `an array of ${describeShape(jsonShapeOf(itemType), options)}`;
    }

    for (const item of value) {
      const expected = expectedWhenViolated(itemType, item, options);
      if (expected) return expected;
    }

    return undefined;
  }

  const shape = jsonShapeOf(type);

  if (!valueMatchesShape(shape, value, options)) return describeShape(shape, options);

  return undefined;
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
      const type = normalizeFieldType(field.getType());
      // Options are consulted for Enum fields only, mirroring the form endpoint: a leftover enums
      // array on a typed field is ignored. A malformed (non-array) options value is dropped here,
      // once, so the helpers downstream can trust what they receive.
      const rawOptions = isEnumFieldType(type) ? action.getEnumField(name).getOptions() : undefined;
      const options = Array.isArray(rawOptions) && rawOptions.length > 0 ? rawOptions : undefined;
      const expected = expectedWhenViolated(type, value, options);

      if (expected) violations.push({ field: name, expected });
    }
  }

  if (missing.length > 0) throw missingRequiredActionFields(missing);
  if (violations.length > 0) throw invalidActionValue(violations);
}
