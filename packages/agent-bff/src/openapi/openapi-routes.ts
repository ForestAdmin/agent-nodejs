import type { UnfoldSource } from './unfolded-document';
import type ReadModel from '../read-model/read-model';
import type { Middleware } from 'koa';

import { generateOpenApiDocument, serializeOpenApi } from './openapi-document';
import buildUnfoldedDocument from './unfolded-document';
import { hasDegradedCollection } from './unfolding';
import { emittedBaseOf } from '../base-path';
import { requireAgentToken, resolveReadModel } from '../http/agent-route-helpers';
import { openapiDisabled } from '../http/bff-local-errors';

export const OPENAPI_PATH = '/agent/openapi.json';

const READ_METHODS = new Set(['GET', 'HEAD']);

const MAX_GENERATION_RETRIES = 3;

export interface OpenApiRoutesOptions {
  version: string;
  enabled: boolean;
  hasAiQueryRoute: boolean;
  /** Prefix the host serves the BFF under, so a generated client targets the right base url. */
  basePath?: string;
  /** Absent (no agent or no read-model configuration) serves the generic document. */
  source?: UnfoldSource;
}

export default function createOpenApiRoutes({
  version,
  enabled,
  source,
  hasAiQueryRoute,
  basePath,
}: OpenApiRoutesOptions): Middleware {
  // Both documents carry the prefix the caller reached the BFF under, which only the request knows,
  // so both are memoized per prefix instead of built once. A deployment has one prefix in practice.
  const generics = new Map<string, string>();

  const genericFor = (base: string): string => {
    const cached = generics.get(base);
    if (cached !== undefined) return cached;

    const document = serializeOpenApi(
      generateOpenApiDocument(version, { hasAiQueryRoute, basePath: base }),
    );
    generics.set(base, document);

    return document;
  };

  // Memoized on the read-model identity: the store builds a new one per schema generation, so the
  // document is rebuilt exactly when the schema it describes changed.
  const unfoldedByBase = new Map<string, { readModel: ReadModel; document: string }>();

  async function resolveDocument(
    ctx: Parameters<Middleware>[0],
    base: string,
    attemptsLeft = MAX_GENERATION_RETRIES,
  ): Promise<string> {
    if (!source) return genericFor(base);

    if (attemptsLeft <= 0) {
      throw new Error('Schema generation kept changing while building the OpenAPI document');
    }

    // Before the schema is even read, so a caller with no agent credentials cannot make the BFF
    // fetch anything: the unfolded document needs a token to ask the agent for capabilities.
    const token = requireAgentToken(ctx);
    const readModel = await resolveReadModel(source.store);

    const memoized = unfoldedByBase.get(base);
    if (memoized?.readModel === readModel) return memoized.document;

    const { document, unfolding } = await buildUnfoldedDocument(source, readModel, token, {
      version,
      hasAiQueryRoute,
      basePath: base,
    });

    // A schema refresh landing during the capabilities fan-out mixes the new generation's field sets
    // into this generation's collections, relations and actions. Such a document must not be served
    // nor cached — a consumer would generate a client from a self-contradictory schema. Bounded like
    // `ReadModelStore.getCapabilities`, and driven by the 24h schema TTL rather than request volume.
    if ((await resolveReadModel(source.store)) !== readModel) {
      return resolveDocument(ctx, base, attemptsLeft - 1);
    }

    // Only a complete document is memoized. The memo key is the schema generation, which moves on a
    // 24h TTL, so caching a document built while the agent was briefly down would keep serving a
    // field-less spec for a day — and longer still if a later schema refresh fails without bumping
    // the revision. `CapabilitiesCache` deliberately caches successes only; this keeps that true
    // end to end, at the cost of re-running the fan-out until the agent answers again.
    if (!hasDegradedCollection(unfolding)) {
      unfoldedByBase.set(base, { readModel, document });
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

    const document = await resolveDocument(ctx, emittedBaseOf(ctx, basePath ?? ''));

    ctx.status = 200;
    ctx.type = 'application/json';
    ctx.set('Cache-Control', 'no-store');
    ctx.body = document;
  };
}
