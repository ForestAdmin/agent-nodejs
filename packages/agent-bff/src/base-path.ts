import { ConfigurationError } from './errors';

const SHAPE = /^(\/[A-Za-z0-9_-]+)+$/;

/**
 * The prefix is interpolated raw into everything the BFF emits — the docs page's absolute paths and
 * the OpenAPI `servers` entry — so it is normalized once, here, before anything reads it. The two
 * inputs that hurt are the ones that still look right:
 *
 * - `'/'` would emit `//agent/openapi.json`, an RFC 3986 network-path reference: a browser resolves
 *   `agent` as a HOST, so the page loads neither its document nor its bundle.
 * - `'bff'` would emit a RELATIVE `servers` url, which a generator resolves against wherever it read
 *   the document from rather than against the origin — the page and the generated client then
 *   disagree silently.
 *
 * Anything that is not a plain path prefix is rejected rather than repaired: the value comes from the
 * embedding host, usually an environment variable, and a mount the host does not serve is a
 * misconfiguration to report, not a url to publish.
 */
export default function normalizeBasePath(input?: string): string {
  if (!input) return '';

  const trimmed = input.trim();

  if (trimmed === '' || trimmed === '/') return '';

  const collapsed = `/${trimmed}`.replace(/\/+/g, '/').replace(/\/+$/, '');

  if (!SHAPE.test(collapsed)) {
    throw new ConfigurationError(
      `Invalid BFF base path "${input}": use a plain path prefix like "/bff" ` +
        `(letters, digits, "-" and "_" only).`,
    );
  }

  return collapsed;
}
