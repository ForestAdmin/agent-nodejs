// Classifies errors surfaced while connecting to or calling an MCP server. The MCP SDK / HTTP
// transport reports failures in several shapes (a numeric status field, or only a message string),
// so the checks walk the cause chain and inspect both structured status and the message text.
const AUTH_STATUSES = new Set([401, 403]);
const AUTH_PATTERN = /\b40[13]\b|unauthorized|forbidden/i;
const CONNECTION_PATTERN =
  /econnrefused|econnreset|etimedout|enotfound|eai_again|fetch failed|network|socket|timeout|connect/i;

export type McpLoadFailureKind = 'auth' | 'connection' | 'unknown';

function statusOf(value: unknown): number | undefined {
  const candidate = value as { code?: unknown; status?: unknown; statusCode?: unknown };

  for (const field of [candidate?.code, candidate?.status, candidate?.statusCode]) {
    if (typeof field === 'number') return field;
  }

  return undefined;
}

function messageOf(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;

  return '';
}

function errorChain(error: unknown): unknown[] {
  const links: unknown[] = [];
  let current: unknown = error;

  while (current && links.length < 10 && !links.includes(current)) {
    links.push(current);
    current = (current as { cause?: unknown }).cause;
  }

  return links;
}

export function isMcpAuthError(error: unknown): boolean {
  return errorChain(error).some(link => {
    const status = statusOf(link);

    return (
      (status !== undefined && AUTH_STATUSES.has(status)) || AUTH_PATTERN.test(messageOf(link))
    );
  });
}

export function classifyMcpLoadError(error: unknown): McpLoadFailureKind {
  if (isMcpAuthError(error)) return 'auth';

  const isConnectionFailure = errorChain(error).some(link =>
    CONNECTION_PATTERN.test(messageOf(link)),
  );

  return isConnectionFailure ? 'connection' : 'unknown';
}
