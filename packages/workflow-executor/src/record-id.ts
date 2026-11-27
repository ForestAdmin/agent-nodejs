import type { RecordId } from './types/validated/collection';

import {
  deserializeRecordId as deserializeAgentRecordId,
  serializeRecordId as serializeAgentRecordId,
} from '@forestadmin/agent-client';

import { RecordIdSerializationError } from './errors';

export function serializeRecordId(recordId: RecordId): string {
  try {
    return serializeAgentRecordId(recordId);
  } catch (error) {
    throw new RecordIdSerializationError((error as Error).message);
  }
}

export function deserializeRecordId(value: string): string[] {
  return deserializeAgentRecordId(value);
}
