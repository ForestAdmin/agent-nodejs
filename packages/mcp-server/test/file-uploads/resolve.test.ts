import type { UploadStorage } from '../../src/file-uploads/types';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

import * as crypto from 'crypto';

import { UPLOADED_FILE_PREFIX } from '../../src/file-uploads/file-reference';
import { signUploadHandle } from '../../src/file-uploads/handles';
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
    download: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
    getSize: jest.fn().mockResolvedValue(undefined),
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
  it('returns the values untouched when none carries a reference', async () => {
    const storage = makeStorage();
    const values = { amount: 12, note: 'plain string' };

    const resolved = await resolveUploadedFileValues(values, authInfo, makeUploads(storage));

    expect(resolved).toBe(values);
    expect(storage.download).not.toHaveBeenCalled();
  });

  it('throws a configuration error when a reference is present but uploads are disabled', async () => {
    await expect(
      resolveUploadedFileValues({ document: makeHandle() }, authInfo, undefined),
    ).rejects.toThrow('File uploads are not configured on this server');
  });

  it('throws when there is no authenticated user to bind the reference to', async () => {
    await expect(
      resolveUploadedFileValues({ document: makeHandle() }, undefined, makeUploads(makeStorage())),
    ).rejects.toThrow('Cannot resolve uploaded files without an authenticated user');
  });

  it('replaces a reference with the uploaded file, leaving the name unencoded', async () => {
    const storage = makeStorage();

    const resolved = await resolveUploadedFileValues(
      { document: makeHandle({ name: 'rapport final.pdf' }), note: 'untouched' },
      authInfo,
      makeUploads(storage),
    );

    expect(storage.download).toHaveBeenCalledWith('mcp-uploads/uuid/report.pdf');
    expect(resolved.document).toEqual({
      buffer: Buffer.from('%PDF-1.4'),
      mimeType: 'application/pdf',
      name: 'rapport final.pdf',
    });
    expect(resolved.note).toBe('untouched');
  });

  it('resolves references inside array values and leaves other entries alone', async () => {
    const resolved = await resolveUploadedFileValues(
      { attachments: [makeHandle(), 'existing-value'] },
      authInfo,
      makeUploads(makeStorage()),
    );

    expect(resolved.attachments).toEqual([
      expect.objectContaining({ name: 'report.pdf', mimeType: 'application/pdf' }),
      'existing-value',
    ]);
  });

  it('downloads a reference used by several fields only once', async () => {
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
    const storage = makeStorage({ download: jest.fn().mockResolvedValue(Buffer.alloc(11)) });

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
    ).rejects.toThrow('Field "document": uploaded file is empty');
  });

  it('rejects content that does not match the sha256 the handle was pinned to', async () => {
    const pinned = crypto.createHash('sha256').update('original content').digest('base64');
    const storage = makeStorage({
      download: jest.fn().mockResolvedValue(Buffer.from('substituted content')),
    });

    await expect(
      resolveUploadedFileValues(
        { document: makeHandle({ sha256Base64: pinned }) },
        authInfo,
        makeUploads(storage),
      ),
    ).rejects.toThrow('Field "document": uploaded file does not match the sha256 it was pinned to');
  });

  it('accepts content matching the pinned sha256', async () => {
    const content = Buffer.from('original content');
    const pinned = crypto.createHash('sha256').update(new Uint8Array(content)).digest('base64');
    const storage = makeStorage({ download: jest.fn().mockResolvedValue(content) });

    const resolved = await resolveUploadedFileValues(
      { document: makeHandle({ sha256Base64: pinned }) },
      authInfo,
      makeUploads(storage),
    );

    expect(resolved.document).toEqual(expect.objectContaining({ buffer: content }));
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

  it('names the field in the error, so the model knows which file to re-upload', async () => {
    const storage = makeStorage({ download: jest.fn().mockResolvedValue(Buffer.alloc(0)) });

    await expect(
      resolveUploadedFileValues({ invoice: makeHandle() }, authInfo, makeUploads(storage)),
    ).rejects.toThrow('Field "invoice"');
  });

  it('enforces the limit on the downloaded bytes when getSize under-reports', async () => {
    const storage = makeStorage({
      getSize: jest.fn().mockResolvedValue(5),
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

  it.each([
    ['null', null],
    ['NaN', NaN],
  ])('still enforces the limit when getSize answers %s', async (_, size) => {
    const storage = makeStorage({
      getSize: jest.fn().mockResolvedValue(size),
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

  it('accepts a file of exactly maxBytes', async () => {
    const storage = makeStorage({ download: jest.fn().mockResolvedValue(Buffer.alloc(10)) });

    const resolved = await resolveUploadedFileValues(
      { document: makeHandle() },
      authInfo,
      makeUploads(storage, { maxBytes: 10 }),
    );

    expect((resolved.document as { buffer: Buffer }).buffer).toHaveLength(10);
  });

  it('rejects a forged handle without spending a download slot', async () => {
    const storage = makeStorage();

    await expect(
      resolveUploadedFileValues(
        { document: makeHandle({ userId: 999 }) },
        authInfo,
        makeUploads(storage),
      ),
    ).rejects.toThrow('Handle was issued to another user');

    expect(storage.getSize).not.toHaveBeenCalled();
    expect(storage.download).not.toHaveBeenCalled();
  });

  // A contract-honouring backend rejects a missing object, so this is what "never uploaded"
  // actually looks like — the empty-buffer branch only fires on backends that create the object.
  it('turns a download rejection into an actionable message, keeping the cause', async () => {
    const storage = makeStorage({
      download: jest.fn().mockRejectedValue(new Error('NoSuchKey')),
    });

    await expect(
      resolveUploadedFileValues({ document: makeHandle() }, authInfo, makeUploads(storage)),
    ).rejects.toThrow(
      'Field "document": could not read the uploaded file. ' +
        'Did the upload to uploadUrl succeed? (NoSuchKey)',
    );
  });

  // Without a bound, a backend that stops answering holds its slot while the calling client's own
  // timeout fires, so the failure would be invisible here.
  it('gives up on a storage read that never answers', async () => {
    const storage = makeStorage({ download: jest.fn().mockReturnValue(new Promise(() => {})) });
    const uploads = resolveFileUploads({ storage, downloadTimeoutSeconds: 1 }, AUTH_SECRET);

    await expect(
      resolveUploadedFileValues({ document: makeHandle() }, authInfo, uploads),
    ).rejects.toThrow('timed out after 1s');
  });

  it('gives up on a size probe that never answers', async () => {
    const storage = makeStorage({ getSize: jest.fn().mockReturnValue(new Promise(() => {})) });
    const uploads = resolveFileUploads({ storage, downloadTimeoutSeconds: 1 }, AUTH_SECRET);

    await expect(
      resolveUploadedFileValues({ document: makeHandle() }, authInfo, uploads),
    ).rejects.toThrow('timed out after 1s');
    expect(storage.download).not.toHaveBeenCalled();
  });

  it('frees the slot after a timeout, so later redemptions still work', async () => {
    let answer = false;
    const storage = makeStorage({
      download: jest
        .fn()
        .mockImplementation(() =>
          answer ? Promise.resolve(Buffer.from('ok')) : new Promise(() => {}),
        ),
    });
    const uploads = resolveFileUploads(
      { storage, maxConcurrentDownloads: 1, downloadTimeoutSeconds: 1 },
      AUTH_SECRET,
    );

    await expect(
      resolveUploadedFileValues({ document: makeHandle() }, authInfo, uploads),
    ).rejects.toThrow('timed out');

    answer = true;
    const resolved = await resolveUploadedFileValues({ document: makeHandle() }, authInfo, uploads);

    expect((resolved.document as { buffer: Buffer }).buffer.toString()).toBe('ok');
  });
});
