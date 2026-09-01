import type { Logger } from '../../../src/ports/logger-port';
import type { SchemaFetcher } from '../../../src/read-model/forest-schema-client';
import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';

import { bodyParser } from '@koa/bodyparser';
import fs from 'fs/promises';
import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import net from 'net';

import createDataRoutesMiddleware from '../../../src/data/data-routes-middleware';
import createErrorMiddleware from '../../../src/http/error-middleware';
import CapabilitiesCache from '../../../src/read-model/capabilities-cache';
import ReadModelStore from '../../../src/read-model/read-model-store';
import SchemaCache from '../../../src/read-model/schema-cache';

export const TIMEZONE = 'Europe/Paris';
export const AUTH_SECRET = 'b0bdf0a639c16bae8851dd24ee3d79ef0a352e957c5b86cb';
export const ENV_SECRET = 'ceba742f5bc73946b34da192816a4d7177b3233fee7769955c29c0e90fd584f2';
export const BOOT_TIMEOUT_MS = 60_000;

// agent-testing only deletes a schema file whose name carries this prefix, so reusing it keeps the
// temporary schema cleaned up by `agent.stop()` even though the path is chosen here.
export const RESERVED_SCHEMA_PREFIX = 'reserved-forestadmin-schema-test-';

export const noopLogger: Logger = () => {};

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

function agentToken(): string {
  return jsonwebtoken.sign(
    { id: 1, email: 'forest@forest.com', renderingId: 1, team: 'admin' },
    AUTH_SECRET,
    { expiresIn: '1 hour' },
  );
}

function schemaFetcherFromFile(schemaPath: string): SchemaFetcher {
  return {
    fetchSchema: async () => {
      const { collections } = JSON.parse(await fs.readFile(schemaPath, 'utf8')) as {
        collections: ForestSchemaCollection[];
      };

      return collections;
    },
  };
}

/**
 * The BFF in front of a real agent: the middleware production mounts, the real data client, and a
 * read-model built from the schema the agent just wrote. Only the schema transport is swapped —
 * production fetches it from the Forest server, which plays no part in what these suites assert.
 */
export function buildApp(agentUrl: string, schemaPath: string): Koa {
  const token = agentToken();
  const schemaCache = new SchemaCache({
    fetcher: schemaFetcherFromFile(schemaPath),
    metrics: { increment: () => {}, gauge: () => {} },
  });
  const store = new ReadModelStore(schemaCache, new CapabilitiesCache());
  const app = new Koa();

  app.silent = true;
  app.use(createErrorMiddleware({ logger: noopLogger }));
  app.use(bodyParser());
  app.use(async (ctx, next) => {
    ctx.state.timezone = TIMEZONE;
    ctx.state.agentToken = token;
    await next();
  });
  app.use(createDataRoutesMiddleware({ store, agentUrl, logger: noopLogger }));

  return app;
}
