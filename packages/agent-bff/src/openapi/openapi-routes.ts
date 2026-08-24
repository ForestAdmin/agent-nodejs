import type { UnfoldSource } from './unfolded-document';
import type ReadModel from '../read-model/read-model';
import type { Middleware } from 'koa';

import { generateOpenApiDocument, serializeOpenApi } from './openapi-document';
import buildUnfoldedDocument from './unfolded-document';
import { hasDegradedCollection } from './unfolding';
import { requireAgentToken, resolveReadModel } from '../http/agent-route-helpers';
import { openapiDisabled } from '../http/bff-local-errors';

export const OPENAPI_PATH = '/agent/openapi.json';

const READ_METHODS = new Set(['GET', 'HEAD']);

const MAX_GENERATION_RETRIES = 3;

export interface OpenApiRoutesOptions {
  version: string;
  enabled: boolean;
  hasAiQueryRoute?: boolean;
  /** Absent (no agent or no read-model configuration) serves the generic document. */
  source?: UnfoldSource;
}

export default function createOpenApiRoutes({
  version,
  enabled,
  source,
  hasAiQueryRoute = false,
}: OpenApiRoutesOptions): Middleware {
  const generic =
    enabled && !source
      ? serializeOpenApi(generateOpenApiDocument(version, { hasAiQueryRoute }))
      : undefined;

  // Memoized on the read-model identity: the store builds a new one per schema generation, so the
  // document is rebuilt exactly when the schema it describes changed.
  let unfolded: { readModel: ReadModel; document: string } | undefined;

  async function resolveDocument(
    ctx: Parameters<Middleware>[0],
    attemptsLeft = MAX_GENERATION_RETRIES,
  ): Promise<string> {
    if (!source) return generic as string;

    if (attemptsLeft <= 0) {
      throw new Error('Schema generation kept changing while building the OpenAPI document');
    }

    // Before the schema is even read, so a caller with no agent credentials cannot make the BFF
    // fetch anything: the unfolded document needs a token to ask the agent for capabilities.
    const token = requireAgentToken(ctx);
    const readModel = await resolveReadModel(source.store);

    if (unfolded?.readModel === readModel) return unfolded.document;

    const { document, unfolding } = await buildUnfoldedDocument(
      source,
      readModel,
      token,
      version,
      hasAiQueryRoute,
    );

    // A schema refresh landing during the capabilities fan-out mixes the new generation's field sets
    // into this generation's collections, relations and actions. Such a document must not be served
    // nor cached — a consumer would generate a client from a self-contradictory schema. Bounded like
    // `ReadModelStore.getCapabilities`, and driven by the 24h schema TTL rather than request volume.
    if ((await resolveReadModel(source.store)) !== readModel) {
      return resolveDocument(ctx, attemptsLeft - 1);
    }

    // Only a complete document is memoized. The memo key is the schema generation, which moves on a
    // 24h TTL, so caching a document built while the agent was briefly down would keep serving a
    // field-less spec for a day — and longer still if a later schema refresh fails without bumping
    // the revision. `CapabilitiesCache` deliberately caches successes only; this keeps that true
    // end to end, at the cost of re-running the fan-out until the agent answers again.
    if (!hasDegradedCollection(unfolding)) {
      unfolded = { readModel, document };
    }

    return document;
  }

  return async function openApiRoutes(ctx, next) {
    if (ctx.path !== OPENAPI_PATH || !READ_METHODS.has(ctx.method)) {
      await next();

      return;
    }

    if (!enabled) {
      throw openapiDisabled();
    }

    const document = await resolveDocument(ctx);

    ctx.status = 200;
    ctx.type = 'application/json';
    ctx.set('Cache-Control', 'no-store');
    ctx.body = document;
  };
}
