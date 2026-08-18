import type { Logger } from '../ports/logger-port';
import type { Metrics } from '../ports/metrics-port';

import ActionEndpointResolver from './action-endpoint-resolver';
import CapabilitiesCache from './capabilities-cache';
import ForestSchemaClient from './forest-schema-client';
import ReadModelStore from './read-model-store';
import SchemaCache from './schema-cache';
import createConsoleMetrics from '../adapters/console-metrics';
import safeMetrics from '../adapters/safe-metrics';

export interface CreateReadModelOptions {
  forestServerUrl: string;
  envSecret: string;
  metrics?: Metrics;
  logger?: Logger;
  now?: () => number;
}

export interface ReadModelBundle {
  store: ReadModelStore;
  actionEndpointResolver: ActionEndpointResolver;
}

export default function createReadModel({
  forestServerUrl,
  envSecret,
  metrics,
  logger,
  now,
}: CreateReadModelOptions): ReadModelBundle {
  // Wrap once so a throwing metrics backend can never break business logic anywhere in the bundle.
  const resolvedMetrics = safeMetrics(metrics ?? createConsoleMetrics(logger));
  const fetcher = new ForestSchemaClient({ forestServerUrl, envSecret });
  const schemaCache = new SchemaCache({ fetcher, metrics: resolvedMetrics, now });
  const capabilitiesCache = new CapabilitiesCache({ now });
  const store = new ReadModelStore(schemaCache, capabilitiesCache);
  const actionEndpointResolver = new ActionEndpointResolver(
    () => store.getReadModel(),
    resolvedMetrics,
  );

  return { store, actionEndpointResolver };
}
