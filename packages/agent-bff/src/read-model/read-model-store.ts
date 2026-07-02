import type CapabilitiesCache from './capabilities-cache';
import type { CapabilitiesFetcher, CapabilitiesResult } from './capabilities-cache';
import type SchemaCache from './schema-cache';
import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';

import ReadModel from './read-model';

/**
 * Single owner of the coupled schema + capabilities lifecycle. A successful schema refresh (a new
 * collections reference from the cache) rebuilds the read-model and clears capabilities atomically,
 * so the allow-list and capabilities never split-brain across schema generations.
 */
export default class ReadModelStore {
  private readonly schemaCache: SchemaCache;
  private readonly capabilitiesCache: CapabilitiesCache;

  private lastCollections: ForestSchemaCollection[] | null = null;
  private readModel: ReadModel | null = null;

  constructor(schemaCache: SchemaCache, capabilitiesCache: CapabilitiesCache) {
    this.schemaCache = schemaCache;
    this.capabilitiesCache = capabilitiesCache;
  }

  async getReadModel(): Promise<ReadModel> {
    const collections = await this.schemaCache.get();

    if (collections !== this.lastCollections || !this.readModel) {
      this.readModel = new ReadModel(collections);
      this.lastCollections = collections;
      this.capabilitiesCache.clear();
    }

    return this.readModel;
  }

  async getCapabilities(
    collection: string,
    fetcher: CapabilitiesFetcher,
  ): Promise<CapabilitiesResult> {
    // Ensure any pending schema refresh (and its capabilities invalidation) runs first.
    await this.getReadModel();

    return this.capabilitiesCache.get(collection, fetcher);
  }

  ageSeconds(): number | undefined {
    return this.schemaCache.ageSeconds();
  }
}
