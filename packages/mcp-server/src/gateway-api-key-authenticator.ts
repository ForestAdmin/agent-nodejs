import type {
  GatewayApiKeyClient,
  ParsedGatewayApiKey,
  ResolvedGatewayApiKeyIdentity,
} from '@forestadmin/forestadmin-client';
import type { OAuthError } from '@modelcontextprotocol/sdk/server/auth/errors.js';

import { toAgentTokenClaims } from '@forestadmin/agent-client';
import { GatewayApiKeyResolveError } from '@forestadmin/forestadmin-client';
import {
  InsufficientScopeError,
  InvalidTokenError,
  ServerError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import crypto from 'crypto';
import jsonwebtoken from 'jsonwebtoken';

export const SERVICE_ACCOUNT_SCOPES = ['mcp:read', 'mcp:write', 'mcp:action'];

const AGENT_TOKEN_TTL_SECONDS = 5 * 60;
const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 10_000;
const MAX_ENTRIES = 10_000;
const NEGATIVE_CACHE_STATUSES = new Set([401, 403]);
const PLAN_FEATURE_MISSING = 'plan_feature_missing';

export interface AuthenticatedGatewayApiKey {
  identity: ResolvedGatewayApiKeyIdentity & { saasAccessToken: string };
  agentToken: string;
  expiresAt: number;
}

export interface GatewayApiKeyAuthenticatorOptions {
  client: Pick<GatewayApiKeyClient, 'resolve'>;
  authSecret: string;
  now?: () => number;
}

type CacheEntry =
  | { kind: 'positive'; identity: AuthenticatedGatewayApiKey['identity']; expiresAt: number }
  | { kind: 'negative'; error: OAuthError; expiresAt: number };

function toOAuthError(error: GatewayApiKeyResolveError): OAuthError {
  if (error.status === 401) {
    return new InvalidTokenError('Invalid or revoked service account credential');
  }

  if (error.status === 403 && error.code === PLAN_FEATURE_MISSING) {
    return new InsufficientScopeError("The project's plan does not include the Gateway MCP");
  }

  if (error.status === 403) {
    return new InsufficientScopeError('This service account is not allowed on this environment');
  }

  return new ServerError('Unable to resolve the service account credential');
}

function mapResolveError(error: GatewayApiKeyResolveError): OAuthError {
  return Object.assign(toOAuthError(error), { cause: error });
}

export default class GatewayApiKeyAuthenticator {
  private readonly client: Pick<GatewayApiKeyClient, 'resolve'>;
  private readonly authSecret: string;
  private readonly now: () => number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor({ client, authSecret, now = Date.now }: GatewayApiKeyAuthenticatorOptions) {
    this.client = client;
    this.authSecret = authSecret;
    this.now = now;
  }

  async authenticate(parsedKey: ParsedGatewayApiKey): Promise<AuthenticatedGatewayApiKey> {
    const hash = crypto
      .createHash('sha256')
      .update(`${parsedKey.keyId}:${parsedKey.secret}`)
      .digest('hex');
    const cached = this.liveEntry(hash);

    if (cached?.kind === 'negative') throw cached.error;
    if (cached?.kind === 'positive') return this.mint(cached.identity);

    let identity: ResolvedGatewayApiKeyIdentity;

    try {
      identity = await this.client.resolve(parsedKey);
    } catch (error) {
      if (!(error instanceof GatewayApiKeyResolveError)) throw error;

      const mapped = mapResolveError(error);

      if (error.status !== undefined && NEGATIVE_CACHE_STATUSES.has(error.status)) {
        this.store(hash, {
          kind: 'negative',
          error: mapped,
          expiresAt: this.expiry(NEGATIVE_TTL_MS),
        });
      }

      throw mapped;
    }

    if (!identity.saasAccessToken) {
      throw new ServerError('The service account credential resolved without a Forest token');
    }

    const complete = { ...identity, saasAccessToken: identity.saasAccessToken };
    this.store(hash, {
      kind: 'positive',
      identity: complete,
      expiresAt: this.expiry(POSITIVE_TTL_MS),
    });

    return this.mint(complete);
  }

  private mint(identity: AuthenticatedGatewayApiKey['identity']): AuthenticatedGatewayApiKey {
    const { user, renderingId } = identity;
    const expiresAt = Math.floor(this.now() / 1000) + AGENT_TOKEN_TTL_SECONDS;
    const agentToken = jsonwebtoken.sign(
      {
        ...toAgentTokenClaims({
          id: user.id,
          email: user.email,
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          team: user.team,
          renderingId,
          tags: Object.fromEntries(user.tags.map(({ key, value }) => [key, value])),
          permissionLevel: user.permissionLevel,
        }),
        exp: expiresAt,
      },
      this.authSecret,
      { algorithm: 'HS256' },
    );

    return { identity, agentToken, expiresAt };
  }

  private expiry(ttlMs: number): number {
    return this.now() + ttlMs;
  }

  private liveEntry(hash: string): CacheEntry | undefined {
    const entry = this.cache.get(hash);

    if (!entry) return undefined;

    if (this.now() >= entry.expiresAt) {
      this.cache.delete(hash);

      return undefined;
    }

    return entry;
  }

  private store(hash: string, entry: CacheEntry): void {
    this.cache.delete(hash);

    if (this.cache.size >= MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }

    this.cache.set(hash, entry);
  }
}
