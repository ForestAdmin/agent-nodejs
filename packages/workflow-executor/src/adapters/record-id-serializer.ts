export function serializeRecordId(recordId: Array<string | number>): string {
  return recordId.map(String).join('|');
}

export function deserializeRecordId(value: string): Array<string | number> {
  return value.split('|');
}
