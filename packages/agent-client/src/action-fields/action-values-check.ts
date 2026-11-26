import type { DescribableField, DescribableForm } from './form-description';
import type { FieldType, PrimitiveShape } from '../schema/field-type';

import {
  enumOptionsOf,
  isEnumFieldType,
  normalizeFieldType,
  primitiveShapeOf,
} from '../schema/field-type';

export interface InvalidActionValue {
  field: string;
  expected: string;
}

const PACKED_ID_EXPECTATION = 'a string holding a packed record id';

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

function shapeOf(type: FieldType): PrimitiveShape {
  return typeof type === 'string' ? primitiveShapeOf(type) : 'any';
}

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

    const bad = value
      .map((item, index) => ({ index, expected: expectedWhenViolated(itemType, item, options) }))
      .filter((item): item is { index: number; expected: string } => item.expected !== undefined);

    if (bad.length === 0) return undefined;

    const label = bad.length === 1 ? 'index' : 'indexes';

    return `${label} ${bad.map(item => item.index).join(', ')} to be ${bad[0].expected}`;
  }

  const check = checkFor(type, options);

  return check.matches(value) ? undefined : check.expected;
}

export default function expectedValueOf(
  form: DescribableForm,
  field: DescribableField,
  value: unknown,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (field.getReference?.()) return typeof value === 'string' ? undefined : PACKED_ID_EXPECTATION;

  const type = normalizeFieldType(field.getType());

  const options = isEnumFieldType(type)
    ? enumOptionsOf(type, form.getEnumField(field.getName()).getOptions())
    : undefined;

  return expectedWhenViolated(type, value, options);
}
