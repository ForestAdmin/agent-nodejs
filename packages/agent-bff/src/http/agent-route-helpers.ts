import type { Logger } from '../ports/logger-port';
import type ReadModel from '../read-model/read-model';
import type ReadModelStore from '../read-model/read-model-store';
import type { Context } from 'koa';

import { mapAgentError } from './agent-error-mapper';
import { unauthorized } from './bff-http-error';
import { invalidRequest, schemaUnavailable } from './bff-local-errors';
import SchemaUnavailableError from '../read-model/errors';

export function decodeSegment(raw: string, label: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    throw invalidRequest(`Malformed ${label} in path`);
  }
}

export async function resolveReadModel(store: ReadModelStore): Promise<ReadModel> {
  try {
    return await store.getReadModel();
  } catch (error) {
    if (error instanceof SchemaUnavailableError) throw schemaUnavailable();
    throw error;
  }
}

// The agent token is minted only on the API-key path; the OAuth path sets a principal but no agent
// token yet. Fail closed instead of calling the agent with `Bearer undefined`.
// TODO(PRD-637): mint an agent token from the OAuth principal so agent routes work in OAuth mode.
export function requireAgentToken(ctx: Context): string {
  const token = ctx.state.agentToken as string | undefined;
  if (!token) throw unauthorized('No agent credentials for this request');

  return token;
}

// Only the agent call is wrapped: guard, query-building and mapping errors are BFF-origin and must
// keep their own type, not be recategorized as agent errors.
export async function callAgent<T>(fn: () => Promise<T>, logger: Logger): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw mapAgentError(error, { logger });
  }
}
