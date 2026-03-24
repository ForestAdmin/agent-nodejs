/** @draft Types derived from the workflow-executor spec -- subject to change. */

// -- Schema types (structure of a collection — source: WorkflowPort) --

export interface FieldSchema {
  fieldName: string;
  displayName: string;
  isRelationship: boolean;
  /** Cardinality of the relation. Absent for non-relationship fields. */
  relationType?: 'BelongsTo' | 'HasMany' | 'HasOne';
}

export interface ActionSchema {
  name: string;
  displayName: string;
}

export interface CollectionSchema {
  collectionName: string;
  collectionDisplayName: string;
  primaryKeyFields: string[];
  fields: FieldSchema[];
  actions: ActionSchema[];
}

// -- Record types (data — source: AgentPort/RunStore) --

/** Lightweight pointer to a specific record. */
export interface RecordRef {
  collectionName: string;
  recordId: Array<string | number>;
  /** Index of the workflow step that loaded this record. */
  stepIndex: number;
}

/** A record with its loaded field values — no stepIndex (agent doesn't know about steps). */
export type RecordData = Omit<RecordRef, 'stepIndex'> & { values: Record<string, unknown> };
