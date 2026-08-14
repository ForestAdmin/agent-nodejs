import type { Logger } from '../ports/logger-port';
import type { Middleware } from 'koa';

import { existsSync, readFileSync } from 'fs';
import path from 'path';

import renderDocsPage from './docs-page';

export const DOCS_PATH = '/docs';
export const DOCS_BUNDLE_PATH = '/docs/redoc.standalone.js';

const BUNDLE_FILE = 'redoc.standalone.js';
const READ_METHODS = new Set(['GET', 'HEAD']);

export interface DocsRoutesOptions {
  enabled: boolean;
  /** Where the shell fetches the document. Passed in so this module never reaches into `src/openapi`. */
  documentPath: string;
  logger: Logger;
}

/**
 * The bundle is copied next to this module at build time (`build:copy`), which is what a published
 * install serves. Running from `src` — tests, `build:watch` — there is nothing to copy to, so the
 * `redoc` devDependency is resolved instead: the same file, from the package that pins its version.
 */
function resolveBundle(): string | undefined {
  const copied = path.join(__dirname, BUNDLE_FILE);

  if (existsSync(copied)) return copied;

  try {
    return require.resolve(`redoc/bundles/${BUNDLE_FILE}`);
  } catch {
    return undefined;
  }
}

/**
 * Serves the Redoc viewer OUTSIDE `/agent`, deliberately: the agent prefix answers 401 to a request
 * with no credential (`auth-mode.ts`), and a browser navigating to a page sends none. Both routes are
 * public, and both are inert — the shell carries no schema and the bundle is a third-party asset.
 * The document itself stays gated.
 *
 * Disabled, or unable to find its bundle, the middleware falls through rather than throwing: `/docs`
 * is not covered by the agent-scoped error middleware, so a thrown error would surface as a bare 500
 * instead of the BFF error contract. A 404 also keeps a disabled deployment from advertising a page
 * it does not serve.
 */
export default function createDocsRoutes({
  enabled,
  documentPath,
  logger,
}: DocsRoutesOptions): Middleware {
  const bundle = enabled ? resolveBundle() : undefined;

  if (enabled && !bundle) {
    logger('Warn', `API documentation page disabled: ${BUNDLE_FILE} is missing from this install`);
  }

  const page = bundle ? renderDocsPage(documentPath, DOCS_BUNDLE_PATH) : undefined;
  let script: string | undefined;

  return async function docsRoutes(ctx, next) {
    const isDocsPath = ctx.path === DOCS_PATH || ctx.path === DOCS_BUNDLE_PATH;

    if (!bundle || !isDocsPath || !READ_METHODS.has(ctx.method)) {
      await next();

      return;
    }

    if (ctx.path === DOCS_BUNDLE_PATH) {
      // Read once and kept in memory: ~1 MB, served on every page load.
      if (script === undefined) script = readFileSync(bundle, 'utf8');

      ctx.status = 200;
      ctx.type = 'application/javascript';
      ctx.set('Cache-Control', 'public, max-age=3600');
      ctx.body = script;

      return;
    }

    ctx.status = 200;
    ctx.type = 'text/html';
    ctx.set('Cache-Control', 'no-store');
    ctx.body = page;
  };
}
