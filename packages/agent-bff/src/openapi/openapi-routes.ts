import type { Middleware } from 'koa';

import { generateOpenApiDocument, serializeOpenApi } from './openapi-document';
import { BffHttpError } from '../http/bff-http-error';

export const OPENAPI_PATH = '/agent/openapi.json';

const READ_METHODS = new Set(['GET', 'HEAD']);

export interface OpenApiRoutesOptions {
  version: string;
  enabled: boolean;
}

export default function createOpenApiRoutes({
  version,
  enabled,
}: OpenApiRoutesOptions): Middleware {
  const document = enabled ? serializeOpenApi(generateOpenApiDocument(version)) : undefined;

  return async function openApiRoutes(ctx, next) {
    if (ctx.path !== OPENAPI_PATH) {
      await next();

      return;
    }

    if (document === undefined) {
      throw new BffHttpError(404, 'openapi_disabled', 'The OpenAPI document is not served');
    }

    if (!READ_METHODS.has(ctx.method)) {
      await next();

      return;
    }

    ctx.status = 200;
    ctx.type = 'application/json';
    ctx.set('Cache-Control', 'no-store');
    ctx.body = document;
  };
}
