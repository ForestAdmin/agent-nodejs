import type { ActionForm } from './agent-action-client';
import type { FieldType } from '../read-model/capabilities-cache';

import { isEnumFieldType, normalizeFieldType } from '../read-model/capabilities-cache';
import { invalidActionValue, missingRequiredActionFields } from '../validation/validation-errors';

const PACKED_ID_EXPECTATION = 'a string holding a packed record id';

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
  const missing: string[] = [];
  const violations: { field: string; expected: string }[] = [];

  for (const field of action.getFields()) {
    const name = field.getName();
    const value = field.getValue();

    if (value === undefined || value === null) {
      if (field.isRequired()) missing.push(name);
    } else if (field.getReference()) {
      if (typeof value !== 'string') {
        violations.push({ field: name, expected: PACKED_ID_EXPECTATION });
      }
    } else {
      const type = normalizeFieldType(field.getType());
      const rawOptions = isEnumFieldType(type) ? action.getEnumField(name).getOptions() : undefined;
      const options = Array.isArray(rawOptions) && rawOptions.length > 0 ? rawOptions : undefined;
      const expected = expectedWhenViolated(type, value, options);

      if (expected) violations.push({ field: name, expected });
    }
  }

  if (missing.length > 0) throw missingRequiredActionFields(missing);
  if (violations.length > 0) throw invalidActionValue(violations);
}
