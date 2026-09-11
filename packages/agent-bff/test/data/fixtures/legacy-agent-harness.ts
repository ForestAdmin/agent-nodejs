import type { Logger } from '../../../src/ports/logger-port';
import type { SchemaFetcher } from '../../../src/read-model/forest-schema-client';
import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';
import type { Server } from 'http';

import { bodyParser } from '@koa/bodyparser';
import http from 'http';
import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import net from 'net';

import { createHttpTransport } from '../../../src/agent/agent-transport';
import createDataRoutesMiddleware from '../../../src/data/data-routes-middleware';
import createErrorMiddleware from '../../../src/http/error-middleware';
import CapabilitiesCache from '../../../src/read-model/capabilities-cache';
import ReadModelStore from '../../../src/read-model/read-model-store';
import SchemaCache from '../../../src/read-model/schema-cache';

export const AUTH_SECRET = 'b0bdf0a639c16bae8851dd24ee3d79ef0a352e957c5b86cb';

export async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as net.AddressInfo;

      server.close(() => resolve(port));
    });
  });
}

const TIMEZONE = 'Europe/Paris';

/** The apimap a forest-express-sequelize agent pushes: per-field flags, no capabilities route. */
export const LEGACY_SCHEMA = [
  {
    name: 'Article',
    fields: [
      { field: 'id', type: 'Number', isPrimaryKey: true, isFilterable: true, isSortable: true },
      { field: 'title', type: 'String', isFilterable: true, isSortable: true },
      { field: 'createdAt', type: 'Date', isFilterable: true, isSortable: true },
      { field: 'computed', type: 'String', isFilterable: false, isSortable: false },
      { field: 'author', type: 'Number', relationship: 'BelongsTo', reference: 'User.id' },
      { field: 'comments', type: ['Number'], relationship: 'HasMany', reference: 'Comment.id' },
    ],
  },
] as unknown as ForestSchemaCollection[];

export interface LegacyAgent {
  url: string;
  stop: () => Promise<void>;
  /** Every request the agent saw, so a test can assert what actually went on the wire. */
  seen: { method: string; path: string; query: URLSearchParams }[];
  capabilitiesCalls: () => number;
}

/**
 * A stand-in for a v1 liana: it answers the capabilities route the way Express answers an unknown
 * route -- 404 with an HTML body -- and serves records on the JSON:API list route.
 */
export async function startLegacyAgent(): Promise<LegacyAgent> {
  const port = await findFreePort();
  const seen: LegacyAgent['seen'] = [];

  const server: Server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    seen.push({ method: request.method ?? 'GET', path: url.pathname, query: url.searchParams });

    if (url.pathname === '/forest/_internal/capabilities') {
      response.writeHead(404, { 'content-type': 'text/html' });
      response.end(
        '<!DOCTYPE html>\n<html lang="en">\n<pre>Cannot POST /forest/_internal/capabilities</pre>\n</html>\n',
      );

      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        data: [{ type: 'Article', id: '1', attributes: { id: 1, title: 'Article 1' } }],
      }),
    );
  });

  await new Promise<void>(resolve => {
    server.listen(port, resolve);
  });

  return {
    url: `http://localhost:${port}`,
    stop: () =>
      new Promise<void>(resolve => {
        server.close(() => resolve());
      }),
    seen,
    capabilitiesCalls: () =>
      seen.filter(entry => entry.path === '/forest/_internal/capabilities').length,
  };
}

export function buildLegacyApp(agentUrl: string, { liana }: { liana?: string } = {}): Koa {
  const token = jsonwebtoken.sign(
    { id: 1, email: 'forest@forest.com', renderingId: 1, team: 'admin' },
    AUTH_SECRET,
    { expiresIn: '1 hour' },
  );
  const fetcher: SchemaFetcher = {
    fetchSchema: async () => ({
      collections: LEGACY_SCHEMA,
      meta: liana === undefined ? {} : { liana, liana_version: '9.21.0' },
    }),
  };
  const schemaCache = new SchemaCache({
    fetcher,
    metrics: { increment: () => {}, gauge: () => {} },
  });
  const store = new ReadModelStore(schemaCache, new CapabilitiesCache());

  const noopLogger: Logger = () => {};

  const app = new Koa();

  app.silent = true;
  app.use(createErrorMiddleware({ logger: noopLogger }));
  app.use(bodyParser());
  app.use(async (ctx, next) => {
    ctx.state.timezone = TIMEZONE;
    ctx.state.agentToken = token;
    await next();
  });
  app.use(
    createDataRoutesMiddleware({
      store,
      transport: createHttpTransport({ agentUrl }),
      logger: noopLogger,
    }),
  );

  return app;
}
