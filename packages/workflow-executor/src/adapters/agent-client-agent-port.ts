import type {
  AgentPort,
  ExecuteActionQuery,
  GetActionFormInfoQuery,
  GetRecordQuery,
  GetRelatedDataQuery,
  UpdateRecordQuery,
} from '../ports/agent-port';
import type SchemaCache from '../schema-cache';
import type { StepUser } from '../types/execution-context';
import type { CollectionSchema, RecordData } from '../types/validated/collection';
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

// The agent-client HTTP layer deserializes JSON:API responses with camelCase keys.
// Field names in the schema and in GetRecordQuery.fields use the original format (e.g. snake_case).
// This function restores the original field names so callers can look up values by schema fieldName.
export function restoreFieldNames(
  values: Record<string, unknown>,
  originalFieldNames: string[] | undefined,
): Record<string, unknown> {
  if (!originalFieldNames?.length) return values;

  const camelToOriginal: Record<string, string> = {};

  for (const name of originalFieldNames) {
    const camelName = name.replace(/_([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());
    camelToOriginal[camelName] = name;
  }

  return Object.fromEntries(Object.entries(values).map(([k, v]) => [camelToOriginal[k] ?? k, v]));
}

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
        throw new RecordNotFoundError(collection, id.join('|'));
      }

      return {
        collectionName: collection,
        recordId: id,
        values: restoreFieldNames(records[0], fields),
      };
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
        .update<Record<string, unknown>>(id, values);

      return {
        collectionName: collection,
        recordId: id,
        values: restoreFieldNames(updatedRecord, Object.keys(values)),
      };
    });
  }

  // Returns raw rows as deserialized by agent-client (camelCase keys, no PK extraction).
  // The caller resolves the related collection's schema and maps rows → RecordData; keeping
  // schema-aware mapping out of the port avoids the silent fallback when the related
  // collection isn't in the cache.
  async getRelatedData(
    { collection, id, relation, limit, fields }: GetRelatedDataQuery,
    user: StepUser,
  ): Promise<Record<string, unknown>[]> {
    return this.callAgent('getRelatedData', async () => {
      const client = this.createClient(user);

      return client
        .collection(collection)
        .relation(relation, id)
        .list<Record<string, unknown>>({
          ...(limit !== null && { pagination: { size: limit, number: 1 } }),
          ...(fields?.length && { fields }),
        });
    });
  }

  async executeAction(
    { collection, action, id }: ExecuteActionQuery,
    user: StepUser,
  ): Promise<unknown> {
    return this.callAgent('executeAction', async () => {
      const client = this.createClient(user);
      const recordIds = id?.length ? [id] : [];
      const act = await client.collection(collection).action(action, { recordIds });

      return act.execute();
    });
  }

  async getActionFormInfo(
    { collection, action, id }: GetActionFormInfoQuery,
    user: StepUser,
  ): Promise<{ hasForm: boolean }> {
    return this.callAgent('getActionFormInfo', async () => {
      const client = this.createClient(user);
      const act = await client.collection(collection).action(action, { recordIds: [id] });

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
    const cached = this.schemaCache.get(collectionName);

    if (!cached) {
      // eslint-disable-next-line no-console
      console.warn(
        `[workflow-executor] Schema not found in cache for collection "${collectionName}". ` +
          'Falling back to primaryKeyFields: ["id"]. Call getCollectionSchema first.',
      );
    }

    return (
      cached ?? {
        collectionName,
        collectionDisplayName: collectionName,
        primaryKeyFields: ['id'],
        fields: [],
        actions: [],
      }
    );
  }
}
