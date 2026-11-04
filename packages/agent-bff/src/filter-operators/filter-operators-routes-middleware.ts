import type { AgentTransport } from '../agent/agent-transport';
import type { Logger } from '../ports/logger-port';
import type { AgentCapabilitiesFetcherOptions } from '../read-model/agent-capabilities-fetcher';
import type { CapabilitiesFetcher } from '../read-model/capabilities-cache';
import type ReadModelStore from '../read-model/read-model-store';
import type { Operator } from '@forestadmin/datasource-toolkit';
import type { Middleware } from 'koa';

import {
  callAgent,
  decodeSegment,
  requireAgentToken,
  resolveReadModel,
} from '../http/agent-route-helpers';
import { unknownCollection } from '../http/bff-local-errors';
import createAgentCapabilitiesFetcher from '../read-model/agent-capabilities-fetcher';
import collectFilterableFields from '../validation/filterable-fields';

const FILTER_OPERATORS_ROUTE = /^\/agent\/v1\/collections\/([^/]+)\/filter-operators$/;

interface FilterOperatorsResponse {
  collection: string;
  fields: { field: string; operators: Operator[] }[];
}

export interface FilterOperatorsRoutesMiddlewareOptions {
  store: ReadModelStore;
  transport: AgentTransport;
  logger: Logger;
  createFetcher?: (options: AgentCapabilitiesFetcherOptions) => CapabilitiesFetcher;
}

export default function createFilterOperatorsRoutesMiddleware({
  store,
  transport,
  logger,
  createFetcher = createAgentCapabilitiesFetcher,
}: FilterOperatorsRoutesMiddlewareOptions): Middleware {
  return async function filterOperatorsRoutesMiddleware(ctx, next) {
    const match = ctx.method === 'GET' ? FILTER_OPERATORS_ROUTE.exec(ctx.path) : null;

    if (!match) {
      await next();

      return;
    }

    const collection = decodeSegment(match[1], 'collection name');
    const token = requireAgentToken(ctx);

    if (!(await resolveReadModel(store)).isCollectionAllowed(collection)) {
      throw unknownCollection(`Unknown collection: ${collection}`);
    }

    const fetcher = createFetcher({ transport, token, store, logger });
    const { capabilities, readModel } = await callAgent(
      () => store.getCapabilities(collection, fetcher),
      logger,
    );

    if (!readModel.isCollectionAllowed(collection)) {
      throw unknownCollection(`Unknown collection: ${collection}`);
    }

    const { fields } = collectFilterableFields(collection, capabilities, logger);
    const body: FilterOperatorsResponse = {
      collection,
      fields: fields.map(({ name, operators }) => ({ field: name, operators })),
    };

    ctx.status = 200;
    ctx.body = body;
  };
}
