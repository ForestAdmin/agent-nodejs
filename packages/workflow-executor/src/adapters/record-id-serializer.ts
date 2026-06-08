import type { RecordId } from '../types/validated/collection';

import { RecordIdSerializationError } from '../errors';

export function serializeRecordId(recordId: RecordId): string {
  return recordId
    .map(part => {
      const serialized = String(part);

      if (serialized.includes('|')) {
        throw new RecordIdSerializationError(serialized);
      }

      return serialized;
    })
    .join('|');
}

export function deserializeRecordId(value: string): string[] {
  return value.split('|');
}
