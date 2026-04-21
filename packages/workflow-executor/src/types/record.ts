/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { ForestSchemaAction } from '@forestadmin/forestadmin-client';

// -- Schema types (structure of a collection — source: WorkflowPort) --

export interface FieldSchema {
  fieldName: string;
  displayName: string;
  isRelationship: boolean;
  /** Cardinality of the relation. Absent for non-relationship fields. */
  relationType?: 'BelongsTo' | 'HasMany' | 'HasOne';
  /** Target collection name; only meaningful for relationship fields. */
  relatedCollectionName?: string;
}

export interface ActionSchema {
  name: string;
  displayName: string;
  endpoint: string;
  /** Static form fields. Used as fallback when the agent's /hooks/load route 404s (old Ruby agents). */
  fields?: ForestSchemaAction['fields'];
  /** Action lifecycle hooks. Drives agent-client's dynamic form loading. */
  hooks?: ForestSchemaAction['hooks'];
}

export interface CollectionSchema {
  collectionName: string;
  collectionDisplayName: string;
  primaryKeyFields: string[];
  fields: FieldSchema[];
  actions: ActionSchema[];
}

// -- Record types (data — source: AgentPort/RunStore) --

export interface RecordRef {
  collectionName: string;
  recordId: Array<string | number>;
  // Index of the workflow step that loaded this record.
  stepIndex: number;
}

// No stepIndex — the agent doesn't know about steps.
export type RecordData = Omit<RecordRef, 'stepIndex'> & { values: Record<string, unknown> };
