import type { Express } from 'express';
import type { Middleware } from 'koa';

type HttpCallback = (
  req: NodeJS.ReadableStream,
  res: NodeJS.WritableStream,
  next?: () => void,
) => void;

/**
 * Wraps an Express app (or any Connect-style callback) as a Koa middleware.
 *
 * The Express app will handle the request if it matches its routes.
 * If the Express app calls next(), control passes back to Koa.
 *
 * @param expressApp - Express application or HTTP callback
 * @param shouldHandle - Optional function to filter which requests go to Express
 * @returns Koa middleware
 *
 * @example
 * const mcpApp = express();
 * mcpApp.post('/mcp', ...);
 *
 * const koaApp = new Koa();
 * koaApp.use(expressToKoa(mcpApp, url => url.startsWith('/mcp')));
 */
export default function expressToKoa(
  expressApp: Express | HttpCallback,
  shouldHandle?: (url: string) => boolean,
): Middleware {
  return async (ctx, next) => {
    const url = ctx.url || '/';

    // Skip if shouldHandle returns false
    if (shouldHandle && !shouldHandle(url)) {
      await next();

      return;
    }

    // Let Express handle the request
    const handled = await new Promise<boolean>(resolve => {
      // Tell Koa not to respond - Express will handle it
      ctx.respond = false;

      const callback = expressApp as HttpCallback;
      callback(ctx.req, ctx.res, () => {
        // Express called next() - it didn't handle the request
        ctx.respond = true;
        resolve(false);
      });

      // If response finishes, Express handled it
      ctx.res.once('finish', () => resolve(true));
      ctx.res.once('close', () => resolve(true));
    });

    // If Express didn't handle it, continue with Koa
    if (!handled) {
      await next();
    }
  };
}
