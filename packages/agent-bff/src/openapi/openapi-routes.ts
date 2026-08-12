import type { UnfoldSource } from './unfolded-document';
import type ReadModel from '../read-model/read-model';
import type { Middleware } from 'koa';

import { generateOpenApiDocument, serializeOpenApi } from './openapi-document';
import buildUnfoldedDocument from './unfolded-document';
import { requireAgentToken, resolveReadModel } from '../http/agent-route-helpers';
import { openapiDisabled } from '../http/bff-local-errors';

export const OPENAPI_PATH = '/agent/openapi.json';

const READ_METHODS = new Set(['GET', 'HEAD']);

export interface OpenApiRoutesOptions {
  version: string;
  enabled: boolean;
  /** Absent (no agent or no read-model configuration) serves the generic document. */
  source?: UnfoldSource;
}

export default function createOpenApiRoutes({
  version,
  enabled,
  source,
}: OpenApiRoutesOptions): Middleware {
  const generic =
    enabled && !source ? serializeOpenApi(generateOpenApiDocument(version)) : undefined;

  // Memoized on the read-model identity: the store builds a new one per schema generation, so the
  // document is rebuilt exactly when the schema it describes changed.
  let unfolded: { readModel: ReadModel; document: string } | undefined;

  async function resolveDocument(ctx: Parameters<Middleware>[0]): Promise<string> {
    if (!source) return generic as string;

    // Before the schema is even read, so a caller with no agent credentials cannot make the BFF
    // fetch anything: the unfolded document needs a token to ask the agent for capabilities.
    const token = requireAgentToken(ctx);
    const readModel = await resolveReadModel(source.store);

    if (unfolded?.readModel !== readModel) {
      unfolded = {
        readModel,
        document: await buildUnfoldedDocument(source, readModel, token, version),
      };
    }

    return unfolded.document;
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
