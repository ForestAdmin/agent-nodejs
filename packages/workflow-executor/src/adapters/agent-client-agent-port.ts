import type {
  AgentPort,
  ExecuteActionQuery,
  GetRecordQuery,
  GetRelatedDataQuery,
  UpdateRecordQuery,
} from '../ports/agent-port';
import type SchemaCache from '../schema-cache';
import type { StepUser } from '../types/execution';
import type { CollectionSchema, RecordData } from '../types/record';
import type { SelectOptions } from '@forestadmin/agent-client';

import { createRemoteAgentClient } from '@forestadmin/agent-client';
import jsonwebtoken from 'jsonwebtoken';

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
  private readonly agentUrl: string;
  private readonly authSecret: string;
  private readonly schemaCache: SchemaCache;

  constructor(params: { agentUrl: string; authSecret: string; schemaCache: SchemaCache }) {
    this.agentUrl = params.agentUrl;
    this.authSecret = params.authSecret;
    this.schemaCache = params.schemaCache;
  }

  async getRecord({ collection, id, fields }: GetRecordQuery, user: StepUser): Promise<RecordData> {
    const client = this.createClient(user);
    const schema = this.resolveSchema(collection);
    const records = await client.collection(collection).list<Record<string, unknown>>({
      filters: buildPkFilter(schema.primaryKeyFields, id),
      pagination: { size: 1, number: 1 },
      ...(fields?.length && { fields }),
    });

    if (records.length === 0) {
      throw new RecordNotFoundError(collection, encodePk(id));
    }

    return { collectionName: collection, recordId: id, values: records[0] };
  }

  async updateRecord(
    { collection, id, values }: UpdateRecordQuery,
    user: StepUser,
  ): Promise<RecordData> {
    const client = this.createClient(user);
    const updatedRecord = await client
      .collection(collection)
      .update<Record<string, unknown>>(encodePk(id), values);

    return { collectionName: collection, recordId: id, values: updatedRecord };
  }

  async getRelatedData(
    { collection, id, relation, limit, fields }: GetRelatedDataQuery,
    user: StepUser,
  ): Promise<RecordData[]> {
    const client = this.createClient(user);
    const relatedSchema = this.resolveSchema(relation);

    const records = await client
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

  async executeAction(
    { collection, action, id }: ExecuteActionQuery,
    user: StepUser,
  ): Promise<unknown> {
    const client = this.createClient(user);
    const encodedId = id?.length ? [encodePk(id)] : [];
    const act = await client.collection(collection).action(action, { recordIds: encodedId });

    return act.execute();
  }

  private createClient(user: StepUser) {
    const token = jsonwebtoken.sign({ ...user }, this.authSecret, { expiresIn: '1h' });

    return createRemoteAgentClient({
      url: this.agentUrl,
      token,
      actionEndpoints: this.buildActionEndpoints(),
    });
  }

  private buildActionEndpoints() {
    const endpoints: Record<string, Record<string, { name: string; endpoint: string }>> = {};

    for (const [collectionName, schema] of this.schemaCache) {
      endpoints[collectionName] = {};

      for (const action of schema.actions) {
        endpoints[collectionName][action.name] = {
          name: action.name,
          endpoint: action.endpoint,
        };
      }
    }

    return endpoints;
  }

  private resolveSchema(collectionName: string): CollectionSchema {
    return (
      this.schemaCache.get(collectionName) ?? {
        collectionName,
        collectionDisplayName: collectionName,
        primaryKeyFields: ['id'],
        fields: [],
        actions: [],
      }
    );
  }
}
