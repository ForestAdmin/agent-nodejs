import { ApiKeyResolveError } from './api-key-resolve-error';

export { ApiKeyResolveError } from './api-key-resolve-error';
export type { ApiKeyResolveErrorParams } from './api-key-resolve-error';

export interface ApiKeyIdentityUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  team: string;
  tags: { key: string; value: string }[];
  permissionLevel: string;
}

export interface ResolvedApiKeyIdentity {
  user: ApiKeyIdentityUser;
  renderingId: number;
  allowedOrigins: string[];
}

export interface ApiKeyClientOptions {
  forestServerUrl: string;
  envSecret: string;
}

const DEFAULT_HEADERS = { 'Content-Type': 'application/json' } as const;
const REQUEST_TIMEOUT_MS = 10_000;
const RESOLVE_PATH = '/liana/v1/bff-api-keys/resolve';

interface SaasErrorBody {
  errors?: { name?: string; meta?: { code?: string } }[];
}

export default class ApiKeyClient {
  private readonly forestServerUrl: string;
  private readonly envSecret: string;

  constructor({ forestServerUrl, envSecret }: ApiKeyClientOptions) {
    this.forestServerUrl = forestServerUrl;
    this.envSecret = envSecret;
  }

  async resolveApiKey(parsedKey: {
    keyId: string;
    secret: string;
  }): Promise<ResolvedApiKeyIdentity> {
    let response: Response;

    try {
      response = await fetch(this.url(RESOLVE_PATH), {
        method: 'POST',
        headers: { ...DEFAULT_HEADERS, 'forest-secret-key': this.envSecret },
        body: JSON.stringify({ keyId: parsedKey.keyId, secret: parsedKey.secret }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new ApiKeyResolveError({ unreachable: true });
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as SaasErrorBody;
      const firstError = body.errors?.[0];

      throw new ApiKeyResolveError({
        status: response.status,
        code: firstError?.meta?.code,
        name: firstError?.name,
        retryAfter: ApiKeyClient.parseRetryAfter(response.headers.get('retry-after')),
      });
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      throw new ApiKeyResolveError({ unreachable: true });
    }

    // A well-formed HTTP 200 with an incomplete body is an unusable resolution, not a caller
    // error: surface it as unavailable rather than letting a later `user` deref throw a 500.
    if (!ApiKeyClient.isResolvedIdentity(body)) {
      throw new ApiKeyResolveError({ unreachable: true });
    }

    return body;
  }

  private static isResolvedIdentity(body: unknown): body is ResolvedApiKeyIdentity {
    if (typeof body !== 'object' || body === null) return false;

    const candidate = body as { user?: unknown; renderingId?: unknown; allowedOrigins?: unknown };

    return (
      typeof candidate.renderingId === 'number' &&
      Array.isArray(candidate.allowedOrigins) &&
      ApiKeyClient.isIdentityUser(candidate.user)
    );
  }

  // Every field the agent-token mint reads must be present, so a partial body fails here
  // (mapped to unavailable) instead of minting a token with undefined claims later.
  private static isIdentityUser(user: unknown): user is ApiKeyIdentityUser {
    if (typeof user !== 'object' || user === null) return false;

    const candidate = user as Record<string, unknown>;

    return (
      typeof candidate.id === 'number' &&
      typeof candidate.email === 'string' &&
      typeof candidate.team === 'string' &&
      typeof candidate.permissionLevel === 'string' &&
      Array.isArray(candidate.tags)
    );
  }

  // Retry-After may be an HTTP-date rather than delay-seconds; keep only a positive integer so a
  // date/negative/zero value falls back to the caller's default instead of a useless backoff hint.
  private static parseRetryAfter(header: string | null): number | undefined {
    if (header === null) return undefined;

    const seconds = Number(header);

    return Number.isInteger(seconds) && seconds > 0 ? seconds : undefined;
  }

  private url(path: string): string {
    return new URL(path, this.forestServerUrl).toString();
  }
}
