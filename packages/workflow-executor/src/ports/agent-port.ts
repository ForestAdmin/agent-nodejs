/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { ActionRef, RecordData } from '../types/record';

export interface AgentPort {
  getRecord(collectionName: string, recordId: string): Promise<RecordData>;
  updateRecord(
    collectionName: string,
    recordId: string,
    values: Record<string, unknown>,
  ): Promise<RecordData>;
  getRelatedData(
    collectionName: string,
    recordId: string,
    relationName: string,
  ): Promise<RecordData[]>;
  getActions(collectionName: string): Promise<ActionRef[]>;
  executeAction(collectionName: string, actionName: string, recordIds: string[]): Promise<unknown>;
}
