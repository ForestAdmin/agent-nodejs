import type { AgentPort } from '../ports/agent-port';
import type { ActionRef, CollectionRef, RecordData } from '../types/record';
import type { RemoteAgentClient, SelectOptions } from '@forestadmin/agent-client';

import { RecordNotFoundError } from '../errors';

const PK_SEPARATOR = '|';

function buildPkFilter(primaryKeyFields: string[], recordId: string): SelectOptions['filters'] {
  const values = recordId.split(PK_SEPARATOR);

  if (primaryKeyFields.length === 1) {
    return { field: primaryKeyFields[0], operator: 'Equal', value: values[0] };
  }

  return {
    aggregator: 'And',
    conditions: primaryKeyFields.map((field, i) => ({
      field,
      operator: 'Equal',
      value: values[i],
    })),
  };
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

  async getRecord(collectionName: string, recordId: string): Promise<RecordData> {
    const ref = this.getCollectionRef(collectionName);
    const records = await this.client.collection(collectionName).list<Record<string, unknown>>({
      filters: buildPkFilter(ref.primaryKeyFields, recordId),
      pagination: { size: 1, number: 1 },
    });

    if (records.length === 0) {
      throw new RecordNotFoundError(collectionName, recordId);
    }

    return { ...ref, recordId, values: records[0] };
  }

  async updateRecord(
    collectionName: string,
    recordId: string,
    values: Record<string, unknown>,
  ): Promise<RecordData> {
    const updatedRecord = await this.client
      .collection(collectionName)
      .update<Record<string, unknown>>(recordId, values);

    return { ...this.getCollectionRef(collectionName), recordId, values: updatedRecord };
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

  async getActions(collectionName: string): Promise<ActionRef[]> {
    const ref = this.collectionRefs[collectionName];

    return ref ? ref.actions : [];
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
        primaryKeyFields: ['id'],
        fields: [],
        actions: [],
      };
    }

    return ref;
  }
}
