export interface GatewayApiKeyResolveErrorParams {
  status?: number;
  code?: string;
  name?: string;
  retryAfter?: number;
  unreachable?: boolean;
  cause?: unknown;
}

function describeCause(cause: unknown): string {
  if (!(cause instanceof Error)) return String(cause);

  const nested = (cause as { cause?: unknown }).cause;

  return nested ? `${cause.message}: ${describeCause(nested)}` : cause.message;
}

function describe({ status, code, unreachable, cause }: GatewayApiKeyResolveErrorParams): string {
  if (unreachable) return cause ? ` (unreachable: ${describeCause(cause)})` : ' (unreachable)';

  const details = [status && `status ${status}`, code && `code ${code}`].filter(Boolean);

  return details.length ? ` (${details.join(', ')})` : '';
}

export default class GatewayApiKeyResolveError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly saasName?: string;
  readonly retryAfter?: number;
  readonly unreachable: boolean;
  readonly cause?: unknown;

  constructor(params: GatewayApiKeyResolveErrorParams) {
    super(`Gateway API key resolve failed${describe(params)}`);
    this.name = 'GatewayApiKeyResolveError';
    this.status = params.status;
    this.code = params.code;
    this.saasName = params.name;
    this.retryAfter = params.retryAfter;
    this.unreachable = params.unreachable ?? false;
    this.cause = params.cause;
  }
}
