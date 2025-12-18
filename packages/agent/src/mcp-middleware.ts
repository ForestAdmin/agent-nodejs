import Koa from 'koa';

import { HttpCallback } from './types';
import expressToKoa from './utils/express-to-koa';

/**
 * MCP route patterns that should be intercepted by the MCP middleware.
 */
const MCP_ROUTE_PATTERNS = ['/.well-known/', '/oauth/', '/mcp'];

/**
 * Check if a URL matches any MCP route pattern.
 */
function isMcpRoute(url: string): boolean {
  return MCP_ROUTE_PATTERNS.some(pattern => url.startsWith(pattern));
}

/**
 * Factory functions for creating MCP middleware for different frameworks.
 * MCP middleware intercepts MCP-specific routes (/.well-known/*, /oauth/*, /mcp)
 * and forwards them to the MCP callback, while passing through other routes.
 */
export default class McpMiddleware {
  private mcpHttpCallback: HttpCallback | null = null;

  /**
   * Set the MCP HTTP callback. Call this before using the middleware.
   */
  setCallback(callback: HttpCallback | null): void {
    this.mcpHttpCallback = callback;
  }

  /**
   * Get the current MCP HTTP callback.
   */
  getCallback(): HttpCallback | null {
    return this.mcpHttpCallback;
  }

  /**
   * Get an Express/Connect-style middleware that forwards requests to the MCP callback.
   * The MCP callback handles path filtering and calls next() for non-MCP routes.
   */
  getExpressMiddleware(): HttpCallback {
    return (req, res, next) => {
      if (this.mcpHttpCallback) {
        this.mcpHttpCallback(req, res, next);
      } else if (next) {
        next();
      }
    };
  }

  /**
   * Get a Koa middleware that forwards requests to the MCP callback.
   * Uses expressToKoa wrapper for proper Koa integration.
   */
  getKoaMiddleware(): Koa.Middleware {
    return expressToKoa(
      (req, res, next) => {
        if (this.mcpHttpCallback) {
          this.mcpHttpCallback(req, res, next);
        } else if (next) {
          next();
        }
      },
      // MCP routes are at root: /.well-known/*, /oauth/*, /mcp
      isMcpRoute,
    );
  }
}
