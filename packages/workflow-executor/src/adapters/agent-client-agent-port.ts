import type { AgentPort } from '../ports/agent-port';
import type { RecordData, RecordFieldRef } from '../types/record';
import type { ActionEndpointsByCollection, RemoteAgentClient } from '@forestadmin/agent-client';

import { RecordNotFoundError } from '../errors';

const RELATIONSHIP_TYPES = new Set(['ManyToOne', 'OneToOne', 'OneToMany', 'ManyToMany']);

function toRecordFieldRef(field: { name: string; type: string }): RecordFieldRef {
  return {
    fieldName: field.name,
    displayName: field.name,
    type: field.type,
    isRelationship: RELATIONSHIP_TYPES.has(field.type),
    referencedCollectionName: undefined,
  };
}

export default class AgentClientAgentPort implements AgentPort {
  private readonly client: RemoteAgentClient;
  private readonly actionEndpoints: ActionEndpointsByCollection;
  private readonly capabilitiesCache = new Map<
    string,
    Promise<{ fields: { name: string; type: string; operators: string[] }[] }>
  >();

  constructor(params: { client: RemoteAgentClient; actionEndpoints: ActionEndpointsByCollection }) {
    this.client = params.client;
    this.actionEndpoints = params.actionEndpoints;
  }

  async getRecord(collectionName: string, recordId: string): Promise<RecordData> {
    const records = await this.client.collection(collectionName).list<Record<string, unknown>>({
      filters: { field: 'id', operator: 'Equal', value: recordId },
      pagination: { size: 1, number: 1 },
    });

    if (records.length === 0) {
      throw new RecordNotFoundError(collectionName, recordId);
    }

    const capabilities = await this.getCapabilities(collectionName);

    return {
      recordId,
      collectionName,
      collectionDisplayName: collectionName,
      fields: capabilities.fields.map(toRecordFieldRef),
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

    const capabilities = await this.getCapabilities(collectionName);

    return {
      recordId,
      collectionName,
      collectionDisplayName: collectionName,
      fields: capabilities.fields.map(toRecordFieldRef),
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

    return records.map(record => ({
      recordId: String(record.id ?? ''),
      collectionName: relationName,
      collectionDisplayName: relationName,
      fields: [],
      values: record,
    }));
  }

  async getActions(collectionName: string): Promise<string[]> {
    const endpoints = this.actionEndpoints[collectionName];

    return endpoints ? Object.keys(endpoints) : [];
  }

  async executeAction(
    collectionName: string,
    actionName: string,
    recordIds: string[],
  ): Promise<unknown> {
    const action = await this.client.collection(collectionName).action(actionName, { recordIds });

    return action.execute();
  }

  private getCapabilities(
    collectionName: string,
  ): Promise<{ fields: { name: string; type: string; operators: string[] }[] }> {
    let cached = this.capabilitiesCache.get(collectionName);

    if (!cached) {
      cached = this.client
        .collection(collectionName)
        .capabilities()
        .catch(error => {
          this.capabilitiesCache.delete(collectionName);
          throw error;
        });
      this.capabilitiesCache.set(collectionName, cached);
    }

    return cached;
  }
}
