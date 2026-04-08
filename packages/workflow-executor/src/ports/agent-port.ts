/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { StepUser } from '../types/execution';
import type { RecordData } from '../types/record';

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

export interface AgentPort {
  getRecord(query: GetRecordQuery, user: StepUser): Promise<RecordData>;
  updateRecord(query: UpdateRecordQuery, user: StepUser): Promise<RecordData>;
  getRelatedData(query: GetRelatedDataQuery, user: StepUser): Promise<RecordData[]>;
  executeAction(query: ExecuteActionQuery, user: StepUser): Promise<unknown>;
}
