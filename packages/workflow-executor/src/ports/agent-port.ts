/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { ActionRef, RecordData } from '../types/record';

export interface AgentPort {
  getRecord(collectionName: string, recordId: Array<string | number>): Promise<RecordData>;
  updateRecord(
    collectionName: string,
    recordId: Array<string | number>,
    values: Record<string, unknown>,
  ): Promise<RecordData>;
  getRelatedData(
    collectionName: string,
    recordId: Array<string | number>,
    relationName: string,
  ): Promise<RecordData[]>;
  getActions(collectionName: string): Promise<ActionRef[]>;
  executeAction(
    collectionName: string,
    actionName: string,
    recordIds: Array<string | number>[],
  ): Promise<unknown>;
}
