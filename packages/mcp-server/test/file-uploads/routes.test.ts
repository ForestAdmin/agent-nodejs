import type { UploadStorage } from '../../src/file-uploads/types';
import type { Logger } from '../../src/server';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { Express } from 'express';

import express from 'express';
import request from 'supertest';

import { verifyUploadHandle } from '../../src/file-uploads/handles';
import createFilesRouter from '../../src/file-uploads/routes';
import { resolveFileUploads } from '../../src/file-uploads/types';

const AUTH_SECRET = 'test-auth-secret';
const mockLogger: Logger = jest.fn();

function makeApp(options: {
  storage?: UploadStorage;
  auth?: AuthInfo | undefined;
  keyPrefix?: string;
}): { app: Express; storage: UploadStorage } {
  const storage: UploadStorage = options.storage ?? {
    createUploadUrl: jest.fn().mockResolvedValue({
      url: 'https://storage.example/put?signed=1',
      headers: { 'Content-Type': 'application/pdf' },
    }),
    download: jest.fn(),
  };

  const uploads = resolveFileUploads(
    { storage, ...(options.keyPrefix ? { keyPrefix: options.keyPrefix } : {}) },
    AUTH_SECRET,
  );

  const app = express();
  app.use(express.json());

  // Stands in for requireBearerAuth, which attaches the verified AuthInfo to req.auth.
  app.use((req, res, next) => {
    req.auth = options.auth;
    next();
  });

  app.use('/files', createFilesRouter(uploads, mockLogger));

  return { app, storage };
}

const authenticatedUser = {
  token: 'token',
  clientId: '42',
  scopes: ['mcp:action'],
  extra: { userId: 42 },
} as unknown as AuthInfo;

describe('POST /files', () => {
  it('returns 401 when no authenticated user is attached to the request', async () => {
    const { app } = makeApp({ auth: undefined });

    const response = await request(app)
      .post('/files')
      .send({ filename: 'report.pdf', mimeType: 'application/pdf' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Missing or invalid access token.' });
  });

  it('returns 400 when filename is missing or blank', async () => {
    const { app } = makeApp({ auth: authenticatedUser });

    const response = await request(app)
      .post('/files')
      .send({ filename: '  ', mimeType: 'application/pdf' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'filename is required.' });
  });

  it('returns 400 when mimeType is not a type/subtype pair', async () => {
    const { app } = makeApp({ auth: authenticatedUser });

    const response = await request(app)
      .post('/files')
      .send({ filename: 'report.pdf', mimeType: 'not a mime type' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'mimeType is required, e.g. application/pdf.' });
  });

  it('returns 400 when sha256 is neither hex nor base64', async () => {
    const { app } = makeApp({ auth: authenticatedUser });

    const response = await request(app)
      .post('/files')
      .send({ filename: 'report.pdf', mimeType: 'application/pdf', sha256: 'nope' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'sha256 must be the file digest as hex or base64.' });
  });

  it('returns an upload destination and a redeemable handle', async () => {
    const { app, storage } = makeApp({ auth: authenticatedUser });

    const response = await request(app)
      .post('/files')
      .send({ filename: 'report.pdf', mimeType: 'application/pdf' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      uploadUrl: 'https://storage.example/put?signed=1',
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      expiresInSeconds: 15 * 60,
      maxBytes: 20 * 1024 * 1024,
    });
    expect(response.body.fileHandle).toMatch(/^\$uploadedFile:/);
    expect(response.body.usage).toContain('executeAction');

    expect(storage.createUploadUrl).toHaveBeenCalledWith({
      key: expect.stringMatching(/^mcp-uploads\/[0-9a-f-]{36}\/report\.pdf$/),
      mimeType: 'application/pdf',
      expiresInSeconds: 15 * 60,
    });

    const claims = verifyUploadHandle(
      (response.body.fileHandle as string).slice('$uploadedFile:'.length),
      42,
      AUTH_SECRET,
    );
    expect(claims).toMatchObject({ name: 'report.pdf', mimeType: 'application/pdf' });
  });

  it('normalizes a hex sha256 to base64 and pins both the destination and the handle', async () => {
    const { app, storage } = makeApp({ auth: authenticatedUser });
    const hex = 'a'.repeat(64);
    const expectedBase64 = Buffer.from(hex, 'hex').toString('base64');

    const response = await request(app)
      .post('/files')
      .send({ filename: 'report.pdf', mimeType: 'application/pdf', sha256: hex });

    expect(response.status).toBe(200);
    expect(storage.createUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ sha256: expectedBase64 }),
    );

    const claims = verifyUploadHandle(
      (response.body.fileHandle as string).slice('$uploadedFile:'.length),
      42,
      AUTH_SECRET,
    );
    expect(claims.sha256).toBe(expectedBase64);
  });

  it('sanitizes filenames so they cannot confuse the data URI or the storage key', async () => {
    const { app, storage } = makeApp({ auth: authenticatedUser });

    const response = await request(app)
      .post('/files')
      .send({ filename: '../etc;name=x,y/passwd.pdf', mimeType: 'application/pdf' });

    expect(response.status).toBe(200);

    const { key } = (storage.createUploadUrl as jest.Mock).mock.calls[0][0];
    const filenamePart = key.split('/').pop();
    expect(filenamePart).not.toMatch(/[;,/]/);
  });

  it('returns 500 without leaking details when the storage backend fails', async () => {
    const storage: UploadStorage = {
      createUploadUrl: jest.fn().mockRejectedValue(new Error('bucket is on fire')),
      download: jest.fn(),
    };
    const { app } = makeApp({ auth: authenticatedUser, storage });

    const response = await request(app)
      .post('/files')
      .send({ filename: 'report.pdf', mimeType: 'application/pdf' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Failed to create upload URL.' });
    expect(mockLogger).toHaveBeenCalledWith('Error', expect.stringContaining('bucket is on fire'));
  });
});
