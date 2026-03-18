/** @draft Types derived from the workflow-executor spec -- subject to change. */

// -- Schema types (structure of a collection — source: WorkflowPort) --

export interface FieldSchema {
  fieldName: string;
  displayName: string;
  isRelationship: boolean;
}

export interface ActionRef {
  name: string;
  displayName: string;
}

export interface CollectionSchema {
  collectionName: string;
  collectionDisplayName: string;
  primaryKeyFields: string[];
  fields: FieldSchema[];
  actions: ActionRef[];
}

// -- Record types (data — source: AgentPort/RunStore) --

/** Lightweight pointer to a specific record. */
export interface RecordRef {
  collectionName: string;
  recordId: Array<string | number>;
  /** Index of the workflow step that loaded this record. */
  stepIndex: number;
}

/** A record with its loaded field values. */
export interface RecordData extends RecordRef {
  values: Record<string, unknown>;
}
