/**
 * To compute the fields in parallel, it is much easier to represent the records as a group of
 * arrays, one array per field.
 *
 * The issue with this transformation is that it is not a bijective function.
 *
 * When we flatten:
 * - { title: 'Foundation', author: { country: null } }
 *
 * After flattening/unflattening, we don't know if the original record was:
 * - { title: 'Foundation', author: { country: null } }
 * - { title: 'Foundation', author: null }
 *
 * This is why we add a special marker to the projection, to keep track of null values.
 */

const markerName = '__nullMarker';

export function withNullMarkers(projection: string[]): string[] {
  const set = new Set(projection);

  for (const path of projection) {
    const parts = path.split(':');
    for (let i = 1; i < parts.length; i += 1)
      set.add(`${parts.slice(0, i).join(':')}:${markerName}`);
  }

  return [...set];
}

export function unflatten(flatList: unknown[][], projection: string[]): unknown[] {
  const numRecords = flatList[0]?.length ?? 0;
  const records = [];

  for (let recordIndex = 0; recordIndex < numRecords; recordIndex += 1) {
    records[recordIndex] = {};

    for (const [pathIndex, path] of projection.entries()) {
      // When a marker is found, the parent is null.
      const parts = path.split(':').filter(part => part !== markerName);
      const value = flatList[pathIndex][recordIndex];

      // Ignore undefined values.
      if (value === undefined) continue; // eslint-disable-line no-continue

      // Set all others (including null)
      let record = records[recordIndex];

      for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
        const part = parts[partIndex];

        if (partIndex === parts.length - 1) record[part] = value;
        else if (!record[part]) record[part] = {};

        record = record[part];
      }
    }
  }

  return records;
}

export function flatten(records: unknown[], paths: string[]): unknown[][] {
  return paths.map(field => {
    const parts = field.split(':');

    return records.map(record => {
      let value = record;

      for (let i = 0; i < parts.length - 1; i += 1) {
        value = value?.[parts[i]];
      }

      // for markers, the value tells us which fields are null so that we can set them.
      if (parts[parts.length - 1] === markerName) return value === null ? null : undefined;

      return value?.[parts[parts.length - 1]];
    });
  });
}
