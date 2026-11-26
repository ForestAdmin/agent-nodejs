import type { PlainField } from './types';

export type AllowedValue = { value: string | number | null; label: string };

export type ActionFormFieldDescription = {
  name: string;
  type: PlainField['type'];
  effectiveType: string;
  value: unknown;
  isRequired: boolean;
  description?: string;
  widget?: string;
  enumValues?: string[] | null;
  allowedValues?: AllowedValue[];
};

export type ActionFormDescription = {
  fields: ActionFormFieldDescription[];
  requiredFields: string[];
  canExecute: boolean;
};

export interface DescribableField {
  getName(): string;
  getType(): PlainField['type'];
  getEffectiveTypeName(): string;
  getValue(): unknown;
  isRequired(): boolean | undefined;
  getPlainField(): Partial<PlainField> | undefined;
  getMultipleChoiceField(): { getOptions(): unknown[] | null | undefined };
}

export interface DescribableForm {
  getFields(): DescribableField[];
  getEnumField(name: string): { getOptions(): string[] | null | undefined };
}

const ENUM_TYPE = 'Enum';

function isEnumType(type: PlainField['type']): boolean {
  return Array.isArray(type)
    ? type[0] === ENUM_TYPE
    : type === ENUM_TYPE || type === `${ENUM_TYPE}List`;
}

function toAllowedValue(option: unknown): AllowedValue {
  if (option !== null && typeof option === 'object') {
    const { value, label } = option as AllowedValue;

    return { value, label };
  }

  return { value: option as string | number, label: String(option) };
}

function describeField(
  form: DescribableForm,
  field: DescribableField,
  value: unknown,
): ActionFormFieldDescription {
  const plainField = field.getPlainField();
  const widget = plainField?.widgetEdit?.name;
  const description: ActionFormFieldDescription = {
    name: field.getName(),
    type: field.getType(),
    effectiveType: field.getEffectiveTypeName(),
    value,
    isRequired: field.isRequired() ?? false,
    ...(plainField?.description ? { description: plainField.description } : {}),
    ...(widget ? { widget } : {}),
  };

  if (isEnumType(field.getType())) {
    return { ...description, enumValues: form.getEnumField(field.getName()).getOptions() ?? null };
  }

  const options = field.getMultipleChoiceField().getOptions();

  return options?.length
    ? { ...description, allowedValues: options.map(toAllowedValue) }
    : description;
}

export default function describeActionForm(
  form: DescribableForm,
  valueOverrides: Record<string, unknown> = {},
): ActionFormDescription {
  // Own properties only: the overrides are keyed by caller-sent names, and a field named `toString`
  // would otherwise read as filled by a function.
  const valueOf = (field: DescribableField) =>
    Object.prototype.hasOwnProperty.call(valueOverrides, field.getName())
      ? valueOverrides[field.getName()]
      : field.getValue();

  const fields = form.getFields().map(field => describeField(form, field, valueOf(field)));
  const requiredFields = fields
    .filter(field => field.isRequired && (field.value === undefined || field.value === null))
    .map(field => field.name);

  return { fields, requiredFields, canExecute: requiredFields.length === 0 };
}
