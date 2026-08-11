import type { Middleware } from 'koa';

import { generateOpenApiDocument, serializeOpenApi } from './openapi-document';

export const OPENAPI_PATH = '/agent/openapi.json';

const READ_METHODS = new Set(['GET', 'HEAD']);

export interface OpenApiRoutesOptions {
  version: string;
}

export default function createOpenApiRoutes({ version }: OpenApiRoutesOptions): Middleware {
  const document = serializeOpenApi(generateOpenApiDocument(version));

  return async function openApiRoutes(ctx, next) {
    if (!READ_METHODS.has(ctx.method) || ctx.path !== OPENAPI_PATH) {
      await next();

      return;
    }

    ctx.status = 200;
    ctx.type = 'application/json';
    ctx.set('Cache-Control', 'no-store');
    ctx.body = document;
  };
}
