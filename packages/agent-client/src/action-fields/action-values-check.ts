import type { DescribableField, DescribableForm } from './form-description';
import type { FieldType, PrimitiveShape } from '../schema/field-type';

import describeActionForm from './form-description';
import { ActionValuesNotExecutableError } from '../errors';
import { enumOptionsOf, normalizeFieldType, primitiveShapeOf } from '../schema/field-type';

export interface CheckableField extends DescribableField {
  getReference(): string | null | undefined;
}

export interface CheckableForm extends DescribableForm {
  getFields(): CheckableField[];
}

export interface InvalidActionValue {
  field: string;
  expected: string;
}

export interface ActionValueProblems {
  missingRequiredFields: string[];
  invalidValues: InvalidActionValue[];
}

const RECORD_ID_EXPECTATION = 'a record id';

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

function isRecordId(value: unknown): boolean {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
}

export function findActionValueProblems(form: CheckableForm): ActionValueProblems {
  const { requiredFields } = describeActionForm(form);
  const invalidValues: InvalidActionValue[] = [];

  for (const field of form.getFields()) {
    const name = field.getName();
    const value = field.getValue();

    if (value !== undefined && value !== null) {
      let expected: string | undefined;

      if (field.getReference()) {
        expected = isRecordId(value) ? undefined : RECORD_ID_EXPECTATION;
      } else {
        const type = normalizeFieldType(field.getType());
        expected = expectedWhenViolated(
          type,
          value,
          enumOptionsOf(type, form.getEnumField(name).getOptions()),
        );
      }

      if (expected) invalidValues.push({ field: name, expected });
    }
  }

  return { missingRequiredFields: requiredFields, invalidValues };
}

export function assertActionValuesExecutable(form: CheckableForm): void {
  const problems = findActionValueProblems(form);

  if (problems.missingRequiredFields.length > 0 || problems.invalidValues.length > 0) {
    throw new ActionValuesNotExecutableError(
      problems.missingRequiredFields,
      problems.invalidValues,
    );
  }
}
