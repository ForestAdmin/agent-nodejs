import type {
  AgentPort,
  ExecuteActionQuery,
  GetActionFormInfoQuery,
  GetRecordQuery,
  GetRelatedDataQuery,
  UpdateRecordQuery,
} from '../ports/agent-port';
import type SchemaCache from '../schema-cache';
import type { StepUser } from '../types/execution';
import type { CollectionSchema, RecordData } from '../types/record';
import type { ActionEndpointsByCollection, SelectOptions } from '@forestadmin/agent-client';

import { createRemoteAgentClient } from '@forestadmin/agent-client';
import jsonwebtoken from 'jsonwebtoken';

import {
  AgentPortError,
  AgentProbeError,
  RecordNotFoundError,
  WorkflowExecutorError,
  extractErrorMessage,
} from '../errors';

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
    return this.callAgent('getRecord', async () => {
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
    });
  }

  async updateRecord(
    { collection, id, values }: UpdateRecordQuery,
    user: StepUser,
  ): Promise<RecordData> {
    return this.callAgent('updateRecord', async () => {
      const client = this.createClient(user);
      const updatedRecord = await client
        .collection(collection)
        .update<Record<string, unknown>>(encodePk(id), values);

      return { collectionName: collection, recordId: id, values: updatedRecord };
    });
  }

  async getRelatedData(
    { collection, id, relation, limit, fields }: GetRelatedDataQuery,
    user: StepUser,
  ): Promise<RecordData[]> {
    return this.callAgent('getRelatedData', async () => {
      const client = this.createClient(user);
      const parentSchema = this.resolveSchema(collection);
      const relationField = parentSchema.fields.find(f => f.fieldName === relation);
      const relatedCollectionName = relationField?.relatedCollectionName ?? relation;
      const relatedSchema = this.resolveSchema(relatedCollectionName);

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
    });
  }

  async executeAction(
    { collection, action, id }: ExecuteActionQuery,
    user: StepUser,
  ): Promise<unknown> {
    return this.callAgent('executeAction', async () => {
      const client = this.createClient(user);
      const encodedId = id?.length ? [encodePk(id)] : [];
      const act = await client.collection(collection).action(action, { recordIds: encodedId });

      return act.execute();
    });
  }

  async getActionFormInfo(
    { collection, action, id }: GetActionFormInfoQuery,
    user: StepUser,
  ): Promise<{ hasForm: boolean }> {
    return this.callAgent('getActionFormInfo', async () => {
      const client = this.createClient(user);
      const act = await client.collection(collection).action(action, { recordIds: [encodePk(id)] });

      return { hasForm: act.getFields().length > 0 };
    });
  }

  private async callAgent<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (cause) {
      if (cause instanceof WorkflowExecutorError) throw cause;
      throw new AgentPortError(operation, cause);
    }
  }

  private createClient(user: StepUser) {
    const token = jsonwebtoken.sign({ ...user, scope: 'step-execution' }, this.authSecret, {
      expiresIn: '5m',
    });

    return createRemoteAgentClient({
      url: this.agentUrl,
      token,
      actionEndpoints: this.buildActionEndpoints(),
    });
  }

  // Hits GET /forest/ (public, no auth required across all agent versions). A 4xx here means
  // the URL points to something that isn't a Forest agent. JWT is validated naturally on first step.
  async probe(): Promise<void> {
    const url = `${this.agentUrl.replace(/\/+$/, '')}/forest/`;

    let response: Response;

    try {
      response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5_000) });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'TimeoutError';
      const reason = isTimeout ? 'timeout after 5000ms' : extractErrorMessage(error);
      throw new AgentProbeError(`cannot reach ${this.agentUrl} (${reason})`, { cause: error });
    }

    if (!response.ok) {
      throw new AgentProbeError(
        `${this.agentUrl} responded with ${response.status} ${response.statusText}`,
      );
    }
  }

  private buildActionEndpoints(): ActionEndpointsByCollection {
    const endpoints: ActionEndpointsByCollection = {};

    for (const [collectionName, schema] of this.schemaCache) {
      endpoints[collectionName] = {};

      for (const action of schema.actions) {
        // agent-client POSTs /hooks/load unconditionally; `hooks.load` tells it whether a 404
        // there is expected (Ruby agent, swallowed → fallback to the static `fields` below) or
        // a real error. Both `hooks` and `fields` must mirror the agent's real schema for form
        // detection to work on Ruby agents.
        endpoints[collectionName][action.name] = {
          id: action.name,
          name: action.name,
          endpoint: action.endpoint,
          hooks: action.hooks ?? { load: false, change: [] },
          // Zod envelope-validates `fields` as an array of opaque objects. Inner widget/parameters
          // shape is owned by @forestadmin/forestadmin-client and consumed by agent-client below.
          fields: (action.fields ?? []) as ActionEndpointsByCollection[string][string]['fields'],
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
