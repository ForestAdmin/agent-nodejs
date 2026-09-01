import type { HttpCallback } from './types';
import type Koa from 'koa';

import expressToKoa from './utils/express-to-koa';

export type RouteMatcher = (url: string) => boolean;

interface Handler {
  callback: HttpCallback;
  matches: RouteMatcher;
}

/**
 * Handlers the agent serves at the root of the host application rather than under its own router
 * prefix — the MCP server, the embedded BFF. Each one claims a set of paths through its matcher;
 * anything else falls through to the host, untouched.
 *
 * Registered by name so a handler can be replaced or removed (a restart, a `stop()`) without the
 * mount points having to know what is registered.
 */
export default class RootMiddleware {
  private readonly handlers = new Map<string, Handler>();

  set(name: string, callback: HttpCallback | null, matches: RouteMatcher): void {
    if (callback) this.handlers.set(name, { callback, matches });
    else this.handlers.delete(name);
  }

  private handlerFor(url: string): HttpCallback | null {
    for (const { callback, matches } of this.handlers.values()) {
      if (matches(url)) return callback;
    }

    return null;
  }

  /**
   * Connect-style middleware. A handler that decides not to answer calls `next()`, which passes the
   * request on to the host exactly as if nothing had been registered.
   */
  getExpressMiddleware(): HttpCallback {
    return (req, res, next) => {
      const handler = this.handlerFor(req.url ?? '/');

      if (handler) {
        handler(req, res, next);

        return;
      }

      next?.();
    };
  }

  getKoaMiddleware(): Koa.Middleware {
    return expressToKoa(this.getExpressMiddleware(), url => this.handlerFor(url) !== null);
  }

  /** The combined callback, or null when nothing is registered and the host needs no detour. */
  getCallback(): HttpCallback | null {
    if (this.handlers.size === 0) return null;

    return this.getExpressMiddleware();
  }
}
