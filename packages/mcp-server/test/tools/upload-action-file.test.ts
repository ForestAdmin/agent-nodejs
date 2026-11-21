import type { UploadStorage } from '../../src/file-uploads/types';
import type { ForestServerClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { RegisteredToolConfig } from '../helpers/registered-tool-config';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';

import * as crypto from 'crypto';

import EphemeralStorage from '../../src/file-uploads/ephemeral-storage';
import resolveUploadedFileValues from '../../src/file-uploads/resolve';
import { resolveFileUploads } from '../../src/file-uploads/types';
import declareUploadActionFileTool from '../../src/tools/upload-action-file';

const AUTH_SECRET = 'test-auth-secret';
const UPLOAD_URL = 'https://storage.example/put?signed=1';
const PDF_BYTES = Buffer.from('%PDF-1.7 hello');
const mockLogger: Logger = jest.fn();
const mockForestServerClient = {} as ForestServerClient;

const authInfoOf = (userId: number) =>
  ({ token: 'test-token', clientId: 'client', scopes: [], extra: { userId } } as AuthInfo);

type ToolResult = { isError?: boolean; content: { text: string }[] };

describe('declareUploadActionFileTool', () => {
  let config: RegisteredToolConfig;
  let handler: (options: unknown, extra: unknown) => Promise<ToolResult>;
  let objects: Map<string, Buffer>;
  let storage: UploadStorage;
  let fetchMock: jest.Mock;
  const savedFetch = global.fetch;

  const mcpServer = {
    registerTool: jest.fn((name, toolConfig, toolHandler) => {
      config = toolConfig;
      handler = toolHandler;
    }),
  } as unknown as McpServer;

  const declare = (fileUploads = resolveFileUploads({ storage }, AUTH_SECRET)) =>
    declareUploadActionFileTool(mcpServer, {
      forestServerClient: mockForestServerClient,
      logger: mockLogger,
      collectionNames: [],
      fileUploads,
    });

  const upload = (args: Record<string, unknown>, userId = 42) =>
    handler(
      { filename: 'report.pdf', mimeType: 'application/pdf', ...args },
      { authInfo: authInfoOf(userId) },
    );

  const uploadPdf = async () => {
    const result = await upload({ contentBase64: PDF_BYTES.toString('base64') });

    return JSON.parse(result.content[0].text) as { fileHandle: string; size: number };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    objects = new Map();
    storage = {
      createUploadUrl: jest.fn().mockResolvedValue({ url: UPLOAD_URL }),
      download: jest.fn(async (key: string) => objects.get(key) as Buffer),
      getSize: jest.fn(async (key: string) => objects.get(key)?.length),
    };
    fetchMock = jest.fn(async (_url: string, init: { body: Uint8Array }) => {
      const { key } = (storage.createUploadUrl as jest.Mock).mock.calls.at(-1)[0];

      objects.set(key, Buffer.from(init.body));

      return { ok: true, status: 200 };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = savedFetch;
  });

  it('registers the tool for the app only', () => {
    declare();

    expect(config).toEqual(expect.objectContaining({ _meta: { ui: { visibility: ['app'] } } }));
  });

  it('puts the bytes to the storage destination with the pinned digest', async () => {
    declare();

    await uploadPdf();

    const sha256 = crypto.createHash('sha256').update(new Uint8Array(PDF_BYTES)).digest('base64');

    expect(storage.createUploadUrl).toHaveBeenCalledWith({
      key: expect.stringMatching(/^mcp-uploads\/[0-9a-f-]{36}\/report\.pdf$/),
      mimeType: 'application/pdf',
      sha256,
      expiresInSeconds: 15 * 60,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      UPLOAD_URL,
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: new Uint8Array(PDF_BYTES),
      }),
    );
  });

  it('returns a handle that executeAction resolves to the uploaded file', async () => {
    declare();

    const { fileHandle, size } = await uploadPdf();
    const resolved = await resolveUploadedFileValues(
      { document: fileHandle },
      authInfoOf(42),
      resolveFileUploads({ storage }, AUTH_SECRET),
    );

    expect(size).toBe(PDF_BYTES.length);
    expect(resolved.document).toEqual(
      expect.objectContaining({ name: 'report.pdf', mimeType: 'application/pdf' }),
    );
    expect((resolved.document as { buffer: Buffer }).buffer.equals(new Uint8Array(PDF_BYTES))).toBe(
      true,
    );
  });

  it('refuses the handle when another user redeems it', async () => {
    declare();

    const { fileHandle } = await uploadPdf();

    await expect(
      resolveUploadedFileValues(
        { document: fileHandle },
        authInfoOf(7),
        resolveFileUploads({ storage }, AUTH_SECRET),
      ),
    ).rejects.toThrow('Handle was issued to another user');
  });

  it('refuses base64 longer than maxBytes allows before decoding it', async () => {
    declare(resolveFileUploads({ storage, maxBytes: 3 }, AUTH_SECRET));
    const bufferFrom = jest.spyOn(Buffer, 'from');

    const result = await upload({ contentBase64: 'A'.repeat(4096) });

    expect(result.content[0].text).toBe('The file is above the 3 byte limit.');
    expect(bufferFrom).not.toHaveBeenCalledWith(expect.any(String), 'base64');
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
    bufferFrom.mockRestore();
  });

  it('refuses a file over maxBytes before any storage call', async () => {
    declare(resolveFileUploads({ storage, maxBytes: PDF_BYTES.length - 1 }, AUTH_SECRET));

    const result = await upload({ contentBase64: PDF_BYTES.toString('base64') });

    expect(result).toEqual({
      isError: true,
      content: [
        {
          type: 'text',
          text: `The file is ${PDF_BYTES.length} bytes, above the ${
            PDF_BYTES.length - 1
          } byte limit.`,
        },
      ],
    });
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts a file of exactly maxBytes', async () => {
    declare(resolveFileUploads({ storage, maxBytes: PDF_BYTES.length }, AUTH_SECRET));

    const { size } = await uploadPdf();

    expect(size).toBe(PDF_BYTES.length);
  });

  it('refuses content that is not standard base64', async () => {
    declare();

    const result = await upload({ contentBase64: 'data:application/pdf;base64,JVBERi0=' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(
      'contentBase64 must be the file content in standard base64, without a prefix.',
    );
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });

  it('refuses an invalid media type before any storage call', async () => {
    declare();

    const result = await upload({ mimeType: 'pdf', contentBase64: 'AA==' });

    expect(result.content[0].text).toContain('"pdf" is not a media type');
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });

  it('reports a storage refusal without leaking the destination or the key', async () => {
    declare();
    fetchMock.mockResolvedValue({ ok: false, status: 403 });

    const result = await upload({ contentBase64: PDF_BYTES.toString('base64') });

    expect(result).toEqual({
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Could not store the file: the storage backend refused it or did not answer.',
        },
      ],
    });
  });

  it('hides a storage error message that names the destination', async () => {
    declare();
    fetchMock.mockRejectedValue(new Error(`connect ECONNREFUSED ${UPLOAD_URL}`));

    const result = await upload({ contentBase64: PDF_BYTES.toString('base64') });

    expect(result.content[0].text).not.toContain('storage.example');
    expect(result.content[0].text).not.toContain('mcp-uploads/');
  });

  it('puts only to the destination the storage issued, without following redirects', async () => {
    declare();

    await upload({
      contentBase64: PDF_BYTES.toString('base64'),
      url: 'http://169.254.169.254/latest',
      uploadUrl: 'http://169.254.169.254/latest',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      UPLOAD_URL,
      expect.objectContaining({ redirect: 'error' }),
    );
  });

  it('pins the digest of the received bytes, so a replaced object is refused at executeAction', async () => {
    declare();

    const { fileHandle } = await uploadPdf();
    const [key] = [...objects.keys()];

    objects.set(key, Buffer.from('%PDF-1.7 other'));

    await expect(
      resolveUploadedFileValues(
        { document: fileHandle },
        authInfoOf(42),
        resolveFileUploads({ storage }, AUTH_SECRET),
      ),
    ).rejects.toThrow('uploaded file does not match the sha256 it was pinned to');
  });

  it('never returns or logs the file content, and never logs the handle', async () => {
    declare();

    const contentBase64 = PDF_BYTES.toString('base64');
    const result = await upload({ contentBase64 });
    const { fileHandle } = JSON.parse(result.content[0].text);
    const logged = JSON.stringify((mockLogger as jest.Mock).mock.calls);

    expect(Object.keys(JSON.parse(result.content[0].text)).sort()).toEqual([
      'fileHandle',
      'mimeType',
      'name',
      'size',
    ]);
    expect(result.content[0].text).not.toContain(contentBase64);
    expect(logged).not.toContain(contentBase64);
    expect(logged).not.toContain(fileHandle.slice('$uploadedFile:'.length));
  });

  it('caps the base64 length in the input schema from maxBytes', () => {
    declare(resolveFileUploads({ storage, maxBytes: 3 }, AUTH_SECRET));

    const { contentBase64 } = config.inputSchema as Record<string, z.ZodString>;

    expect(contentBase64.safeParse('AAAA').success).toBe(true);
    expect(contentBase64.safeParse('AAAAAAAA').success).toBe(false);
  });

  it('refuses a third concurrent upload from the same user, but not from another user', async () => {
    declare();

    const pending: Array<() => void> = [];

    fetchMock.mockImplementation(
      () =>
        new Promise(resolve => {
          pending.push(() => resolve({ ok: true, status: 200 }));
        }),
    );

    const contentBase64 = PDF_BYTES.toString('base64');
    const first = upload({ contentBase64 });
    const second = upload({ contentBase64 });
    const third = await upload({ contentBase64 });
    const otherUser = upload({ contentBase64 }, 7);

    await new Promise(setImmediate);
    pending.forEach(release => release());

    expect(third.content[0].text).toBe(
      'Only 2 uploads can run at once for a user: wait for one to finish.',
    );
    expect((await first).isError).toBeUndefined();
    expect((await second).isError).toBeUndefined();
    expect((await otherUser).isError).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails clearly when file uploads are not configured', async () => {
    declareUploadActionFileTool(mcpServer, {
      forestServerClient: mockForestServerClient,
      logger: mockLogger,
      collectionNames: [],
    });

    const result = await upload({ contentBase64: 'AA==' });

    expect(result.content[0].text).toBe(
      'File uploads are not configured on this server. ' +
        'Ask the administrator to set the fileUploads option to enable action file fields.',
    );
  });

  it('refuses a caller without an authenticated user', async () => {
    declare();

    const result = await handler(
      { filename: 'a.pdf', mimeType: 'application/pdf', contentBase64: 'AA==' },
      { authInfo: undefined },
    );

    expect(result.content[0].text).toBe(
      'Cannot request a file upload without an authenticated user',
    );
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });

  describe('with the in-memory store', () => {
    const ephemeralUploads = (maxTotalBytes = 1024) => {
      const ephemeral = new EphemeralStorage(mockLogger);

      ephemeral.configure({
        maxBytes: 1024,
        maxTotalBytes,
        ttlSeconds: 60,
        issuedTtlSeconds: 60,
        publicBaseUrl: 'https://agent.example/mcp/uploads',
      });

      return resolveFileUploads({ storage: ephemeral }, AUTH_SECRET);
    };

    it('stores the bytes in process, without an HTTP request to its own origin', async () => {
      const fileUploads = ephemeralUploads();

      declare(fileUploads);

      const { fileHandle } = await uploadPdf();
      const resolved = await resolveUploadedFileValues(
        { document: fileHandle },
        authInfoOf(42),
        fileUploads,
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(
        (resolved.document as { buffer: Buffer }).buffer.equals(new Uint8Array(PDF_BYTES)),
      ).toBe(true);
    });

    it('reports a full store', async () => {
      declare(ephemeralUploads(PDF_BYTES.length - 1));

      const result = await upload({ contentBase64: PDF_BYTES.toString('base64') });

      expect(result.content[0].text).toBe(
        `Could not store the file: the in-memory store is full (${PDF_BYTES.length - 1} bytes)`,
      );
    });
  });
});
