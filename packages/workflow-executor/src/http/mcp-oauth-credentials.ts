import type CredentialEncryption from '../crypto/credential-encryption';
import type { McpOAuthCredentialInput } from '../ports/mcp-oauth-credentials-store';

import { z } from 'zod';

// String lengths mirror the DB column limits, so oversized values are rejected here at the boundary
// rather than at insert. .strict() matters for security: it blocks a body-supplied user id, since
// identity comes only from the JWT.
export const depositCredentialsBodySchema = z
  .object({
    mcpServerId: z.string().min(1).max(255),
    refreshToken: z.string().min(1),
    clientId: z.string().max(255).optional(),
    clientSecret: z.string().optional(),
    clientSecretExpiresAt: z
      .string()
      .refine(value => !Number.isNaN(Date.parse(value)), { message: 'must be a parseable date' })
      .optional(),
    tokenEndpoint: z.string().min(1).max(2048),
    tokenEndpointAuthMethod: z.string().max(64).optional(),
    scopes: z.string().max(2048).optional(),
  })
  .strict();

export type DepositCredentialsBody = z.infer<typeof depositCredentialsBodySchema>;

// Translates a validated deposit body into the at-rest record: encrypts the refresh token (and
// client secret when present) and maps optional fields to their nullable columns. encrypt() throws
// ExecutorEncryptionKeyMissingError when the key is unset; the caller maps that to a 503.
export function buildMcpOAuthCredentialInput({
  body,
  userId,
  encryption,
}: {
  body: DepositCredentialsBody;
  userId: number;
  encryption: CredentialEncryption;
}): McpOAuthCredentialInput {
  const refreshToken = encryption.encrypt(body.refreshToken);
  const clientSecret = body.clientSecret ? encryption.encrypt(body.clientSecret) : null;

  return {
    userId,
    mcpServerId: body.mcpServerId,
    refreshTokenEnc: refreshToken.ciphertext,
    clientId: body.clientId ?? null,
    clientSecretEnc: clientSecret?.ciphertext ?? null,
    clientSecretExpiresAt: body.clientSecretExpiresAt ? new Date(body.clientSecretExpiresAt) : null,
    tokenEndpoint: body.tokenEndpoint,
    tokenEndpointAuthMethod: body.tokenEndpointAuthMethod ?? null,
    scopes: body.scopes ?? null,
  };
}
