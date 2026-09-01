import type { ActionForm } from './agent-action-client';
import type { FieldType, JsonShape } from '../read-model/capabilities-cache';

import { missingRequiredFieldNames } from './action-form-mapper';
import { enumOptionsOf, jsonShapeOf, normalizeFieldType } from '../read-model/capabilities-cache';
import { invalidActionValue, missingRequiredActionFields } from '../validation/validation-errors';

const PACKED_ID_EXPECTATION = 'a string holding a packed record id';

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

export default function assertActionValuesExecutable(action: ActionForm): void {
  const fields = action.getFields();
  const missing = missingRequiredFieldNames(fields);

  if (missing.length > 0) throw missingRequiredActionFields(missing);

  const violations: { field: string; expected: string }[] = [];

  const provided = fields.filter(
    field => field.getValue() !== undefined && field.getValue() !== null,
  );

  for (const field of provided) {
    const name = field.getName();
    const value = field.getValue();

    if (field.getReference()) {
      if (typeof value !== 'string') {
        violations.push({ field: name, expected: PACKED_ID_EXPECTATION });
      }
    } else {
      const type = normalizeFieldType(field.getType());
      const options = enumOptionsOf(type, action.getEnumField(name).getOptions());
      const expected = expectedWhenViolated(type, value, options);

      if (expected) violations.push({ field: name, expected });
    }
  }

  if (violations.length > 0) throw invalidActionValue(violations);
}
