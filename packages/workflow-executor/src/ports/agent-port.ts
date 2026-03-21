/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { RecordData } from '../types/record';

export type Id = string | number;

export type QueryBase = {
  collection: string;
  ids: Id[];
  fields?: string[];
};

export type Limit = { limit: number } | { limit: null };

export interface AgentPort {
  getRecord(query: QueryBase): Promise<RecordData>;

  updateRecord(query: QueryBase & { values: Record<string, unknown> }): Promise<RecordData>;

  getRelatedData(query: QueryBase & { relation: string } & Limit): Promise<RecordData[]>;

  executeAction(query: { collection: string; action: string; ids?: Id[] }): Promise<unknown>;
}
