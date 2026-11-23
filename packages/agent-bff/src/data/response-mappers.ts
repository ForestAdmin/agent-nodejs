import type { PrimaryKeyField } from '../read-model/read-model';

import unpackPrimaryKey from './pack-id';
import { mappingError } from '../http/bff-local-errors';

export interface ForestRecordMetadata {
  collection: string;
  primaryKey: Record<string, string | number>;
}

export interface ListResponse {
  data: Array<Record<string, unknown> & { __forest: ForestRecordMetadata }>;
  meta: { countStatus: 'not_requested' };
}

export interface CountResponse {
  count: number | null;
  countStatus: 'available' | 'deactivated';
}

export function mapListResponse(
  collection: string,
  records: Record<string, unknown>[],
  primaryKeys: PrimaryKeyField[],
): ListResponse {
  const data = records.map(record => {
    if (record.id === undefined || record.id === null) {
      throw mappingError('Agent record is missing its id');
    }

    return {
      ...record,
      __forest: {
        collection,
        primaryKey: unpackPrimaryKey(String(record.id), primaryKeys, record),
      },
    };
  });

  return { data, meta: { countStatus: 'not_requested' } };
}

export function mapCountResponse(count: number | null): CountResponse {
  if (count === null) return { count: null, countStatus: 'deactivated' };

  if (Number.isFinite(count)) return { count, countStatus: 'available' };

  // Neither a deactivated marker nor a usable count: never silently report 0.
  throw mappingError('Agent count payload has no numeric count and no deactivated marker');
}
