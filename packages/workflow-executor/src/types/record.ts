/** @draft Types derived from the workflow-executor spec -- subject to change. */

export interface RecordFieldRef {
  fieldName: string;
  displayName: string;
  type: string;
  isRelationship: boolean;
  referencedCollectionName?: string;
}

export interface ActionRef {
  name: string;
  displayName: string;
}

export interface CollectionRef {
  collectionName: string;
  collectionDisplayName: string;
  primaryKeyFields: string[];
  fields: RecordFieldRef[];
  actions: ActionRef[];
}

export interface RecordData extends CollectionRef {
  // TODO: improve recordId typing — consider a branded type or a stricter shape once the API stabilizes
  recordId: Record<string, unknown>;
  values: Record<string, unknown>;
}
