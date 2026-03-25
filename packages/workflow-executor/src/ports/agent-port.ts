/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { StepUser } from '../types/execution';
import type { CollectionSchema, RecordData } from '../types/record';

export type Id = string | number;

export type Limit = { limit: number } | { limit: null };

export type GetRecordQuery = { collection: string; id: Id[]; fields?: string[] };

export type UpdateRecordQuery = { collection: string; id: Id[]; values: Record<string, unknown> };

export type GetRelatedDataQuery = {
  collection: string;
  id: Id[];
  relation: string;
  fields?: string[];
} & Limit;

export type ExecuteActionQuery = { collection: string; action: string; id?: Id[] };

export interface AgentCallContext {
  user: StepUser;
  schemaCache: Map<string, CollectionSchema>;
}

export interface AgentPort {
  getRecord(query: GetRecordQuery, context: AgentCallContext): Promise<RecordData>;
  updateRecord(query: UpdateRecordQuery, context: AgentCallContext): Promise<RecordData>;
  getRelatedData(query: GetRelatedDataQuery, context: AgentCallContext): Promise<RecordData[]>;
  executeAction(query: ExecuteActionQuery, context: AgentCallContext): Promise<unknown>;
}
