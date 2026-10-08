import type { ConfigLabels } from '../config/env-config';
import type { Logger } from '../ports/logger-port';

import { generateOpenApiDocument, serializeOpenApi } from './openapi-document';
import buildUnfoldedDocument, { issueOpenApiAgentToken } from './unfolded-document';
import { isFullyDegraded } from './unfolding';
import { AI_QUERY_ROUTE } from '../ai/ai-routes-middleware';
import normalizeBasePath from '../base-path';
import { resolveOAuthConfig, resolveUnfoldSource } from '../build-bff';
import { parseConfig, parsePublicUrl } from '../config/env-config';
import { extractErrorMessage } from '../errors';
import version from '../version';

const UNFOLD_VARS = ['FOREST_ENV_SECRET', 'FOREST_AUTH_SECRET', 'AGENT_URL'] as const;

const NOTHING_TO_UNFOLD = `${UNFOLD_VARS.join(', ')} must all be set to unfold it`;

function wantsUnfolding(env: NodeJS.ProcessEnv): boolean {
  return UNFOLD_VARS.every(name => (env[name] ?? '').trim() !== '');
}

function publishesAiQuery(env: NodeJS.ProcessEnv, logger: Logger, labels: ConfigLabels): boolean {
  try {
    return resolveOAuthConfig(parseConfig(env, labels)) !== undefined;
  } catch (error) {
    const reason = extractErrorMessage(error);

    logger(
      'Warn',
      `Omitting ${AI_QUERY_ROUTE} from the document: the configuration could not be read (${reason})`,
    );

    return false;
  }
}

/**
 * Unfolds when the deployment is configured to be inspected, and emits the generic document when it
 * is not configured at all — the command keeps working without configuration. A deployment that IS
 * configured but whose schema cannot be read fails instead of quietly degrading: it asked for the
 * unfolded document, and a generic one would look like a complete answer.
 */
export default async function renderOpenApi(
  env: NodeJS.ProcessEnv,
  logger: Logger,
  options: { basePath?: string; labels?: ConfigLabels } = {},
): Promise<string> {
  const labels = options.labels ?? {};
  const basePath = normalizeBasePath(options.basePath);
  const authSecret = env.FOREST_AUTH_SECRET;

  // `parseConfig` validates the WHOLE server configuration, including settings the export has nothing
  // to do with (HTTP_PORT, the OAuth keys, the default timezone). A deployment that never asked for an
  // unfolded document must not see its export die on one of those, so the config is parsed only once
  // the variables unfolding needs are all present — and from there a bad value is a real failure.
  const unfoldable =
    authSecret && wantsUnfolding(env)
      ? { source: resolveUnfoldSource(parseConfig(env, labels), logger), authSecret }
      : undefined;

  const publicUrl = parsePublicUrl(env.BFF_PUBLIC_URL, labels.BFF_PUBLIC_URL ?? 'BFF_PUBLIC_URL');
  const hasAiQueryRoute = publishesAiQuery(env, logger, labels);

  if (!unfoldable?.source) {
    logger('Warn', `Emitting the generic OpenAPI document: ${NOTHING_TO_UNFOLD}`);

    return `${serializeOpenApi(
      generateOpenApiDocument(version, { hasAiQueryRoute, publicUrl, basePath }),
    )}\n`;
  }

  const { source } = unfoldable;
  const readModel = await source.store.getReadModel();
  const { document, unfolding } = await buildUnfoldedDocument(
    source,
    readModel,
    () => issueOpenApiAgentToken(unfoldable.authSecret),
    { version, hasAiQueryRoute, publicUrl, basePath },
  );

  // Not one collection came back with its field set, so the agent was unreachable throughout. The
  // paths are real but every field schema is free-form, which is not the document this command
  // promises — a CI job regenerating it needs something to branch on, and the degraded notes buried
  // in the descriptions are not it. One odd collection stays a warning, not a failure.
  if (isFullyDegraded(unfolding)) {
    throw new Error(
      'No collection could be described: the agent answered no capabilities call, so every field ' +
        'schema in the document would be free-form. Check AGENT_URL and the agent, then retry.',
    );
  }

  return `${document}\n`;
}
