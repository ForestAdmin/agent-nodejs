import { ColumnType, RecordData } from '@forestadmin/datasource-toolkit';

/**
 * Given the name of a column, its type and the maximum allowed depth, compute the list of paths
 * that can be flattened.
 *
 * @example
 * listPaths('address', { streetName: 'String' }, 2)
 * // => ['address@@@streetName']
 */
export function listPaths(columnName: string, type: ColumnType, level: number): string[] {
  return level <= 0 || typeof type !== 'object'
    ? [columnName]
    : Object.keys(type)
        .map(key => listPaths(`${columnName}@@@${key}`, type[key], level - 1))
        .flat();
}

/**
 * Convert string which are provided in the options.include and options.exclude to a valid path.
 *
 * @example
 * includeStrToPath('country:name', 'address') // => 'address@@@country@@@name'
 */
export function includeStrToPath(columnName: string, include: string): string {
  return `${columnName}@@@${include.replace(/[.:]/g, '@@@')}`;
}

/**
 * Recursively update the first object with the values of the second one.
 *
 * @example
 * deepUpdateInPlace({ a: 1, b: 2 }, { b: 3, c: 4 })
 * // => { a: 1, b: 3, c: 4 }
 */
export function deepUpdateInPlace(memo: RecordData, newData: RecordData): void {
  for (const [key, value] of Object.entries(newData)) {
    const isObject =
      value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

    if (isObject) {
      memo[key] ??= {};
      deepUpdateInPlace(memo[key], value);
    } else {
      memo[key] = value;
    }
  }
}

/**
 * Get a flattened value from a record.
 *
 * @example
 * getValue({ address: { streetName: 'rue de la paix' } }, 'address@@@streetName')
 * // => 'rue de la paix'
 */
export function getValue(object: unknown, path: string): unknown {
  if (object === undefined || object === null) {
    return object;
  }

  const [key, ...rest] = path.split('@@@');

  return rest.length === 0 ? object[key] : getValue(object[key], rest.join('@@@'));
}

/**
 * Given a list of flattened paths, unflatten them in place in the given object.
 * The values of the flattened paths are deleted from the object in place.
 *
 * @example
 * unflattenPathsInPlace(['address@@@streetName'], { 'address@@@streetName': 'rue de la paix' })
 * // => { address: { streetName: 'rue de la paix' } }
 */
export function unflattenPathsInPlace(paths: string[], patch: RecordData): void {
  const keysToRewrite = paths.filter(p => patch[p] !== undefined);

  for (const key of keysToRewrite) {
    let subExternalPatch = patch;
    const parts = key.split('@@@');

    for (const [index, part] of parts.entries()) {
      if (index === parts.length - 1) {
        subExternalPatch[part] = patch[key];
      } else {
        subExternalPatch[part] ??= {};
        subExternalPatch = subExternalPatch[part];
      }
    }

    delete patch[key];
  }
}
