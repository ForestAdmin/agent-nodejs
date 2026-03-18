import type { RemoteAgentClient, SelectOptions } from '@forestadmin/agent-client';

import type { AgentPort } from '../ports/agent-port';
import type { ActionRef, CollectionRef, RecordData } from '../types/record';

import { RecordNotFoundError } from '../errors';

function buildPkFilter(recordId: Record<string, unknown>): SelectOptions['filters'] {
  const entries = Object.entries(recordId);

  if (entries.length === 1) {
    return { field: entries[0][0], operator: 'Equal', value: entries[0][1] };
  }

  return {
    aggregator: 'And',
    conditions: entries.map(([field, value]) => ({ field, operator: 'Equal', value })),
  };
}

// agent-client methods (update, relation, action) still expect the pipe-encoded string format
function encodeRecordId(primaryKeyFields: string[], recordId: Record<string, unknown>): string {
  return primaryKeyFields.map(field => String(recordId[field] ?? '')).join('|');
}

function extractRecordId(primaryKeyFields: string[], record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(primaryKeyFields.map(field => [field, record[field]]));
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

  async getRecord(collectionName: string, recordId: Record<string, unknown>): Promise<RecordData> {
    const ref = this.getCollectionRef(collectionName);
    const records = await this.client.collection(collectionName).list<Record<string, unknown>>({
      filters: buildPkFilter(recordId),
      pagination: { size: 1, number: 1 },
    });

    if (records.length === 0) {
      throw new RecordNotFoundError(collectionName, encodeRecordId(ref.primaryKeyFields, recordId));
    }

    return { ...ref, recordId, values: records[0] };
  }

  async updateRecord(
    collectionName: string,
    recordId: Record<string, unknown>,
    values: Record<string, unknown>,
  ): Promise<RecordData> {
    const ref = this.getCollectionRef(collectionName);
    const updatedRecord = await this.client
      .collection(collectionName)
      .update<Record<string, unknown>>(encodeRecordId(ref.primaryKeyFields, recordId), values);

    return { ...ref, recordId, values: updatedRecord };
  }

  async getRelatedData(
    collectionName: string,
    recordId: Record<string, unknown>,
    relationName: string,
  ): Promise<RecordData[]> {
    const ref = this.getCollectionRef(collectionName);
    const relatedRef = this.getCollectionRef(relationName);

    const records = await this.client
      .collection(collectionName)
      .relation(relationName, encodeRecordId(ref.primaryKeyFields, recordId))
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
    recordIds: Record<string, unknown>[],
  ): Promise<unknown> {
    const ref = this.getCollectionRef(collectionName);
    const encodedIds = recordIds.map(id => encodeRecordId(ref.primaryKeyFields, id));
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
