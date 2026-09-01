/* eslint-disable @typescript-eslint/no-explicit-any */
import RootMiddleware from '../src/root-middleware';

describe('RootMiddleware', () => {
  function makeCtx(url: string) {
    return { url, req: { url }, res: { once: jest.fn() }, respond: true } as any;
  }

  describe('getExpressMiddleware', () => {
    it('should hand the request to the handler whose matcher claims the url', () => {
      const middleware = new RootMiddleware();
      const mcp = jest.fn();
      const bff = jest.fn();
      middleware.set('mcp', mcp, url => url.startsWith('/mcp'));
      middleware.set('bff', bff, url => url.startsWith('/bff'));

      middleware.getExpressMiddleware()({ url: '/bff/agent/v1' } as any, {} as any, jest.fn());

      expect(bff).toHaveBeenCalled();
      expect(mcp).not.toHaveBeenCalled();
    });

    it('should pass an unclaimed url straight to the host', () => {
      const middleware = new RootMiddleware();
      const claimed = jest.fn();
      const next = jest.fn();
      middleware.set('mcp', claimed, url => url.startsWith('/mcp'));

      middleware.getExpressMiddleware()({ url: '/api/v1/forest' } as any, {} as any, next);

      expect(claimed).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getKoaMiddleware', () => {
    it('should leave an unclaimed url to the next Koa middleware', async () => {
      const middleware = new RootMiddleware();
      const claimed = jest.fn();
      const next = jest.fn().mockResolvedValue(undefined);
      middleware.set('mcp', claimed, url => url.startsWith('/mcp'));

      await middleware.getKoaMiddleware()(makeCtx('/api/v1/forest'), next as any);

      expect(claimed).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should offer a claimed url to its handler', async () => {
      const middleware = new RootMiddleware();
      const claimed = jest.fn((_req, _res, done) => done());
      middleware.set('mcp', claimed as any, url => url.startsWith('/mcp'));

      await middleware.getKoaMiddleware()(
        makeCtx('/mcp'),
        jest.fn().mockResolvedValue(undefined) as any,
      );

      expect(claimed).toHaveBeenCalled();
    });
  });

  describe('getCallback', () => {
    it('should be null while nothing is registered, so the host needs no detour', () => {
      expect(new RootMiddleware().getCallback()).toBeNull();
    });

    it('should be null again once the last handler is removed', () => {
      const middleware = new RootMiddleware();
      middleware.set('mcp', jest.fn(), () => true);

      middleware.set('mcp', null, () => true);

      expect(middleware.getCallback()).toBeNull();
    });

    it('should dispatch to a registered handler', () => {
      const middleware = new RootMiddleware();
      const claimed = jest.fn();
      middleware.set('mcp', claimed, url => url.startsWith('/mcp'));

      middleware.getCallback()?.({ url: '/mcp' } as any, {} as any, jest.fn());

      expect(claimed).toHaveBeenCalled();
    });
  });
});
