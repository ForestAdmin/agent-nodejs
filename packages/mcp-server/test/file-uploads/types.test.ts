import type { UploadStorage } from '../../src/file-uploads/types';
import type { Logger } from '../../src/server';

import { resolveFileUploads } from '../../src/file-uploads/types';

const AUTH_SECRET = 'test-auth-secret';

const storage: UploadStorage = {
  createUploadUrl: jest.fn(),
  download: jest.fn(),
  getSize: jest.fn(),
};

describe('resolveFileUploads', () => {
  let logger: jest.MockedFunction<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = jest.fn();
  });

  it('returns undefined when the option is absent', () => {
    expect(resolveFileUploads(undefined, AUTH_SECRET, logger)).toBeUndefined();
  });

  it('applies the documented defaults', () => {
    const resolved = resolveFileUploads({ storage }, AUTH_SECRET, logger);

    expect(resolved).toMatchObject({
      storage,
      keyPrefix: 'mcp-uploads/',
      uploadUrlTtlSeconds: 15 * 60,
      handleTtlSeconds: 45 * 60,
      maxBytes: 20 * 1024 * 1024,
      authSecret: AUTH_SECRET,
    });
    expect(logger).not.toHaveBeenCalled();
  });

  it('keeps the values it is given', () => {
    const resolved = resolveFileUploads(
      {
        storage,
        keyPrefix: 'uploads/',
        uploadUrlTtlSeconds: 60,
        handleTtlSeconds: 120,
        maxBytes: 1024,
        maxConcurrentDownloads: 2,
      },
      AUTH_SECRET,
      logger,
    );

    expect(resolved).toMatchObject({
      keyPrefix: 'uploads/',
      uploadUrlTtlSeconds: 60,
      handleTtlSeconds: 120,
      maxBytes: 1024,
    });
  });

  it('rejects a missing storage backend at startup', () => {
    expect(() => resolveFileUploads({} as never, AUTH_SECRET, logger)).toThrow(
      'fileUploads.storage is required.',
    );
  });

  // A zero or negative limit used to queue every redemption with nothing left to release it,
  // hanging forever instead of failing.
  it.each([
    ['maxConcurrentDownloads', 0],
    ['maxConcurrentDownloads', -1],
    ['maxConcurrentDownloads', 1.5],
    ['maxBytes', 0],
    ['maxBytes', -10],
    ['uploadUrlTtlSeconds', 0],
    ['handleTtlSeconds', -60],
    ['handleTtlSeconds', 60.5],
  ])('rejects %s = %p at startup', (field, value) => {
    expect(() => resolveFileUploads({ storage, [field]: value }, AUTH_SECRET, logger)).toThrow(
      `Invalid fileUploads.${field} "${value}": it must be a positive integer.`,
    );
  });

  describe('when the handle cannot outlive the upload window', () => {
    it.each([
      ['shorter', 60],
      ['equal', 900],
    ])('warns when the handle ttl is %s', (_, handleTtlSeconds) => {
      resolveFileUploads(
        { storage, uploadUrlTtlSeconds: 900, handleTtlSeconds },
        AUTH_SECRET,
        logger,
      );

      expect(logger).toHaveBeenCalledWith(
        'Warn',
        expect.stringContaining(`fileUploads.handleTtlSeconds=${handleTtlSeconds}`),
      );
    });

    it('does not warn when the handle outlives it', () => {
      resolveFileUploads(
        { storage, uploadUrlTtlSeconds: 900, handleTtlSeconds: 901 },
        AUTH_SECRET,
        logger,
      );

      expect(logger).not.toHaveBeenCalled();
    });

    it('tolerates being called without a logger', () => {
      expect(() =>
        resolveFileUploads(
          { storage, uploadUrlTtlSeconds: 900, handleTtlSeconds: 60 },
          AUTH_SECRET,
        ),
      ).not.toThrow();
    });
  });
});
