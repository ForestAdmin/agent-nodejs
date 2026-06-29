// Classifies errors surfaced while connecting to or calling an MCP server. Only 401 (the token was
// rejected) is a refreshable auth failure; 403 is a permission/scope problem a token refresh or
// re-consent cannot resolve, so it is left to surface as an ordinary failure. The MCP SDK / HTTP
// transport reports failures in several shapes (a numeric status field, or only a message string),
// so the checks walk the cause chain and inspect both structured status and the message text.
const AUTH_STATUSES = new Set([401]);
const AUTH_PATTERN = /\b401\b|unauthorized/i;
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
    // An explicit status is authoritative — a 403 is not a refreshable auth error even if its
    // message says "unauthorized". Fall back to the message only when no status is present.
    if (status !== undefined) return AUTH_STATUSES.has(status);

    return AUTH_PATTERN.test(messageOf(link));
  });
}

export function classifyMcpLoadError(error: unknown): McpLoadFailureKind {
  if (isMcpAuthError(error)) return 'auth';

  const isConnectionFailure = errorChain(error).some(link =>
    CONNECTION_PATTERN.test(messageOf(link)),
  );

  return isConnectionFailure ? 'connection' : 'unknown';
}
