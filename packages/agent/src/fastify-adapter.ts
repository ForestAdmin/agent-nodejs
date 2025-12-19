/* eslint-disable @typescript-eslint/no-explicit-any */
import type { HttpCallback } from './types';
import type { Logger } from '@forestadmin/datasource-toolkit';

interface FastifyState {
  registered: Promise<void> | null;
  pendingCallbacks: Array<{ callback: HttpCallback; prefix: string }>;
}

/**
 * Handles mounting Express-style middleware on Fastify instances.
 * Manages the complexity of different Fastify versions (v2, v3, v4) and
 * automatic registration of @fastify/express when needed.
 *
 * Uses a WeakMap to track state per Fastify instance, allowing the same
 * adapter to be used for multiple Fastify instances (v2, v3, v4).
 */
export default class FastifyAdapter {
  private readonly logger: Logger;
  private readonly fastifyStates = new WeakMap<any, FastifyState>();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Get or create state for a Fastify instance.
   */
  private getState(fastify: any): FastifyState {
    let state = this.fastifyStates.get(fastify);

    if (!state) {
      state = { registered: null, pendingCallbacks: [] };
      this.fastifyStates.set(fastify, state);
    }

    return state;
  }

  /**
   * Mount an Express-style callback on a Fastify instance.
   * Automatically handles @fastify/express registration if needed.
   */
  useCallback(fastify: any, callback: HttpCallback, prefix: string): void {
    // In Fastify v4+, fastify.use is undefined until @fastify/middie or @fastify/express is registered
    // In Fastify v2/v3 with middie/express already registered, fastify.use exists
    if (typeof fastify.use !== 'function') {
      this.queueAndRegister(fastify, callback, prefix);

      return;
    }

    try {
      fastify.use(prefix, callback);
    } catch (e) {
      // Fastify 3 throws FST_ERR_MISSING_MIDDLEWARE if middleware support isn't loaded
      if (e.code === 'FST_ERR_MISSING_MIDDLEWARE') {
        this.queueAndRegister(fastify, callback, prefix);
      } else {
        throw e;
      }
    }
  }

  /**
   * Queue a callback and register @fastify/express if not already done for this Fastify instance.
   */
  private queueAndRegister(fastify: any, callback: HttpCallback, prefix: string): void {
    const state = this.getState(fastify);
    state.pendingCallbacks.push({ callback, prefix });

    // Only register @fastify/express once per Fastify instance
    if (state.registered) {
      return;
    }

    // Store reference to pendingCallbacks for use in after() callback
    const { pendingCallbacks } = state;

    state.registered = new Promise<void>((resolve, reject) => {
      import('@fastify/express')
        .then(({ default: fastifyExpress }) => {
          fastify.register(fastifyExpress).after((err: Error | null) => {
            if (err) {
              this.logger('Error', err.message);
              reject(err);

              return;
            }

            // Register all pending callbacks now that @fastify/express is loaded
            this.registerPendingCallbacks(fastify, pendingCallbacks);
            state.pendingCallbacks = [];
            resolve();
          });
        })
        .catch(reject);
    });
  }

  /**
   * Register all pending callbacks with path-filtering wrappers.
   * Uses a wrapper that handles path filtering because @fastify/express's
   * path-based middleware has issues with kRoutePrefix in the after() context.
   */
  private registerPendingCallbacks(
    fastify: any,
    callbacks: Array<{ callback: HttpCallback; prefix: string }>,
  ): void {
    for (const pending of callbacks) {
      const wrappedCallback = this.createWrappedCallback(pending.callback, pending.prefix);
      fastify.use(wrappedCallback);
    }
  }

  /**
   * Create a wrapped callback that handles path filtering.
   * For root prefix ('/'), passes through directly.
   * For other prefixes, strips the prefix from URL before calling the callback.
   */
  private createWrappedCallback(callback: HttpCallback, prefix: string): HttpCallback {
    return (req: any, res: any, next: any) => {
      if (prefix === '/') {
        callback(req, res, next);
      } else if (req.url.startsWith(prefix)) {
        // Strip prefix from URL to simulate Express's prefix-based mounting behavior
        const originalUrl = req.url;
        req.url = req.url.slice(prefix.length) || '/';
        callback(req, res, () => {
          req.url = originalUrl;
          next();
        });
      } else {
        next();
      }
    };
  }
}
