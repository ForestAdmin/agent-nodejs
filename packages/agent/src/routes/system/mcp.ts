import Router from '@koa/router';
import { Context } from 'koa';

import { HttpCallback, RouteType } from '../../types';
import BaseRoute from '../base-route';

/**
 * MCP Route Handler
 *
 * This route handles all MCP-related endpoints including:
 * - /.well-known/* (OAuth metadata discovery per RFC 9728)
 * - /oauth/* (authorization and token endpoints)
 * - /mcp (main MCP endpoint)
 *
 * The router is mounted at root level (no prefix) to support .well-known requirements.
 */
export default class McpRoute extends BaseRoute {
  type = RouteType.PublicRoute;

  private httpCallback: HttpCallback | null = null;

  setHttpCallback(callback: HttpCallback): void {
    this.httpCallback = callback;
  }

  setupRoutes(router: Router): void {
    // Only setup routes if MCP server is enabled
    if (!this.options.mcpServer?.enabled) {
      return;
    }

    // Handle all MCP-related routes at root level (no prefix)
    // This includes .well-known for OAuth metadata discovery per RFC 9728
    const mcpRoutes = ['/.well-known/(.*)', '/oauth/(.*)', '/mcp', '/mcp/(.*)'];

    mcpRoutes.forEach(route => {
      router.all(route, this.handleRequest.bind(this));
    });
  }

  private async handleRequest(ctx: Context): Promise<void> {
    if (!this.httpCallback) {
      ctx.status = 503;
      ctx.body = { error: 'MCP server not initialized' };

      return;
    }

    // Use the HTTP callback directly with the raw Node.js request/response
    await new Promise<void>(resolve => {
      // Mark that we'll handle the response manually
      ctx.respond = false;

      let resolved = false;
      const safeResolve = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      // Listen for response end to resolve the promise
      // Must be set up before calling the callback
      ctx.res.once('finish', safeResolve);
      ctx.res.once('close', safeResolve);

      // Enhance the original request object with Express-compatible properties
      // We must use the original ctx.req to preserve stream internals
      const req = ctx.req as typeof ctx.req & {
        body?: unknown;
        _body?: boolean;
        _parsedBody?: boolean;
        query?: Record<string, unknown>;
        path?: string;
        protocol?: string;
        secure?: boolean;
        ip?: string;
        hostname?: string;
        get?: (name: string) => string | undefined;
        _readableState?: { pipes?: unknown[] | null };
      };

      // Ensure _readableState.pipes exists to prevent finalhandler/unpipe errors
      // Koa may have consumed the stream leaving pipes undefined
      if (req._readableState && req._readableState.pipes === undefined) {
        req._readableState.pipes = null;
      }

      // Already-parsed body from Koa's body parser
      req.body = ctx.request.body;
      // Mark body as already read to prevent body-parser from trying to read the stream
      req._body = true;
      req._parsedBody = true;
      // Express-specific properties
      req.query = ctx.query;
      req.path = ctx.path;
      req.protocol = ctx.protocol;
      req.secure = ctx.secure;
      req.ip = ctx.ip;
      req.hostname = ctx.hostname;
      // Express helper method
      req.get = (name: string) => ctx.headers[name.toLowerCase()] as string | undefined;

      // Call the HTTP callback with the enhanced request
      this.httpCallback!(req, ctx.res, () => {
        // If next() is called, it means the callback didn't handle the request
        // This shouldn't happen since we only route MCP paths here
        ctx.respond = true;
        ctx.status = 404;
        ctx.body = { error: 'Not found' };
        safeResolve();
      });
    });
  }
}
