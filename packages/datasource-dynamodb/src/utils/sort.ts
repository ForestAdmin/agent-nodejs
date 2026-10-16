import type { RecordData, Sort } from '@forestadmin/datasource-toolkit';

/** Missing values come last whatever the direction, as DynamoDB has no notion of nulls order. */
export default function compareRecords(a: RecordData, b: RecordData, sort: Sort): number {
  for (const { field, ascending } of sort) {
    const [left, right] = [a[field], b[field]];
    const leftMissing = left === undefined || left === null;
    const rightMissing = right === undefined || right === null;

    if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;

    if (!leftMissing && left !== right) {
      const order = (left as number) < (right as number) ? -1 : 1;

      return ascending ? order : -order;
    }
  }

  return 0;
}
