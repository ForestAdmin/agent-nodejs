import type CredentialEncryption from '../crypto/credential-encryption';
import type { McpOAuthCredentialInput } from '../ports/mcp-oauth-credentials-store';

import { z } from 'zod';

import assertSafeTokenEndpoint from '../oauth/token-endpoint-url';

// String lengths mirror the DB column limits, so oversized values are rejected here at the boundary
// rather than at insert. .strict() matters for security: it blocks a body-supplied user id, since
// identity comes only from the JWT.
export const depositCredentialsBodySchema = z
  .object({
    mcpServerId: z.string().min(1).max(255),
    refreshToken: z.string().min(1),
    clientId: z.string().max(255).optional(),
    clientSecret: z.string().min(1).optional(),
    clientSecretExpiresAt: z
      .string()
      .refine(value => !Number.isNaN(Date.parse(value)), { message: 'must be a parseable date' })
      .optional(),
    tokenEndpoint: z
      .string()
      .min(1)
      .max(2048)
      .superRefine((value, ctx) => {
        // The executor POSTs the refresh grant here, so reject SSRF-prone endpoints at deposit
        // rather than discovering them at refresh time.
        try {
          assertSafeTokenEndpoint(value);
        } catch (error) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: error instanceof Error ? error.message : 'invalid token endpoint',
          });
        }
      }),
    // Only the client-authentication methods the refresh grant actually implements. An unsupported
    // or typo'd method is rejected here rather than silently falling through to the wrong auth at
    // refresh time. 'none' is the public-client case (client_id, no secret).
    tokenEndpointAuthMethod: z
      .enum(['client_secret_basic', 'client_secret_post', 'none'])
      .optional(),
    scopes: z.string().max(2048).optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    // RFC 6749 requires client_id alongside client_secret; a secret with no id can never
    // authenticate, so reject it here instead of persisting an unusable credential.
    if (body.clientSecret && !body.clientId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['clientId'],
        message: 'clientId is required when clientSecret is provided',
      });
    }
  });

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
