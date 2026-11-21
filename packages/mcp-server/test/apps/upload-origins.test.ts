import {
  MAX_UPLOAD_ORIGINS,
  connectableOrigin,
  createUploadOrigins,
} from '../../src/apps/upload-origins';

describe('connectableOrigin', () => {
  it.each([
    ['an https url', 'https://bucket.example.com/key?X-Sig=abc', 'https://bucket.example.com'],
    [
      'an https url with a port',
      'https://agent.example:8443/mcp/uploads/k',
      'https://agent.example:8443',
    ],
    ['a local dev http url', 'http://localhost:3310/mcp/uploads/k', 'http://localhost:3310'],
  ])('keeps the origin of %s', (_, url, expected) => {
    expect(connectableOrigin(url)).toBe(expected);
  });

  it.each([
    ['a plain http url', 'http://bucket.example.com/key'],
    ['an http loopback address', 'http://127.0.0.1:3310/key'],
    ['a localhost lookalike', 'http://localhost.evil.example/key'],
    ['another scheme', 'ftp://bucket.example.com/key'],
    ['a data url', 'data:text/plain,hello'],
    ['an unparsable url', 'not a url'],
  ])('refuses %s', (_, url) => {
    expect(connectableOrigin(url)).toBeUndefined();
  });
});

describe('createUploadOrigins', () => {
  let logger: jest.Mock;

  beforeEach(() => {
    logger = jest.fn();
  });

  it('starts empty', () => {
    expect(createUploadOrigins(logger).list()).toEqual([]);
  });

  it('lists each origin once, in the order first seen', () => {
    const origins = createUploadOrigins(logger);

    origins.add('https://bucket.example.com/a?sig=1');
    origins.add('https://agent.example/mcp/uploads/b');
    origins.add('https://bucket.example.com/c?sig=2');

    expect(origins.list()).toEqual(['https://bucket.example.com', 'https://agent.example']);
    expect(logger).not.toHaveBeenCalled();
  });

  it('ignores a url it refuses, and warns', () => {
    const origins = createUploadOrigins(logger);

    origins.add('http://bucket.example.com/a?sig=secret');

    expect(origins.list()).toEqual([]);
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      'An upload URL is neither https nor http://localhost: the records view cannot upload to it.',
    );
  });

  it(`keeps the first ${MAX_UPLOAD_ORIGINS} origins once full, and warns`, () => {
    const origins = createUploadOrigins(logger);
    const hosts = Array.from({ length: MAX_UPLOAD_ORIGINS + 1 }, (_, i) => `https://h${i}.example`);

    hosts.forEach(host => origins.add(`${host}/key`));

    expect(origins.list()).toEqual(hosts.slice(0, MAX_UPLOAD_ORIGINS));
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      `The records view already allows ${MAX_UPLOAD_ORIGINS} upload origins: ` +
        `https://h${MAX_UPLOAD_ORIGINS}.example is not added.`,
    );
  });
});
