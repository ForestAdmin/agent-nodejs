import GatewayApiKeyResolveError from './resolve-error';

export { default as GatewayApiKeyResolveError } from './resolve-error';
export type { GatewayApiKeyResolveErrorParams } from './resolve-error';

const API_KEY_PATTERN = /^(?:fgw|fbff)_([0-9a-f]{16})_([0-9a-f]{64})$/;

const DEFAULT_HEADERS = { 'Content-Type': 'application/json' } as const;
const REQUEST_TIMEOUT_MS = 10_000;
const RESOLVE_PATH = '/liana/v1/bff-api-keys/resolve';

export type GatewayService = 'api' | 'mcp';

export interface ParsedGatewayApiKey {
  keyId: string;
  secret: string;
}

export interface GatewayApiKeyIdentityUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  team: string;
  tags: { key: string; value: string }[];
  permissionLevel: string;
}

export interface ResolvedGatewayApiKeyIdentity {
  user: GatewayApiKeyIdentityUser;
  renderingId: number;
  saasAccessToken?: string;
}

export interface GatewayApiKeyClientOptions {
  forestServerUrl: string;
  envSecret: string;
  service: GatewayService;
}

interface SaasErrorBody {
  errors?: { name?: string; meta?: { code?: string } }[];
}

export function parseGatewayApiKey(raw: string): ParsedGatewayApiKey | null {
  const match = API_KEY_PATTERN.exec(raw);

  if (!match) return null;

  return { keyId: match[1], secret: match[2] };
}

// Calls fetch rather than ServerUtils: the caller needs the refusal's `meta.code` and `Retry-After`,
// which ServerUtils drops when it maps a response to a typed error.
export class GatewayApiKeyClient {
  private readonly forestServerUrl: string;
  private readonly envSecret: string;
  private readonly service: GatewayService;

  constructor({ forestServerUrl, envSecret, service }: GatewayApiKeyClientOptions) {
    this.forestServerUrl = forestServerUrl;
    this.envSecret = envSecret;
    this.service = service;
  }

  async resolve(parsedKey: ParsedGatewayApiKey): Promise<ResolvedGatewayApiKeyIdentity> {
    let response: Response;

    try {
      response = await fetch(new URL(RESOLVE_PATH, this.forestServerUrl).toString(), {
        method: 'POST',
        headers: { ...DEFAULT_HEADERS, 'forest-secret-key': this.envSecret },
        body: JSON.stringify({
          keyId: parsedKey.keyId,
          secret: parsedKey.secret,
          service: this.service,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new GatewayApiKeyResolveError({ unreachable: true });
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as SaasErrorBody;
      const firstError = body.errors?.[0];

      throw new GatewayApiKeyResolveError({
        status: response.status,
        code: firstError?.meta?.code,
        name: firstError?.name,
        retryAfter: GatewayApiKeyClient.parseRetryAfter(response.headers.get('retry-after')),
      });
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      throw new GatewayApiKeyResolveError({ unreachable: true });
    }

    if (!GatewayApiKeyClient.isResolvedIdentity(body)) {
      throw new GatewayApiKeyResolveError({ unreachable: true });
    }

    return {
      user: body.user,
      renderingId: body.renderingId,
      saasAccessToken: body.saasAccessToken,
    };
  }

  private static isResolvedIdentity(body: unknown): body is ResolvedGatewayApiKeyIdentity {
    if (typeof body !== 'object' || body === null) return false;

    const candidate = body as {
      user?: unknown;
      renderingId?: unknown;
      saasAccessToken?: unknown;
    };

    return (
      typeof candidate.renderingId === 'number' &&
      (candidate.saasAccessToken === undefined || typeof candidate.saasAccessToken === 'string') &&
      GatewayApiKeyClient.isIdentityUser(candidate.user)
    );
  }

  private static isIdentityUser(user: unknown): user is GatewayApiKeyIdentityUser {
    if (typeof user !== 'object' || user === null) return false;

    const candidate = user as Record<string, unknown>;

    return (
      typeof candidate.id === 'number' &&
      typeof candidate.email === 'string' &&
      typeof candidate.team === 'string' &&
      typeof candidate.permissionLevel === 'string' &&
      Array.isArray(candidate.tags) &&
      candidate.tags.every(GatewayApiKeyClient.isTag)
    );
  }

  private static isTag(tag: unknown): tag is { key: string; value: string } {
    if (typeof tag !== 'object' || tag === null) return false;

    const candidate = tag as Record<string, unknown>;

    return typeof candidate.key === 'string' && typeof candidate.value === 'string';
  }

  private static parseRetryAfter(header: string | null): number | undefined {
    if (header === null) return undefined;

    const seconds = Number(header);

    return Number.isInteger(seconds) && seconds > 0 ? seconds : undefined;
  }
}
