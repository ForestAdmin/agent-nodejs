/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@forestadmin/datasource-toolkit';

import fastifyExpress from '@fastify/express';

import { HttpCallback } from './types';

/**
 * Handles mounting Express-style middleware on Fastify instances.
 * Manages the complexity of different Fastify versions (v2, v3, v4) and
 * automatic registration of @fastify/express when needed.
 */
export default class FastifyAdapter {
  private fastifyExpressRegistered: Promise<void> | null = null;
  private pendingCallbacks: Array<{ callback: HttpCallback; prefix: string }> = [];
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
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
   * Queue a callback and register @fastify/express if not already done.
   * This is called when fastify.use is not available or throws FST_ERR_MISSING_MIDDLEWARE.
   */
  private queueAndRegister(fastify: any, callback: HttpCallback, prefix: string): void {
    this.pendingCallbacks.push({ callback, prefix });

    // Only register @fastify/express once
    if (this.fastifyExpressRegistered) {
      return;
    }

    // Store reference to pendingCallbacks for use in after() callback
    const { pendingCallbacks } = this;

    this.fastifyExpressRegistered = new Promise<void>((resolve, reject) => {
      fastify.register(fastifyExpress).after((err: Error | null) => {
        if (err) {
          this.logger('Error', err.message);
          reject(err);

          return;
        }

        // Register all pending callbacks now that @fastify/express is loaded
        this.registerPendingCallbacks(fastify, pendingCallbacks);
        this.pendingCallbacks = [];
        resolve();
      });
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
