/* eslint-disable no-underscore-dangle */
import type { CollectionReplicaSchema } from './types';
import type { RecordData } from '@forestadmin/datasource-toolkit';

export function escape(strings: TemplateStringsArray, ...exps: unknown[]): string {
  return strings.reduce((acc, str, i) => acc + str + (exps[i] ?? ''), '').replace(/\./g, '_');
}

export function deepclone(any: unknown) {
  return JSON.parse(JSON.stringify(any));
}

export function extractValue(record: RecordData, path: string, remove: boolean) {
  if (!path) return record;

  const [prefix, suffix] = path.split(/\.(.*)/);
  const value = extractValue(record?.[prefix], suffix, remove);
  if (remove && record && (!suffix || !Object.keys(record?.[prefix] ?? {}).length))
    delete record[prefix];

  return value;
}

export function getRecordId(
  fields: CollectionReplicaSchema['fields'],
  record: RecordData,
): unknown {
  if (record._fid) return record._fid;

  const pks = Object.entries(fields)
    .filter(([, v]) => 'type' in v && v.isPrimaryKey)
    .map(([k]) => record[k]);

  if (pks.length === 0) throw new Error('No primary key found');
  else if (pks.length === 1) return pks[0];
}
