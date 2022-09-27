import { Projection, RecordData, RecordUtils } from '@forestadmin/datasource-toolkit';

type FlatRecordList = Array<unknown[]>;

export function unflatten(flatList: FlatRecordList, projection: Projection): RecordData[] {
  const numRecords = flatList[0]?.length ?? 0;
  const records = [];
  for (let i = 0; i < numRecords; i += 1) records[i] = {};

  // Set fields
  for (const column of projection.columns) {
    const pathIndex = projection.indexOf(column);

    for (const [index, value] of flatList[pathIndex].entries())
      records[index][column] = value ?? null;
  }

  // Set relations
  for (const [relation, paths] of Object.entries(projection.relations)) {
    const subFlatList = [];
    for (const path of paths) subFlatList.push(flatList[projection.indexOf(`${relation}:${path}`)]);

    const subRecords = unflatten(subFlatList, paths);
    for (const index of records.keys()) records[index][relation] = subRecords[index];
  }

  // Keep only objects where at least a non-null value is set
  return records.map(r => {
    return Object.values(r).some(v => v !== null) ? r : null;
  });
}

export function flatten(records: RecordData[], projection: string[]): FlatRecordList {
  return projection.map(field => records.map(r => RecordUtils.getFieldValue(r, field)));
}
