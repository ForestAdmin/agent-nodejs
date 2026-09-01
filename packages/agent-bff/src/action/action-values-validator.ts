import type { ActionForm } from './agent-action-client';
import type { FieldType, PrimitiveShape } from '../read-model/field-type';

import { missingRequiredFieldNames } from './action-form-mapper';
import { enumOptionsOf, normalizeFieldType, primitiveShapeOf } from '../read-model/field-type';
import { invalidActionValue, missingRequiredActionFields } from '../validation/validation-errors';

const PACKED_ID_EXPECTATION = 'a string holding a packed record id';

function shapeOf(type: FieldType): PrimitiveShape {
  return typeof type === 'string' ? primitiveShapeOf(type) : 'any';
}

interface ValueCheck {
  expected: string;
  matches(value: unknown): boolean;
}

const SHAPE_CHECKS: Record<PrimitiveShape, ValueCheck> = {
  any: { expected: 'any value', matches: () => true },
  boolean: { expected: 'a boolean', matches: value => typeof value === 'boolean' },
  number: {
    expected: 'a number',
    matches: value => typeof value === 'number' && Number.isFinite(value),
  },
  string: { expected: 'a string', matches: value => typeof value === 'string' },
};

function checkFor(type: FieldType, options: string[] | undefined): ValueCheck {
  if (options === undefined) return SHAPE_CHECKS[shapeOf(type)];

  return {
    expected: `one of: ${options.join(', ')}`,
    matches: value => typeof value === 'string' && options.includes(value),
  };
}

function expectedWhenViolated(
  type: FieldType,
  value: unknown,
  options: string[] | undefined,
): string | undefined {
  if (Array.isArray(type)) {
    const [itemType] = type;

    if (!Array.isArray(value)) return `an array of ${checkFor(itemType, options).expected}`;

    for (const item of value) {
      const expected = expectedWhenViolated(itemType, item, options);

      if (expected) return expected;
    }

    return undefined;
  }

  const check = checkFor(type, options);

  return check.matches(value) ? undefined : check.expected;
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
