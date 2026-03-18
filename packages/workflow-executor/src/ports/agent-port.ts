/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { ActionRef, RecordData } from '../types/record';

export interface AgentPort {
  getRecord(collectionName: string, recordId: Record<string, unknown>): Promise<RecordData>;
  updateRecord(
    collectionName: string,
    recordId: Record<string, unknown>,
    values: Record<string, unknown>,
  ): Promise<RecordData>;
  getRelatedData(
    collectionName: string,
    recordId: Record<string, unknown>,
    relationName: string,
  ): Promise<RecordData[]>;
  getActions(collectionName: string): Promise<ActionRef[]>;
  executeAction(
    collectionName: string,
    actionName: string,
    recordIds: Record<string, unknown>[],
  ): Promise<unknown>;
}
