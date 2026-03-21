import type {
  AgentPort,
  ExecuteActionQuery,
  GetRecordQuery,
  GetRelatedDataQuery,
  Id,
  UpdateRecordQuery,
} from '../ports/agent-port';
import type { CollectionSchema } from '../types/record';
import type { RemoteAgentClient, SelectOptions } from '@forestadmin/agent-client';

import { RecordNotFoundError } from '../errors';

function buildPkFilter(
  primaryKeyFields: string[],
  id: Array<string | number>,
): SelectOptions['filters'] {
  if (primaryKeyFields.length === 1) {
    return { field: primaryKeyFields[0], operator: 'Equal', value: id[0] };
  }

  return {
    aggregator: 'And',
    conditions: primaryKeyFields.map((field, i) => ({
      field,
      operator: 'Equal',
      value: id[i],
    })),
  };
}

// agent-client methods (update, relation, action) still expect the pipe-encoded string format
function encodePk(id: Array<string | number>): string {
  return id.map(v => String(v)).join('|');
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

  async getRecord({ collection, id, fields }: GetRecordQuery) {
    const schema = this.resolveSchema(collection);
    const records = await this.client.collection(collection).list<Record<string, unknown>>({
      filters: buildPkFilter(schema.primaryKeyFields, id),
      pagination: { size: 1, number: 1 },
      ...(fields?.length && { fields }),
    });

    if (records.length === 0) {
      throw new RecordNotFoundError(collection, encodePk(id));
    }

    return { collectionName: collection, recordId: id, values: records[0] };
  }

  async updateRecord({ collection, id, values }: UpdateRecordQuery) {
    const updatedRecord = await this.client
      .collection(collection)
      .update<Record<string, unknown>>(encodePk(id), values);

    return { collectionName: collection, recordId: id, values: updatedRecord };
  }

  async getRelatedData({
    collection,
    id,
    relation,
    limit,
    fields,
  }: GetRelatedDataQuery) {
    const relatedSchema = this.resolveSchema(relation);

    const records = await this.client
      .collection(collection)
      .relation(relation, encodePk(id))
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

  async executeAction({ collection, action, id }: ExecuteActionQuery): Promise<unknown> {
    const encodedId = id?.length ? [encodePk(id)] : [];
    const act = await this.client.collection(collection).action(action, { recordIds: encodedId });

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
