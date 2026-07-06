import type CredentialEncryption from '../../src/crypto/credential-encryption';
import type { DepositCredentialsBody } from '../../src/http/mcp-oauth-credentials';

import { ExecutorEncryptionKeyMissingError } from '../../src/errors';
import {
  buildMcpOAuthCredentialInput,
  depositCredentialsBodySchema,
} from '../../src/http/mcp-oauth-credentials';

function createEncryption(): CredentialEncryption {
  return {
    encrypt: jest.fn((plaintext: string) => ({
      ciphertext: Buffer.from(`enc(${plaintext})`),
    })),
    decrypt: jest.fn(),
  } as unknown as CredentialEncryption;
}

const fullBody: DepositCredentialsBody = {
  mcpServerId: 'mcp-server-1',
  refreshToken: 'refresh-token-xyz',
  clientId: 'client-abc',
  clientSecret: 'client-secret-123',
  clientSecretExpiresAt: '2030-01-02T03:04:05.000Z',
  tokenEndpoint: 'https://auth.example.com/token',
  tokenEndpointAuthMethod: 'client_secret_post',
  scopes: 'read write',
};

describe('buildMcpOAuthCredentialInput', () => {
  it('encrypts the refresh token and maps the record for the given user', () => {
    const encryption = createEncryption();

    const input = buildMcpOAuthCredentialInput({ body: fullBody, userId: 7, encryption });

    expect(encryption.encrypt).toHaveBeenCalledWith('refresh-token-xyz');
    expect(input.userId).toBe(7);
    expect(input.mcpServerId).toBe('mcp-server-1');
    expect(input.refreshTokenEnc.toString()).toBe('enc(refresh-token-xyz)');
    expect(input.tokenEndpoint).toBe('https://auth.example.com/token');
    expect(input.tokenEndpointAuthMethod).toBe('client_secret_post');
    expect(input.scopes).toBe('read write');
  });

  it('encrypts the client secret and parses the expiry when both are provided', () => {
    const encryption = createEncryption();

    const input = buildMcpOAuthCredentialInput({ body: fullBody, userId: 7, encryption });

    expect(encryption.encrypt).toHaveBeenCalledWith('client-secret-123');
    expect(input.clientSecretEnc?.toString()).toBe('enc(client-secret-123)');
    expect(input.clientSecretExpiresAt).toEqual(new Date('2030-01-02T03:04:05.000Z'));
  });

  it('leaves optional client fields null for a public / PKCE client', () => {
    const encryption = createEncryption();
    const publicBody: DepositCredentialsBody = {
      mcpServerId: 'mcp-server-1',
      refreshToken: 'refresh-token-xyz',
      tokenEndpoint: 'https://auth.example.com/token',
    };

    const input = buildMcpOAuthCredentialInput({ body: publicBody, userId: 7, encryption });

    expect(encryption.encrypt).toHaveBeenCalledTimes(1);
    expect(input.clientId).toBeNull();
    expect(input.clientSecretEnc).toBeNull();
    expect(input.clientSecretExpiresAt).toBeNull();
    expect(input.tokenEndpointAuthMethod).toBeNull();
    expect(input.scopes).toBeNull();
  });

  it('propagates ExecutorEncryptionKeyMissingError so the caller can fail closed', () => {
    const encryption = createEncryption();
    (encryption.encrypt as jest.Mock).mockImplementation(() => {
      throw new ExecutorEncryptionKeyMissingError();
    });

    expect(() => buildMcpOAuthCredentialInput({ body: fullBody, userId: 7, encryption })).toThrow(
      ExecutorEncryptionKeyMissingError,
    );
  });
});

describe('depositCredentialsBodySchema', () => {
  const validBody = {
    mcpServerId: 'mcp-server-1',
    refreshToken: 'refresh-token-xyz',
    tokenEndpoint: 'https://auth.example.com/token',
  };

  it('rejects a clientSecret supplied without a clientId', () => {
    const result = depositCredentialsBodySchema.safeParse({ ...validBody, clientSecret: 'secret' });

    expect(result.success).toBe(false);
  });

  it('rejects an empty-string clientId (would drop client_id at refresh time)', () => {
    const result = depositCredentialsBodySchema.safeParse({ ...validBody, clientId: '' });

    expect(result.success).toBe(false);
  });

  it('accepts a clientSecret paired with a clientId', () => {
    const result = depositCredentialsBodySchema.safeParse({
      ...validBody,
      clientId: 'client-abc',
      clientSecret: 'secret',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unsupported tokenEndpointAuthMethod', () => {
    const result = depositCredentialsBodySchema.safeParse({
      ...validBody,
      tokenEndpointAuthMethod: 'client_secret_posst',
    });

    expect(result.success).toBe(false);
  });

  it.each(['client_secret_basic', 'client_secret_post', 'none'] as const)(
    'accepts the supported client-authentication method %s',
    method => {
      const result = depositCredentialsBodySchema.safeParse({
        ...validBody,
        tokenEndpointAuthMethod: method,
      });

      expect(result.success).toBe(true);
    },
  );
});
