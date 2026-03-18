/** @draft Types derived from the workflow-executor spec -- subject to change. */

export interface RecordFieldRef {
  fieldName: string;
  displayName: string;
  type: string;
  isRelationship: boolean;
  referencedCollectionName?: string;
}

export interface RecordRef {
  recordId: string;
  collectionName: string;
  collectionDisplayName: string;
  fields: RecordFieldRef[];
}

export interface RecordData extends RecordRef {
  values: Record<string, unknown>;
}
