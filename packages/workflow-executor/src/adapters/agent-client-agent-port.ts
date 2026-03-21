import type { AgentPort, Id, Limit, QueryBase } from '../ports/agent-port';
import type { CollectionSchema } from '../types/record';
import type { RemoteAgentClient, SelectOptions } from '@forestadmin/agent-client';

import { RecordNotFoundError } from '../errors';

function buildPkFilter(
  primaryKeyFields: string[],
  ids: Array<string | number>,
): SelectOptions['filters'] {
  if (primaryKeyFields.length === 1) {
    return { field: primaryKeyFields[0], operator: 'Equal', value: ids[0] };
  }

  return {
    aggregator: 'And',
    conditions: primaryKeyFields.map((field, i) => ({
      field,
      operator: 'Equal',
      value: ids[i],
    })),
  };
}

// agent-client methods (update, relation, action) still expect the pipe-encoded string format
function encodePk(ids: Array<string | number>): string {
  return ids.map(v => String(v)).join('|');
}

function extractRecordId(
  primaryKeyFields: string[],
  record: Record<string, unknown>,
): Array<string | number> {
  return primaryKeyFields.map(field => record[field] as string | number);
}

export default class AgentClientAgentPort implements AgentPort {
  private readonly client: RemoteAgentClient;
  private readonly collectionSchemas: Record<string, CollectionSchema>;

  constructor(params: {
    client: RemoteAgentClient;
    collectionSchemas: Record<string, CollectionSchema>;
  }) {
    this.client = params.client;
    this.collectionSchemas = params.collectionSchemas;
  }

  async getRecord({ collection, ids, fields }: QueryBase) {
    const schema = this.resolveSchema(collection);
    const records = await this.client.collection(collection).list<Record<string, unknown>>({
      filters: buildPkFilter(schema.primaryKeyFields, ids),
      pagination: { size: 1, number: 1 },
      ...(fields?.length && { fields }),
    });

    if (records.length === 0) {
      throw new RecordNotFoundError(collection, encodePk(ids));
    }

    return { collectionName: collection, recordId: ids, values: records[0] };
  }

  async updateRecord({ collection, ids, values }: QueryBase & { values: Record<string, unknown> }) {
    const updatedRecord = await this.client
      .collection(collection)
      .update<Record<string, unknown>>(encodePk(ids), values);

    return { collectionName: collection, recordId: ids, values: updatedRecord };
  }

  async getRelatedData({
    collection,
    ids,
    relation,
    limit,
    fields,
  }: QueryBase & { relation: string } & Limit) {
    const relatedSchema = this.resolveSchema(relation);

    const records = await this.client
      .collection(collection)
      .relation(relation, encodePk(ids))
      .list<Record<string, unknown>>({
        ...(limit !== null && { pagination: { size: limit, number: 1 } }),
        ...(fields?.length && { fields }),
      });

    return records.map(record => ({
      collectionName: relatedSchema.collectionName,
      recordId: extractRecordId(relatedSchema.primaryKeyFields, record),
      values: record,
    }));
  }

  async executeAction({
    collection,
    action,
    ids,
  }: {
    collection: string;
    action: string;
    ids?: Id[];
  }): Promise<unknown> {
    const encodedIds = ids?.length ? [encodePk(ids)] : [];
    const act = await this.client.collection(collection).action(action, { recordIds: encodedIds });

    return act.execute();
  }

  private resolveSchema(collectionName: string): CollectionSchema {
    const schema = this.collectionSchemas[collectionName];

    if (!schema) {
      return {
        collectionName,
        collectionDisplayName: collectionName,
        primaryKeyFields: ['id'],
        fields: [],
        actions: [],
      };
    }

    return schema;
  }
}
