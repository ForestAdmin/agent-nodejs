import type { UploadStorage } from '../../src/file-uploads/types';
import type { ForestServerClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { RegisteredToolConfig } from '../helpers/registered-tool-config';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { verifyUploadHandle } from '../../src/file-uploads/handles';
import { resolveFileUploads } from '../../src/file-uploads/types';
import declareRequestActionFileUploadTool from '../../src/tools/request-action-file-upload';

const AUTH_SECRET = 'test-auth-secret';
const mockLogger: Logger = jest.fn();
const mockForestServerClient = {
  forestServerUrl: 'https://api.forestadmin.com',
  fetchSchema: jest.fn(),
  createActivityLog: jest.fn(),
  createMcpActivityLog: jest.fn(),
  updateActivityLogStatus: jest.fn(),
} as unknown as ForestServerClient;

const authenticatedExtra = {
  authInfo: { token: 'test-token', scopes: ['mcp:read', 'mcp:action'], extra: { userId: 42 } },
} as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

describe('declareRequestActionFileUploadTool', () => {
  let mcpServer: McpServer;
  let handler: (options: unknown, extra: unknown) => Promise<{ content: { text: string }[] }>;
  let config: RegisteredToolConfig;
  let storage: UploadStorage;

  const setup = (uploadsEnabled = true) => {
    storage = {
      createUploadUrl: jest.fn().mockResolvedValue({
        url: 'https://storage.example/put?signed=1',
        headers: { 'Content-Type': 'application/pdf' },
      }),
      download: jest.fn(),
      getSize: jest.fn(),
    };

    declareRequestActionFileUploadTool(mcpServer, {
      forestServerClient: mockForestServerClient,
      logger: mockLogger,
      collectionNames: [],
      ...(uploadsEnabled && { fileUploads: resolveFileUploads({ storage }, AUTH_SECRET) }),
    });
  };

  const call = async (args: Record<string, unknown>, extra = authenticatedExtra) => {
    const result = await handler(args, extra);

    return JSON.parse(result.content[0].text);
  };

  // registerToolWithLogging reports execution errors as an isError result, not a rejection.
  const callExpectingError = async (args: Record<string, unknown>, extra = authenticatedExtra) =>
    (await handler(args, extra)) as unknown as { isError: boolean; content: { text: string }[] };

  const claimsOf = (fileHandle: string) =>
    verifyUploadHandle(fileHandle.slice('$uploadedFile:'.length), 42, AUTH_SECRET);

  beforeEach(() => {
    jest.clearAllMocks();
    mcpServer = {
      registerTool: jest.fn((name, toolConfig, toolHandler) => {
        config = toolConfig;
        handler = toolHandler;
      }),
    } as unknown as McpServer;
  });

  describe('registration', () => {
    it('tells the model never to inline base64', () => {
      setup();

      expect(config.description).toContain('Never inline base64 file content');
    });

    it('documents the outbound request prerequisite without promising where to configure it', () => {
      setup();

      expect(config.description).toContain('allowed for outbound traffic in that environment');
    });
  });

  describe('handler', () => {
    it('returns an upload destination and a handle redeemable by the caller', async () => {
      setup();

      const response = await call({ filename: 'report.pdf', mimeType: 'application/pdf' });

      expect(response).toMatchObject({
        uploadUrl: 'https://storage.example/put?signed=1',
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        expiresInSeconds: 15 * 60,
        maxBytes: 20 * 1024 * 1024,
      });
      expect(response.fileHandle).toMatch(/^\$uploadedFile:/);
      expect(claimsOf(response.fileHandle)).toMatchObject({
        name: 'report.pdf',
        mimeType: 'application/pdf',
      });
    });

    it('repeats the prerequisite in the response, where a failing upload will read it', async () => {
      setup();

      const response = await call({ filename: 'report.pdf', mimeType: 'application/pdf' });

      expect(response.prerequisite).toContain('allowed for outbound traffic in that environment');
    });

    it('asks the storage for a key under the configured prefix', async () => {
      setup();

      await call({ filename: 'report.pdf', mimeType: 'application/pdf' });

      expect(storage.createUploadUrl).toHaveBeenCalledWith({
        key: expect.stringMatching(/^mcp-uploads\/[0-9a-f-]{36}\/report\.pdf$/),
        mimeType: 'application/pdf',
        expiresInSeconds: 15 * 60,
      });
    });

    it('normalizes a hex digest to base64 and pins both destination and handle', async () => {
      setup();
      const hex = 'a'.repeat(64);
      const expected = Buffer.from(hex, 'hex').toString('base64');

      const response = await call({
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        sha256: hex,
      });

      expect(storage.createUploadUrl).toHaveBeenCalledWith(
        expect.objectContaining({ sha256: expected }),
      );
      expect(claimsOf(response.fileHandle).sha256Base64).toBe(expected);
    });

    it('falls back to PUT and a Content-Type header when the storage provides neither', async () => {
      declareRequestActionFileUploadTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
        fileUploads: resolveFileUploads(
          {
            storage: {
              createUploadUrl: jest.fn().mockResolvedValue({ url: 'https://storage.example/put' }),
              download: jest.fn(),
              getSize: jest.fn(),
            },
          },
          AUTH_SECRET,
        ),
      });

      const response = await call({ filename: 'report.pdf', mimeType: 'application/pdf' });

      expect(response.method).toBe('PUT');
      expect(response.headers).toEqual({ 'Content-Type': 'application/pdf' });
    });

    it('uses the method and headers the storage returns', async () => {
      declareRequestActionFileUploadTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
        fileUploads: resolveFileUploads(
          {
            storage: {
              createUploadUrl: jest.fn().mockResolvedValue({
                url: 'https://storage.example/post',
                method: 'POST',
                headers: { 'x-amz-checksum-sha256': 'abc' },
              }),
              download: jest.fn(),
              getSize: jest.fn(),
            },
          },
          AUTH_SECRET,
        ),
      });

      const response = await call({ filename: 'report.pdf', mimeType: 'application/pdf' });

      expect(response.method).toBe('POST');
      expect(response.headers).toEqual({ 'x-amz-checksum-sha256': 'abc' });
    });

    it('accepts a digest already in base64', async () => {
      setup();
      const base64 = Buffer.alloc(32, 1).toString('base64');

      await call({ filename: 'report.pdf', mimeType: 'application/pdf', sha256: base64 });

      expect(storage.createUploadUrl).toHaveBeenCalledWith(
        expect.objectContaining({ sha256: base64 }),
      );
    });

    it.each([
      ['../etc/passwd.pdf', '.._etc_passwd.pdf'],
      ['..', 'file'],
      ['.', 'file'],
      ['a/b/c.pdf', 'a_b_c.pdf'],
    ])('sanitizes %p to %p so it cannot escape the storage key', async (filename, expected) => {
      setup();

      const response = await call({ filename, mimeType: 'text/plain' });

      expect(claimsOf(response.fileHandle).name).toBe(expected);
    });

    it('keeps a filename the agent can round-trip, spaces and all', async () => {
      setup();

      const response = await call({
        filename: 'rapport final (v2).pdf',
        mimeType: 'application/pdf',
      });

      expect(claimsOf(response.fileHandle).name).toBe('rapport final (v2).pdf');
    });

    it('truncates a long filename from the front so the extension survives', async () => {
      setup();

      const response = await call({
        filename: `${'a'.repeat(200)}.pdf`,
        mimeType: 'application/pdf',
      });

      const { name } = claimsOf(response.fileHandle);
      expect(name).toHaveLength(128);
      expect(name.endsWith('.pdf')).toBe(true);
    });

    it.each([
      ['a malformed digest', { sha256: 'nope' }, 'sha256 must be the file digest'],
      ['a mime type that is not a pair', { mimeType: 'not a mime type' }, 'is not a media type'],
    ])('rejects %s', async (_, override, message) => {
      setup();

      const result = await callExpectingError({
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        ...override,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(message);
      expect(storage.createUploadUrl).not.toHaveBeenCalled();
    });

    // /mcp only gates on mcp:read, so a read-only token would otherwise mint a pre-authorized
    // write into the host's storage.
    it('rejects a token that lacks the mcp:action scope', async () => {
      setup();

      const result = await callExpectingError({ filename: 'r.pdf', mimeType: 'application/pdf' }, {
        authInfo: { token: 't', scopes: ['mcp:read'], extra: { userId: 42 } },
      } as unknown as typeof authenticatedExtra);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('requires the "mcp:action" scope');
      expect(storage.createUploadUrl).not.toHaveBeenCalled();
    });

    // The zod schema trims and requires a non-empty name, but the fallback is what keeps a name
    // that sanitizes down to nothing from becoming a key ending in '/' and an empty File name.
    it.each([
      ['   ', 'file'],
      ['%%%', '___'],
    ])('names an object %p as %p rather than leaving it empty', async (filename, expected) => {
      setup();

      const response = await call({ filename, mimeType: 'text/plain' });

      expect(claimsOf(response.fileHandle).name).toBe(expected);
    });

    it('rejects a call with no authenticated user', async () => {
      setup();

      const result = await callExpectingError(
        {
          filename: 'report.pdf',
          mimeType: 'application/pdf',
        },
        { authInfo: { token: 't', extra: {} } } as unknown as typeof authenticatedExtra,
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('without an authenticated user');
    });

    it('rejects when no storage backend is configured', async () => {
      setup(false);

      const result = await callExpectingError({
        filename: 'report.pdf',
        mimeType: 'application/pdf',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('File uploads are not configured on this server');
    });
  });
});
