import type { PrimaryKeyField } from '../read-model/read-model';

import unpackPrimaryKey from './pack-id';
import { mappingError } from '../http/bff-local-errors';

export type CountStatus = 'available' | 'deactivated' | 'not_requested';

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

const DEACTIVATED = 'deactivated';

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
        primaryKey: unpackPrimaryKey(String(record.id), primaryKeys),
      },
    };
  });

  return { data, meta: { countStatus: 'not_requested' } };
}

export function mapCountResponse(raw: unknown): CountResponse {
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as {
    count?: unknown;
    meta?: { count?: unknown };
  };

  if (body.meta?.count === DEACTIVATED) {
    return { count: null, countStatus: 'deactivated' };
  }

  if (typeof body.count === 'number' && Number.isFinite(body.count)) {
    return { count: body.count, countStatus: 'available' };
  }

  // Neither schema metadata nor a usable raw payload: never silently report 0.
  throw mappingError('Agent count payload has no numeric count and no deactivated marker');
}
