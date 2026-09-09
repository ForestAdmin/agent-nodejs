import RootMiddleware from '../src/root-middleware';

describe('RootMiddleware', () => {
  function makeCtx(url: string) {
    return { url, req: { url }, res: { once: jest.fn() }, respond: true } as any;
  }

  describe('getExpressMiddleware', () => {
    it('should hand the request to the handler whose matcher claims the url', () => {
      const middleware = new RootMiddleware(jest.fn());
      const mcp = jest.fn();
      const bff = jest.fn();
      const req = { url: '/bff/agent/v1' } as any;
      const res = {} as any;
      const next = jest.fn();
      middleware.set('mcp', { callback: mcp, matches: url => url.startsWith('/mcp') });
      middleware.set('bff', { callback: bff, matches: url => url.startsWith('/bff') });

      middleware.getExpressMiddleware()(req, res, next);

      expect(bff).toHaveBeenCalledWith(req, res, next);
      expect(mcp).not.toHaveBeenCalled();
    });

    it('should pass an unclaimed url straight to the host', () => {
      const middleware = new RootMiddleware(jest.fn());
      const claimed = jest.fn();
      const next = jest.fn();
      middleware.set('mcp', { callback: claimed, matches: url => url.startsWith('/mcp') });

      middleware.getExpressMiddleware()({ url: '/api/v1/forest' } as any, {} as any, next);

      expect(claimed).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should claim nothing beyond what the registered matcher declares', () => {
      const middleware = new RootMiddleware(jest.fn());
      const claimed = jest.fn();
      const next = jest.fn();
      middleware.set('mcp', { callback: claimed, matches: url => url.startsWith('/custom') });

      middleware.getExpressMiddleware()({ url: '/mcp' } as any, {} as any, next);

      expect(claimed).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should name the handler that claimed the url', () => {
      const logger = jest.fn();
      const middleware = new RootMiddleware(logger);
      middleware.set('mcp', { callback: jest.fn(), matches: url => url.startsWith('/mcp') });

      middleware.getExpressMiddleware()({ url: '/mcp' } as any, {} as any, jest.fn());

      expect(logger).toHaveBeenCalledWith('Debug', "Root middleware: 'mcp' claims /mcp");
    });
  });

  describe('getKoaMiddleware', () => {
    it('should leave an unclaimed url to the next Koa middleware', async () => {
      const middleware = new RootMiddleware(jest.fn());
      const claimed = jest.fn();
      const next = jest.fn().mockResolvedValue(undefined);
      middleware.set('mcp', { callback: claimed, matches: url => url.startsWith('/mcp') });

      await middleware.getKoaMiddleware()(makeCtx('/api/v1/forest'), next as any);

      expect(claimed).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should offer a claimed url to its handler with the node request, response and a next', async () => {
      const middleware = new RootMiddleware(jest.fn());
      const claimed = jest.fn((_req, _res, done) => done());
      const ctx = makeCtx('/mcp');
      middleware.set('mcp', { callback: claimed as any, matches: url => url.startsWith('/mcp') });

      await middleware.getKoaMiddleware()(ctx, jest.fn().mockResolvedValue(undefined) as any);

      expect(claimed).toHaveBeenCalledWith(ctx.req, ctx.res, expect.any(Function));
    });
  });

  describe('getCallback', () => {
    it('should be null while nothing is registered, so the host needs no detour', () => {
      expect(new RootMiddleware(jest.fn()).getCallback()).toBeNull();
    });

    it('should be null again once the last handler is removed', () => {
      const middleware = new RootMiddleware(jest.fn());
      middleware.set('mcp', { callback: jest.fn(), matches: () => true });

      middleware.set('mcp', null);

      expect(middleware.getCallback()).toBeNull();
    });

    it('should dispatch to a registered handler', () => {
      const middleware = new RootMiddleware(jest.fn());
      const claimed = jest.fn();
      const req = { url: '/mcp' } as any;
      const res = {} as any;
      const next = jest.fn();
      middleware.set('mcp', { callback: claimed, matches: url => url.startsWith('/mcp') });

      middleware.getCallback()?.(req, res, next);

      expect(claimed).toHaveBeenCalledWith(req, res, next);
    });
  });
});
