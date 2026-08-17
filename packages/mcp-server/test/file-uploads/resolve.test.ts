import type { UploadStorage } from '../../src/file-uploads/types';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

import * as crypto from 'crypto';

import { UPLOADED_FILE_PREFIX, signUploadHandle } from '../../src/file-uploads/handles';
import resolveUploadedFileValues from '../../src/file-uploads/resolve';
import { resolveFileUploads } from '../../src/file-uploads/types';

const AUTH_SECRET = 'test-auth-secret';

const authInfo = {
  token: 'token',
  clientId: '42',
  scopes: ['mcp:action'],
  extra: { userId: 42 },
} as unknown as AuthInfo;

function makeStorage(overrides: Partial<UploadStorage> = {}): UploadStorage {
  return {
    createUploadUrl: jest.fn().mockResolvedValue({ url: 'https://storage.example/put' }),
    download: jest.fn().mockResolvedValue(Buffer.from('file content')),
    ...overrides,
  };
}

function makeUploads(storage: UploadStorage, options: { maxBytes?: number } = {}) {
  return resolveFileUploads({ storage, ...options }, AUTH_SECRET);
}

function makeHandle(overrides: Partial<Parameters<typeof signUploadHandle>[0]> = {}): string {
  const handle = signUploadHandle(
    {
      key: 'mcp-uploads/uuid/report.pdf',
      name: 'report.pdf',
      mimeType: 'application/pdf',
      userId: 42,
      ...overrides,
    },
    AUTH_SECRET,
    60,
  );

  return `${UPLOADED_FILE_PREFIX}${handle}`;
}

describe('resolveUploadedFileValues', () => {
  it('returns values untouched when no value carries a handle', async () => {
    const storage = makeStorage();
    const values = { amount: 12, note: 'plain string' };

    const resolved = await resolveUploadedFileValues(values, authInfo, makeUploads(storage));

    expect(resolved).toBe(values);
    expect(storage.download).not.toHaveBeenCalled();
  });

  it('throws a configuration error when a handle is present but uploads are disabled', async () => {
    await expect(
      resolveUploadedFileValues({ document: makeHandle() }, authInfo, undefined),
    ).rejects.toThrow('File uploads are not configured on this server');
  });

  it('throws when there is no authenticated user to bind the handle to', async () => {
    await expect(
      resolveUploadedFileValues({ document: makeHandle() }, undefined, makeUploads(makeStorage())),
    ).rejects.toThrow('Cannot resolve uploaded files without an authenticated user');
  });

  it('replaces a handle with the data URI of the uploaded object', async () => {
    const storage = makeStorage({ download: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')) });

    const resolved = await resolveUploadedFileValues(
      { document: makeHandle(), note: 'untouched' },
      authInfo,
      makeUploads(storage),
    );

    expect(storage.download).toHaveBeenCalledWith('mcp-uploads/uuid/report.pdf');
    expect(resolved.document).toBe(
      `data:application/pdf;name=report.pdf;base64,${Buffer.from('%PDF-1.4').toString('base64')}`,
    );
    expect(resolved.note).toBe('untouched');
  });

  it('resolves handles inside array values and leaves other entries alone', async () => {
    const storage = makeStorage();

    const resolved = await resolveUploadedFileValues(
      { attachments: [makeHandle(), 'existing-value'] },
      authInfo,
      makeUploads(storage),
    );

    expect(resolved.attachments).toEqual([
      expect.stringMatching(/^data:application\/pdf;name=report\.pdf;base64,/),
      'existing-value',
    ]);
  });

  it('downloads a handle referenced by several fields only once', async () => {
    const storage = makeStorage();
    const handle = makeHandle();

    const resolved = await resolveUploadedFileValues(
      { front: handle, back: handle },
      authInfo,
      makeUploads(storage),
    );

    expect(storage.download).toHaveBeenCalledTimes(1);
    expect(resolved.front).toBe(resolved.back);
  });

  it('rejects a handle issued to another user', async () => {
    await expect(
      resolveUploadedFileValues(
        { document: makeHandle({ userId: 999 }) },
        authInfo,
        makeUploads(makeStorage()),
      ),
    ).rejects.toThrow('Handle was issued to another user');
  });

  it('rejects an oversized upload without downloading it when the backend reports a size', async () => {
    const storage = makeStorage({ getSize: jest.fn().mockResolvedValue(50 * 1024 * 1024) });

    await expect(
      resolveUploadedFileValues({ document: makeHandle() }, authInfo, makeUploads(storage)),
    ).rejects.toThrow('above the 20971520 byte limit');

    expect(storage.download).not.toHaveBeenCalled();
  });

  it('rejects an oversized upload after download when the backend cannot report a size', async () => {
    const storage = makeStorage({
      download: jest.fn().mockResolvedValue(Buffer.alloc(11)),
    });

    await expect(
      resolveUploadedFileValues(
        { document: makeHandle() },
        authInfo,
        makeUploads(storage, { maxBytes: 10 }),
      ),
    ).rejects.toThrow('above the 10 byte limit');
  });

  it('rejects an empty upload with a hint about the PUT step', async () => {
    const storage = makeStorage({ download: jest.fn().mockResolvedValue(Buffer.alloc(0)) });

    await expect(
      resolveUploadedFileValues({ document: makeHandle() }, authInfo, makeUploads(storage)),
    ).rejects.toThrow('Uploaded file is empty');
  });

  it('rejects content that does not match the sha256 the handle was pinned to', async () => {
    const pinned = crypto.createHash('sha256').update('original content').digest('base64');
    const storage = makeStorage({
      download: jest.fn().mockResolvedValue(Buffer.from('substituted content')),
    });

    await expect(
      resolveUploadedFileValues(
        { document: makeHandle({ sha256: pinned }) },
        authInfo,
        makeUploads(storage),
      ),
    ).rejects.toThrow('does not match the sha256 it was pinned to');
  });

  it('accepts content matching the pinned sha256', async () => {
    const content = Buffer.from('original content');
    const pinned = crypto.createHash('sha256').update(new Uint8Array(content)).digest('base64');
    const storage = makeStorage({ download: jest.fn().mockResolvedValue(content) });

    const resolved = await resolveUploadedFileValues(
      { document: makeHandle({ sha256: pinned }) },
      authInfo,
      makeUploads(storage),
    );

    expect(resolved.document).toMatch(/^data:application\/pdf/);
  });

  it('bounds concurrent downloads to maxConcurrentDownloads', async () => {
    let active = 0;
    let peak = 0;

    const storage = makeStorage({
      download: jest.fn().mockImplementation(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise(resolve => {
          setTimeout(resolve, 5);
        });
        active -= 1;

        return Buffer.from('file content');
      }),
    });

    const uploads = resolveFileUploads({ storage, maxConcurrentDownloads: 2 }, AUTH_SECRET);

    const values = Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [
        `file_${i}`,
        makeHandle({ key: `mcp-uploads/uuid/file-${i}.pdf` }),
      ]),
    );

    await resolveUploadedFileValues(values, authInfo, uploads);

    expect(storage.download).toHaveBeenCalledTimes(6);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
