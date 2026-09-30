export interface GatewayApiKeyResolveErrorParams {
  status?: number;
  code?: string;
  name?: string;
  retryAfter?: number;
  unreachable?: boolean;
}

export default class GatewayApiKeyResolveError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly saasName?: string;
  readonly retryAfter?: number;
  readonly unreachable: boolean;

  constructor(params: GatewayApiKeyResolveErrorParams) {
    super(`Gateway API key resolve failed${params.status ? ` (${params.status})` : ''}`);
    this.name = 'GatewayApiKeyResolveError';
    this.status = params.status;
    this.code = params.code;
    this.saasName = params.name;
    this.retryAfter = params.retryAfter;
    this.unreachable = params.unreachable ?? false;
  }
}
