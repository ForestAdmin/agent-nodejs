import type { RecordId } from '../types/validated/collection';

import { RecordIdSerializationError } from '../errors';

// Wire format for (composite) record ids exchanged with the front and orchestrator: the segments
// are joined with '|'. This is a cross-system contract (orchestrator + front + agent-client all use
// it). Throws — rather than silently corrupting the key — when a part contains the '|' separator,
// since that would produce a malformed id that round-trips to the wrong record. Mirrors the
// hardened serializer in `@forestadmin/agent-client` (src/record-id.ts).
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

// Always returns strings: ids travel as opaque strings across systems (no number round-trip).
// Stays intentionally permissive — empty/malformed segments (e.g. from a partial 'a|' wire value)
// are rejected at the validation boundaries that consume the result: `RecordRefSchema.recordId`
// (mapper output) and the `selectedRecordId` schema in `pending-data-validators.ts` (front input).
export function deserializeRecordId(value: string): string[] {
  return value.split('|');
}
