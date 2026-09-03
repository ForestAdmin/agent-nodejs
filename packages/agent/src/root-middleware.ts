import type { HttpCallback, RootHandler } from './types';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type Koa from 'koa';

import expressToKoa from './utils/express-to-koa';

/**
 * Handlers the agent serves at the root of the host application rather than under its own router
 * prefix — the MCP server, the embedded BFF. Each one claims a set of paths through its matcher;
 * anything else falls through to the host, untouched.
 *
 * Registered by name so a handler can be replaced or removed on a restart without the mount points
 * having to know what is registered.
 */
export default class RootMiddleware {
  private readonly handlers = new Map<string, RootHandler>();
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  set(name: string, handler: RootHandler | null): void {
    if (handler) this.handlers.set(name, handler);
    else this.handlers.delete(name);
  }

  private entryFor(url: string): [string, RootHandler] | null {
    for (const entry of this.handlers) {
      if (entry[1].matches(url)) return entry;
    }

    return null;
  }

  /**
   * First registered matcher wins. Overlapping matchers cannot be caught at registration — the
   * predicates are opaque — so the winner is named here instead: a request answered by the wrong
   * handler is otherwise indistinguishable from one whose route was never registered.
   */
  private handlerFor(url: string): HttpCallback | null {
    const entry = this.entryFor(url);

    if (!entry) return null;

    this.logger('Debug', `Root middleware: '${entry[0]}' claims ${url}`);

    return entry[1].callback;
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
    return expressToKoa(this.getExpressMiddleware(), url => this.entryFor(url) !== null);
  }

  /** The combined callback, or null when nothing is registered and the host needs no detour. */
  getCallback(): HttpCallback | null {
    if (this.handlers.size === 0) return null;

    return this.getExpressMiddleware();
  }
}
