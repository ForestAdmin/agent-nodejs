/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordData } from '@forestadmin/datasource-toolkit';
import { Types, isValidObjectId } from 'mongoose';

/**
 * Replace dots by underscores.
 *
 * @example
 * escape('a.b') == 'a_b'
 */
export function escape(str: string): string {
  return str.replace(/\./g, '_');
}

/**
 * Set a value in a plain object recursively
 *
 * @example
 * const a = {};
 * recursiveSet(a, 'field.subfield', 42);
 * a == { field: { subfield: 42 } }
 */
export function recursiveSet(target: any, path: string, value: unknown): void {
  const index = path.indexOf('.');

  if (index !== -1) {
    const prefix = path.substring(0, index);
    const suffix = path.substring(index + 1);
    target[prefix] ??= {};

    recursiveSet(target[prefix], suffix, value);
  } else {
    target[path] = value;
  }
}

/**
 * Remove a value in a plain object recursively
 * If the value is an object and is empty, it will be removed.
 *
 * @example
 * const a = { field: { subfield: 42 } };
 * recursiveDelete(a, 'field.subfield');
 * a == {  }
 */
export function recursiveDelete(target: any, path: string): void {
  const index = path.indexOf('.');

  if (index !== -1) {
    const prefix = path.substring(0, index);
    const suffix = path.substring(index + 1);

    recursiveDelete(target[prefix], suffix);

    if (Object.keys(target[prefix]).length === 0) {
      delete target[prefix];
    }
  } else {
    delete target[path];
  }
}

/**
 * Compare two ids.
 * This is useful to ensure we perform array operations in the right order.
 *
 * @example
 * compareIds('a.20.a', 'a.1.b') => 1 (because 1 < 20)
 * compareIds('a.0.a', 'b.1.b') => -1 (because 'a' < 'b')
 */
export function compareIds(a: string, b: string): number {
  const isNumber = /^\d+$/;
  const partsA = a.split('.');
  const partsB = b.split('.');
  const length = a.length < b.length ? a.length : b.length;

  for (let i = 0; i < length; i += 1) {
    if (partsA[i] !== partsB[i] && isNumber.test(partsA[i]) && isNumber.test(partsB[i]))
      return Number(partsA[i]) - Number(partsB[i]);

    if (partsA[i] < partsB[i]) return -1;
    if (partsA[i] > partsB[i]) return 1;
  }

  if (partsA.length < partsB.length) return -1;
  if (partsA.length > partsB.length) return 1;

  return 0;
}

/**
 * Split the fake ids which are generated when using the `asModel` option into rootId + path.
 *
 * @example
 * splitId('123.some.path.0.to.the.item) == [123, 'some.path.0.to.the.item]
 */
export function splitId(id: string): [unknown, string] {
  const dotIndex = id.indexOf('.');
  const rootId = id.substring(0, dotIndex);
  const path = id.substring(dotIndex + 1);

  // @fixme hack, we should never do that without looking at the schema
  return isValidObjectId(rootId)
    ? [Types.ObjectId.createFromHexString(rootId), path]
    : [rootId, path];
}

/**
 * Group the fake ids which are generated when using the `asModel` option by the path they are
 * targeting to help performing requests.
 *
 * @example
 * groupIdsByPath(['123.field', '456.field']) == { field: [123, 456] }
 */
export function groupIdsByPath(ids: string[]): { [path: string]: unknown[] } {
  const updates = {};

  for (const id of ids) {
    const [rootId, path] = splitId(id);

    updates[path] ??= [];
    updates[path].push(rootId);
  }

  return updates;
}

/**
 * Replace ObjectId and Date instances in records by strings.
 *
 * @example
 * replaceMongoTypes({_id: ObjectId('12312321313'), createdAt: Date() })
 * == { _id: '12312321313', createdAt: '2010-01-01T00:00:00Z' }
 */
export function replaceMongoTypes(data: any): any {
  if (data instanceof Uint8Array) return data;
  if (data instanceof Date) return data.toISOString();
  if (data instanceof Types.ObjectId) return data.toHexString();

  // eslint-disable-next-line no-underscore-dangle
  if (data?._bsontype === 'Binary') return data.buffer;

  if (Array.isArray(data)) return data.map(item => replaceMongoTypes(item));

  if (typeof data === 'object' && data !== null)
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, replaceMongoTypes(value)]),
    );

  return data;
}

/**
 * Takes a patch that was built to be applied on a subdocument, and returns a patch that can be
 * applied on the parent document.
 *
 * @example
 * nestPatch('authors.1', { _id: '123', name: 'Asimov'}, false)
 *  == nestPatch('authors.1.name', { _id: '123', content: 'Asimov'}, true)
 *  == { 'authors.1.name': 'Asimov' }
 */
export function buildSubdocumentPatch(
  path: string,
  patch: RecordData,
  isLeaf: boolean,
): RecordData {
  const cleanPatch = {};

  if (isLeaf) {
    cleanPatch[path] = patch.content;
  } else {
    for (const [key, value] of Object.entries(patch)) {
      if (key !== '_id' && key !== 'parentId') {
        cleanPatch[`${path}.${key}`] = value;
      }
    }
  }

  return cleanPatch;
}

/**
 * Unflattend patches and records
 */
export function unflattenRecord(
  record: RecordData,
  asFields: string[],
  patchMode = false,
): RecordData {
  const newRecord = { ...record };

  for (const field of asFields) {
    const alias = field.replace(/\./g, '@@@');
    const value = newRecord[alias];

    if (value !== undefined) {
      if (patchMode) newRecord[field] = value;
      else recursiveSet(newRecord, field, value);
      delete newRecord[alias];
    }
  }

  return newRecord;
}

/**
 * Similar to projection.unnest
 * @example
 * unnest(['firstname', 'book.title', 'book.author'], 'book') == ['title', 'author']
 */
export function unnest(strings: string[], prefix: string): string[] {
  return strings.filter(f => f.startsWith(`${prefix}.`)).map(f => f.substring(prefix.length + 1));
}
