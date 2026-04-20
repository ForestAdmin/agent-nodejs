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

export type GetActionFormInfoQuery = { collection: string; action: string; id: Id[] };

export interface AgentPort {
  getRecord(query: GetRecordQuery, user: StepUser): Promise<RecordData>;
  updateRecord(query: UpdateRecordQuery, user: StepUser): Promise<RecordData>;
  getRelatedData(query: GetRelatedDataQuery, user: StepUser): Promise<RecordData[]>;
  executeAction(query: ExecuteActionQuery, user: StepUser): Promise<unknown>;
  /**
   * Returns whether the action has a user-facing form. Queries the agent via
   * agent-client's `collection.action()` which triggers the /hooks/load endpoint.
   *
   * - Node agents always respond with the real fields (even when hooks.load=false).
   * - Old Ruby agents with hooks.load=false return 404; agent-client falls back to
   *   the `fields` passed in `ActionEndpointsByCollection` (populated from the
   *   orchestrator's schema).
   */
  getActionFormInfo(query: GetActionFormInfoQuery, user: StepUser): Promise<{ hasForm: boolean }>;
  /**
   * Verifies the agent is reachable at startup by hitting its public
   * healthcheck route. Throws `AgentProbeError` on network error, timeout,
   * or non-2xx HTTP response.
   *
   * JWT validity is NOT checked here (no public route is auth-required across
   * all agent versions). The shared authSecret is validated naturally when
   * the first step runs — any mismatch surfaces in that step's error log.
   */
  probe(): Promise<void>;
}
