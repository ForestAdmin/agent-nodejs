import type { AgentPort } from '../ports/agent-port';
import type { ActionRef, CollectionRef, RecordData } from '../types/record';
import type { RemoteAgentClient, SelectOptions } from '@forestadmin/agent-client';

import { RecordNotFoundError } from '../errors';

function buildPkFilter(
  primaryKeyFields: string[],
  recordId: Array<string | number>,
): SelectOptions['filters'] {
  if (primaryKeyFields.length === 1) {
    return { field: primaryKeyFields[0], operator: 'Equal', value: recordId[0] };
  }

  return {
    aggregator: 'And',
    conditions: primaryKeyFields.map((field, i) => ({
      field,
      operator: 'Equal',
      value: recordId[i],
    })),
  };
}

// agent-client methods (update, relation, action) still expect the pipe-encoded string format
function encodePk(recordId: Array<string | number>): string {
  return recordId.map(v => String(v)).join('|');
}

function extractRecordId(
  primaryKeyFields: string[],
  record: Record<string, unknown>,
): Array<string | number> {
  return primaryKeyFields.map(field => record[field] as string | number);
}

export default class AgentClientAgentPort implements AgentPort {
  private readonly client: RemoteAgentClient;
  private readonly collectionRefs: Record<string, CollectionRef>;

  constructor(params: {
    client: RemoteAgentClient;
    collectionRefs: Record<string, CollectionRef>;
  }) {
    this.client = params.client;
    this.collectionRefs = params.collectionRefs;
  }

  async getRecord(collectionName: string, recordId: Array<string | number>): Promise<RecordData> {
    const ref = this.getCollectionRef(collectionName);
    const records = await this.client.collection(collectionName).list<Record<string, unknown>>({
      filters: buildPkFilter(ref.primaryKeyFields, recordId),
      pagination: { size: 1, number: 1 },
    });

    if (records.length === 0) {
      throw new RecordNotFoundError(collectionName, encodePk(recordId));
    }

    return { ...ref, recordId, values: records[0] };
  }

  async updateRecord(
    collectionName: string,
    recordId: Array<string | number>,
    values: Record<string, unknown>,
  ): Promise<RecordData> {
    const ref = this.getCollectionRef(collectionName);
    const updatedRecord = await this.client
      .collection(collectionName)
      .update<Record<string, unknown>>(encodePk(recordId), values);

    return { ...ref, recordId, values: updatedRecord };
  }

  async getRelatedData(
    collectionName: string,
    recordId: Array<string | number>,
    relationName: string,
  ): Promise<RecordData[]> {
    const relatedRef = this.getCollectionRef(relationName);

    const records = await this.client
      .collection(collectionName)
      .relation(relationName, encodePk(recordId))
      .list<Record<string, unknown>>();

    return records.map(record => ({
      ...relatedRef,
      recordId: extractRecordId(relatedRef.primaryKeyFields, record),
      values: record,
    }));
  }

  async getActions(collectionName: string): Promise<ActionRef[]> {
    const ref = this.collectionRefs[collectionName];

    return ref ? ref.actions : [];
  }

  async executeAction(
    collectionName: string,
    actionName: string,
    recordIds: Array<string | number>[],
  ): Promise<unknown> {
    const encodedIds = recordIds.map(id => encodePk(id));
    const action = await this.client
      .collection(collectionName)
      .action(actionName, { recordIds: encodedIds });

    return action.execute();
  }

  private getCollectionRef(collectionName: string): CollectionRef {
    const ref = this.collectionRefs[collectionName];

    if (!ref) {
      return {
        collectionName,
        collectionDisplayName: collectionName,
        primaryKeyFields: ['id'],
        fields: [],
        actions: [],
      };
    }

    return ref;
  }
}
