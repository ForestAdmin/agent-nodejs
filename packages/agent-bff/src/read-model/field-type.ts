const LIST_SUFFIX = 'List';
const ENUM_TYPE = 'Enum';

/**
 * A Forest column type: a primitive name, a one-element array wrapping another type, a composite
 * `{ fields }`, or a relation marker like `ManyToOne`.
 */
export type FieldType =
  | string
  | FieldType[]
  | { fields: { field: string; type: FieldType; enums?: string[] }[] };

export type PrimitiveShape = 'any' | 'boolean' | 'number' | 'string';

const PRIMITIVE_SHAPES = new Map(
  Object.entries<PrimitiveShape>({
    Binary: 'string',
    Boolean: 'boolean',
    Date: 'string',
    Dateonly: 'string',
    Enum: 'string',
    File: 'string',
    Json: 'any',
    Number: 'number',
    Point: 'string',
    String: 'string',
    Time: 'string',
    Timeonly: 'string',
    Uuid: 'string',
  }),
);

export function normalizeFieldType(type: FieldType): FieldType {
  if (typeof type === 'string' && type.endsWith(LIST_SUFFIX)) {
    return [type.slice(0, -LIST_SUFFIX.length)];
  }

  return type;
}

export function isEnumFieldType(type: FieldType): boolean {
  const normalized = normalizeFieldType(type);

  return Array.isArray(normalized) ? normalized[0] === ENUM_TYPE : normalized === ENUM_TYPE;
}

export function primitiveShapeOf(name: string): PrimitiveShape {
  return PRIMITIVE_SHAPES.get(name) ?? 'any';
}

export function enumOptionsOf(
  type: FieldType,
  options: string[] | null | undefined,
): string[] | undefined {
  if (!isEnumFieldType(type) || !Array.isArray(options) || options.length === 0) return undefined;

  return options;
}
