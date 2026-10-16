import type { RecordData, Sort } from '@forestadmin/datasource-toolkit';

import compareValues from './compare';

/** Missing values come last whatever the direction, as DynamoDB has no notion of nulls order. */
export default function compareRecords(a: RecordData, b: RecordData, sort: Sort): number {
  for (const { field, ascending } of sort) {
    const [left, right] = [a[field], b[field]];
    const leftMissing = left === undefined || left === null;
    const rightMissing = right === undefined || right === null;

    if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;

    if (!leftMissing) {
      const order = compareValues(left, right);

      if (order !== 0) return ascending ? order : -order;
    }
  }

  return 0;
}
