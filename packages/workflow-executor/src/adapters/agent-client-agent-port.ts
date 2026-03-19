import type { AgentPort } from '../ports/agent-port';
import type { CollectionSchema } from '../types/record';
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
  private readonly collectionSchemas: Record<string, CollectionSchema>;

  constructor(params: {
    client: RemoteAgentClient;
    collectionSchemas: Record<string, CollectionSchema>;
  }) {
    this.client = params.client;
    this.collectionSchemas = params.collectionSchemas;
  }

  async getRecord(collectionName: string, recordId: Array<string | number>, fieldNames?: string[]) {
    const schema = this.resolveSchema(collectionName);
    const records = await this.client.collection(collectionName).list<Record<string, unknown>>({
      filters: buildPkFilter(schema.primaryKeyFields, recordId),
      pagination: { size: 1, number: 1 },
      ...(fieldNames?.length && { fields: fieldNames }),
    });

    if (records.length === 0) {
      throw new RecordNotFoundError(collectionName, encodePk(recordId));
    }

    return { collectionName, recordId, values: records[0] };
  }

  async updateRecord(
    collectionName: string,
    recordId: Array<string | number>,
    values: Record<string, unknown>,
  ) {
    const updatedRecord = await this.client
      .collection(collectionName)
      .update<Record<string, unknown>>(encodePk(recordId), values);

    return { collectionName, recordId, values: updatedRecord };
  }

  async getRelatedData(
    collectionName: string,
    recordId: Array<string | number>,
    relationName: string,
  ) {
    const relatedSchema = this.resolveSchema(relationName);

    const records = await this.client
      .collection(collectionName)
      .relation(relationName, encodePk(recordId))
      .list<Record<string, unknown>>();

    return records.map(record => ({
      collectionName: relatedSchema.collectionName,
      recordId: extractRecordId(relatedSchema.primaryKeyFields, record),
      values: record,
    }));
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
