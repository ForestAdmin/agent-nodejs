// Wire format for (composite) record ids exchanged with the front and orchestrator: the segments
// are joined with '|'. This is a cross-system contract (orchestrator + front + agent-client all use
// it). Limitation: a primary-key value that itself contains '|' is not round-trip safe — accepted,
// as it is the convention used throughout the Forest stack.
export function serializeRecordId(recordId: Array<string | number>): string {
  return recordId.join('|');
}

// Always returns strings: ids travel as opaque strings across systems (no number round-trip).
export function deserializeRecordId(value: string): string[] {
  return value.split('|');
}
