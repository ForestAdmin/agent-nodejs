/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { ActionRef, RecordData } from '../types/record';

type AgentRecord = Omit<RecordData, 'stepIndex'>;

export interface AgentPort {
  getRecord(collectionName: string, recordId: Array<string | number>): Promise<AgentRecord>;
  updateRecord(
    collectionName: string,
    recordId: Array<string | number>,
    values: Record<string, unknown>,
  ): Promise<AgentRecord>;
  getRelatedData(
    collectionName: string,
    recordId: Array<string | number>,
    relationName: string,
  ): Promise<AgentRecord[]>;
  getActions(collectionName: string): Promise<ActionRef[]>;
  executeAction(
    collectionName: string,
    actionName: string,
    recordIds: Array<string | number>[],
  ): Promise<unknown>;
}
