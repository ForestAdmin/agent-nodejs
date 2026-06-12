import type {
  AgentPort,
  ExecuteActionQuery,
  GetActionFormInfoQuery,
  GetRecordQuery,
  GetRelatedDataQuery,
  GetSingleRelatedDataQuery,
  ResolvePolymorphicTypeQuery,
  UpdateRecordQuery,
} from '../ports/agent-port';
import type SchemaCache from '../schema-cache';
import type { StepUser } from '../types/execution-context';
import type { RecordData } from '../types/validated/collection';
import type { ActionEndpointsByCollection } from '@forestadmin/agent-client';

import { HttpRequester, createRemoteAgentClient } from '@forestadmin/agent-client';
import jsonwebtoken from 'jsonwebtoken';

import {
  AgentPortError,
  AgentProbeError,
  RecordNotFoundError,
  WorkflowExecutorError,
  extractErrorMessage,
} from '../errors';

function toCamelCase(name: string): string {
  return name.replace(/_([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());
}

// The agent-client HTTP layer deserializes JSON:API responses with camelCase keys.
// Field names in the schema and in GetRecordQuery.fields use the original format (e.g. snake_case).
// This function restores the original field names so callers can look up values by schema fieldName.
function restoreFieldNames(
  values: Record<string, unknown>,
  originalFieldNames: string[] | undefined,
): Record<string, unknown> {
  if (!originalFieldNames?.length) return values;

  const camelToOriginal: Record<string, string> = {};

  for (const name of originalFieldNames) {
    camelToOriginal[toCamelCase(name)] = name;
  }

  return Object.fromEntries(Object.entries(values).map(([k, v]) => [camelToOriginal[k] ?? k, v]));
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
      // Fetch by id through the agent's by-id route (like update/delete): the recordId is an
      // opaque ordered token and the agent — the only party that knows the primary key column
      // order — does the matching. No primaryKeyFields ordering assumption here.
      let record: Record<string, unknown> | null;

      try {
        record = await client
          .collection(collection)
          .getOne<Record<string, unknown>>(id, { ...(fields?.length && { fields }) });
      } catch (error) {
        if (HttpRequester.is404Error(error)) {
          throw new RecordNotFoundError(collection, id);
        }

        throw error;
      }

      // Some agents answer a missing composite-key record with a 200 + empty body instead of 404.
      if (!record || Object.keys(record).length === 0) {
        throw new RecordNotFoundError(collection, id);
      }

      return {
        collectionName: collection,
        recordId: id,
        values: restoreFieldNames(record, fields),
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

  async getRelatedData(
    { collection, id, relation, relatedSchema, limit, fields }: GetRelatedDataQuery,
    user: StepUser,
  ): Promise<RecordData[]> {
    return this.callAgent('getRelatedData', async () => {
      const client = this.createClient(user);
      const rows = await client
        .collection(collection)
        .relation(relation, id)
        .list<Record<string, unknown>>({
          ...(limit !== null && { pagination: { size: limit, number: 1 } }),
          ...(fields?.length && { fields }),
        });

      return rows.map(row => {
        const restored = restoreFieldNames(
          row,
          relatedSchema.fields.map(f => f.fieldName),
        );

        // For composite PKs, rebuilding the id from primaryKeyFields assumes the schema's
        // (alphabetical) order matches the agent's column order — it may not, which would
        // mis-pair the key. Use the agent's opaque record id (pipe-joined when composite),
        // like getSingleRelatedData, so it round-trips through the by-id route.
        const recordId =
          relatedSchema.primaryKeyFields.length > 1
            ? String(row.id).split('|')
            : relatedSchema.primaryKeyFields.map(f => restored[f] as string | number);

        return {
          collectionName: relatedSchema.collectionName,
          recordId,
          values: restored,
        };
      });
    });
  }

  // xToOne relations have no /relationships/<relation> route on the agent. We read the
  // parent record with a `<relation>@@@<field>` projection and unpack the relation linkage
  // jsonapi-serializer emits as a nested object on the parent (with the related PK packed
  // under "id" when composite).
  async getSingleRelatedData(
    { collection, id, relation, relatedSchema, fields }: GetSingleRelatedDataQuery,
    user: StepUser,
  ): Promise<RecordData | null> {
    return this.callAgent('getSingleRelatedData', async () => {
      // The agent can't parse multiple sub-fields on one relation in a single projection
      // (`fields[store]=id,name` is read as a single field name → ValidationError). The linkage
      // `id` carries the (packed) related PK regardless of projection, so project at most ONE
      // field: the requested reference field for display, else a single PK field just to pull the
      // relation into the response.
      const projectedField = fields?.[0] ?? relatedSchema.primaryKeyFields[0];
      const parent = await this.getRecord(
        {
          collection,
          id,
          fields: [`${relation}@@@${projectedField}`],
        },
        user,
      );

      // agent-client camelCases relation keys; look the linkage up under the camelCased name.
      const linkage = parent.values[toCamelCase(relation)] as
        | Record<string, unknown>
        | null
        | undefined;
      const packedId = linkage?.id as string | undefined;

      if (!linkage || !packedId) return null;

      const restored = restoreFieldNames(linkage, [projectedField]);

      return {
        collectionName: relatedSchema.collectionName,
        recordId: packedId.split('|'),
        values: restored,
      };
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

  private mintToken(user: StepUser): string {
    // snake_case aliases: Ruby/Python agents splat JWT claims into Caller.new (snake_case kwargs).
    return jsonwebtoken.sign(
      {
        ...user,
        first_name: user.firstName,
        last_name: user.lastName,
        rendering_id: user.renderingId,
        permission_level: user.permissionLevel,
        scope: 'step-execution',
      },
      this.authSecret,
      { expiresIn: '5m' },
    );
  }

  private createClient(user: StepUser) {
    return createRemoteAgentClient({
      url: this.agentUrl,
      token: this.mintToken(user),
      actionEndpoints: this.buildActionEndpoints(user.renderingId),
    });
  }

  // Resolves a polymorphic relation's target from the raw JSON:API linkage. The deserializer drops
  // relationship `type`, so we read the raw body (getOne `raw`) via a `<relation>@@@id` projection
  // and extract the linkage here — agent-client stays generic (URL/auth/serialization).
  async resolvePolymorphicType(
    { collection, id, relation }: ResolvePolymorphicTypeQuery,
    user: StepUser,
  ): Promise<{ type: string; id: string } | null> {
    return this.callAgent('resolvePolymorphicType', async () => {
      const body = await this.createClient(user)
        .collection(collection)
        .getOne<{
          data?: {
            relationships?: Record<string, { data?: { type?: string; id?: string } | null }>;
          };
        }>(id, { fields: [`${relation}@@@id`] }, { skipDeserialization: true });

      const linkage = body?.data?.relationships?.[relation]?.data;

      return linkage?.type ? { type: String(linkage.type), id: String(linkage.id) } : null;
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

  private buildActionEndpoints(renderingId: number): ActionEndpointsByCollection {
    const endpoints: ActionEndpointsByCollection = {};

    for (const [collectionName, schema] of this.schemaCache.entriesForRendering(renderingId)) {
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
}
