import type { SemanticLayerDescription } from '../http-client';
import type { Logger } from '../server';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

export const UNREACHABLE = Symbol('unreachable');

type Caller = { forestServerToken: string; environmentId: number };

// Only the semantic layer's own 404 means "out of the caller's role": a 404 from a server that
// does not know the route yet must not hide the collection.
function isElementNotFound(error: unknown): boolean {
  const { status, message } = error as { status?: number; message?: string };

  return status === 404 && message === 'Element not found';
}

/**
 * Descriptions are optional to every tool: when Forest cannot answer, the tool answers without
 * them (resolves undefined), and only the element being out of the caller's role is reported.
 */
export async function readSemanticLayer<T>(
  request: RequestHandlerExtra<ServerRequest, ServerNotification>,
  logger: Logger,
  read: (caller: Caller) => Promise<T>,
): Promise<T | typeof UNREACHABLE | undefined> {
  const { forestServerToken, environmentId } = request.authInfo?.extra ?? {};

  if (typeof forestServerToken !== 'string' || typeof environmentId !== 'number') {
    logger('Warn', 'Forest descriptions skipped: the environment of this MCP server is unknown');

    return undefined;
  }

  try {
    return await read({ forestServerToken, environmentId });
  } catch (error) {
    if (isElementNotFound(error)) return UNREACHABLE;

    logger('Warn', `Forest descriptions unavailable for environment ${environmentId}: ${error}`);

    return undefined;
  }
}

export function withDescription(text: string | null | undefined): { description?: string } {
  return text ? { description: text } : {};
}

// Once Forest holds a version, even a removal, the code description never comes back.
export function actionDescriptionText(
  forest: SemanticLayerDescription,
  codeDescription: string | undefined,
): string | undefined {
  return forest.hasVersion ? forest.text ?? undefined : codeDescription;
}
