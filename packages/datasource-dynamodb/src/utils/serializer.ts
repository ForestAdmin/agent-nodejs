import type { RecordData } from '@forestadmin/datasource-toolkit';

import { ValidationError } from '@forestadmin/datasource-toolkit';

import TypeConverter from './type-converter';

export const PATH_SEPARATOR = '->';

const nestedPrefixesCache = new WeakMap<Set<string>, Set<string>>();

/** Paths that have columns declared under them, hence are expanded rather than kept as Json. */
function nestedPrefixes(fields: Set<string>): Set<string> {
  let prefixes = nestedPrefixesCache.get(fields);

  if (!prefixes) {
    prefixes = new Set();

    for (const field of fields) {
      const parts = field.split(PATH_SEPARATOR);

      for (let i = 1; i < parts.length; i += 1) {
        prefixes.add(parts.slice(0, i).join(PATH_SEPARATOR));
      }
    }

    nestedPrefixesCache.set(fields, prefixes);
  }

  return prefixes;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof Set) &&
    !(value instanceof Uint8Array) &&
    !TypeConverter.isGeoPoint(value)
  );
}

/** Writing to `__proto__` would change what every object of the process inherits. */
function assertWritable(segments: string[]): void {
  if (segments.includes('__proto__')) {
    throw new ValidationError("An attribute path cannot contain '__proto__'");
  }
}

/** Own properties only: what an object inherits is not a map to write into. */
function hasOwnMap(target: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key) && isPlainObject(target[key]);
}

export default class Serializer {
  /** Makes a value out of what the DocumentClient reads: no set, date object, buffer or bigint. */
  static normalize(value: unknown): unknown {
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Set) return [...value].map(item => Serializer.normalize(item));
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Uint8Array) return Buffer.from(value).toString('base64');
    if (Array.isArray(value)) return value.map(item => Serializer.normalize(item));

    if (isPlainObject(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [key, Serializer.normalize(nested)]),
      );
    }

    return value;
  }

  /** Turns an item into a record: maps that have declared columns become `a->b` fields. */
  static flatten(item: Record<string, unknown>, fields: Set<string>): RecordData {
    const prefixes = nestedPrefixes(fields);
    const record: RecordData = {};

    const visit = (value: Record<string, unknown>, prefix: string) => {
      for (const [key, nested] of Object.entries(value)) {
        const path = prefix ? `${prefix}${PATH_SEPARATOR}${key}` : key;

        if (isPlainObject(nested) && prefixes.has(path)) visit(nested, path);
        else record[path] = Serializer.normalize(nested);
      }
    };

    visit(item, '');

    return record;
  }

  /** Turns `a->b` fields back into nested maps, ready to be written. */
  static unflatten(record: RecordData): Record<string, unknown> {
    const item: Record<string, unknown> = {};

    for (const [field, value] of Object.entries(record)) {
      const parts = Serializer.toPathSegments(field);
      let target = item;

      assertWritable(parts);

      for (const part of parts.slice(0, -1)) {
        if (!hasOwnMap(target, part)) target[part] = {};
        target = target[part] as Record<string, unknown>;
      }

      target[parts[parts.length - 1]] = value instanceof Date ? value.toISOString() : value;
    }

    return item;
  }

  /** Sets the value at a path, creating the maps on the way, and replaces what was there. */
  static setPath(target: Record<string, unknown>, segments: string[], value: unknown): void {
    let holder = target;

    assertWritable(segments);

    for (const segment of segments.slice(0, -1)) {
      if (!hasOwnMap(holder, segment)) holder[segment] = {};
      holder = holder[segment] as Record<string, unknown>;
    }

    holder[segments[segments.length - 1]] = value instanceof Date ? value.toISOString() : value;
  }

  static toPathSegments(field: string): string[] {
    return field.split(PATH_SEPARATOR);
  }
}
