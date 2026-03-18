import type { AgentPort } from '../ports/agent-port';
import type { CollectionRef, RecordData } from '../types/record';
import type { RemoteAgentClient } from '@forestadmin/agent-client';

import { RecordNotFoundError } from '../errors';

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

  async getRecord(collectionName: string, recordId: string): Promise<RecordData> {
    const records = await this.client.collection(collectionName).list<Record<string, unknown>>({
      filters: { field: 'id', operator: 'Equal', value: recordId },
      pagination: { size: 1, number: 1 },
    });

    if (records.length === 0) {
      throw new RecordNotFoundError(collectionName, recordId);
    }

    return {
      ...this.getCollectionRef(collectionName),
      recordId,
      values: records[0],
    };
  }

  async updateRecord(
    collectionName: string,
    recordId: string,
    values: Record<string, unknown>,
  ): Promise<RecordData> {
    const updatedRecord = await this.client
      .collection(collectionName)
      .update<Record<string, unknown>>(recordId, values);

    return {
      ...this.getCollectionRef(collectionName),
      recordId,
      values: updatedRecord,
    };
  }

  async getRelatedData(
    collectionName: string,
    recordId: string,
    relationName: string,
  ): Promise<RecordData[]> {
    const records = await this.client
      .collection(collectionName)
      .relation(relationName, recordId)
      .list<Record<string, unknown>>();

    const ref = this.getCollectionRef(relationName);

    return records.map(record => ({
      ...ref,
      recordId: String(record.id ?? ''),
      values: record,
    }));
  }

  async getActions(collectionName: string): Promise<string[]> {
    const ref = this.collectionRefs[collectionName];

    return ref ? ref.actions.map(a => a.name) : [];
  }

  async executeAction(
    collectionName: string,
    actionName: string,
    recordIds: string[],
  ): Promise<unknown> {
    const action = await this.client.collection(collectionName).action(actionName, { recordIds });

    return action.execute();
  }

  private getCollectionRef(collectionName: string): CollectionRef {
    const ref = this.collectionRefs[collectionName];

    if (!ref) {
      return {
        collectionName,
        collectionDisplayName: collectionName,
        fields: [],
        actions: [],
      };
    }

    return ref;
  }
}
