import { RecordData } from '../../../interfaces/record';
import RecordUtils from '../../../utils/record';

type FlatRecordList = Array<unknown[]>;

export function unflatten(flatList: FlatRecordList, projection: string[]): RecordData[] {
  const numRecords = flatList[0]?.length ?? 0;
  const records = new Array(numRecords);

  for (let i = 0; i < numRecords; i += 1) {
    records[i] = {};
  }

  for (const [pathIndex, path] of projection.entries()) {
    for (const [recordIndex, value] of flatList[pathIndex].entries()) {
      const pathKeys = path.split(':');
      let current = records[recordIndex];

      if (value !== undefined) {
        const finalKey = pathKeys.pop();

        for (const part of pathKeys) {
          if (current[part] === undefined || current[part] === null) current[part] = {};
          current = current[part];
        }

        current[finalKey] = value;
      } else {
        current[pathKeys[0]] = null;
      }
    }
  }

  return records;
}

export function flatten(records: RecordData[], projection: string[]): FlatRecordList {
  return projection.map(field => records.map(r => RecordUtils.getFieldValue(r, field)));
}
