import claimsBffPath from '../src/claims-bff-path';

describe('claimsBffPath', () => {
  describe.each([true, false])('with docs %p', docs => {
    it.each(['/agent', '/agent/v1/books/list', '/agent/openapi.json', '/health'])(
      'should claim %p',
      pathname => {
        expect(claimsBffPath(pathname, { docs })).toBe(true);
      },
    );

    it.each([
      '/',
      '',
      '/agents',
      '/agentx/v1',
      '/health/',
      '/healthz',
      '/health/live',
      '/oauth/token',
      '/oauth/authorize',
      '/docs/other',
      '/docsx',
      '/bff/agent/v1/books/list',
    ])('should not claim %p', pathname => {
      expect(claimsBffPath(pathname, { docs })).toBe(false);
    });
  });

  it.each(['/docs', '/docs/redoc.standalone.js'])('should claim %p when docs are on', pathname => {
    expect(claimsBffPath(pathname, { docs: true })).toBe(true);
  });

  it.each(['/docs', '/docs/redoc.standalone.js'])(
    'should not claim %p when docs are off',
    pathname => {
      expect(claimsBffPath(pathname, { docs: false })).toBe(false);
    },
  );
});
