import McpMiddleware from '../src/mcp-middleware';

describe('McpMiddleware', () => {
  function makeCtx(url: string) {
    return { url, req: {}, res: { once: jest.fn() }, respond: true } as any;
  }

  test('getKoaMiddleware gates requests with the custom route matcher', async () => {
    const middleware = new McpMiddleware();
    const callback = jest.fn((req, res, next) => next());
    middleware.setCallback(callback, url => url.startsWith('/custom'));

    const koaMiddleware = middleware.getKoaMiddleware();

    await koaMiddleware(makeCtx('/mcp'), jest.fn().mockResolvedValue(undefined) as any);
    expect(callback).not.toHaveBeenCalled();

    await koaMiddleware(makeCtx('/custom/x'), jest.fn().mockResolvedValue(undefined) as any);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('falls back to the default root matcher when none is provided', async () => {
    const middleware = new McpMiddleware();
    const callback = jest.fn((req, res, next) => next());
    middleware.setCallback(callback);

    const koaMiddleware = middleware.getKoaMiddleware();

    await koaMiddleware(makeCtx('/api/other'), jest.fn().mockResolvedValue(undefined) as any);
    expect(callback).not.toHaveBeenCalled();

    await koaMiddleware(makeCtx('/mcp'), jest.fn().mockResolvedValue(undefined) as any);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
