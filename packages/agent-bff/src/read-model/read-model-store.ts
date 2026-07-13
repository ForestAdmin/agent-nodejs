import type CapabilitiesCache from './capabilities-cache';
import type { CapabilitiesFetcher, CapabilitiesResult } from './capabilities-cache';
import type SchemaCache from './schema-cache';

import ReadModel from './read-model';

/**
 * Single owner of the coupled schema + capabilities lifecycle. A successful schema refresh (a bump
 * of the cache `revision`) rebuilds the read-model and clears capabilities atomically, so the
 * allow-list and capabilities never split-brain across schema generations.
 */
export default class ReadModelStore {
  private readonly schemaCache: SchemaCache;
  private readonly capabilitiesCache: CapabilitiesCache;

  private builtRevision = -1;
  private readModel: ReadModel | null = null;

  constructor(schemaCache: SchemaCache, capabilitiesCache: CapabilitiesCache) {
    this.schemaCache = schemaCache;
    this.capabilitiesCache = capabilitiesCache;
  }

  async getReadModel(): Promise<ReadModel> {
    const collections = await this.schemaCache.get();

    if (this.schemaCache.revision !== this.builtRevision || !this.readModel) {
      this.readModel = new ReadModel(collections);
      this.builtRevision = this.schemaCache.revision;
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

    // TODO(wiring): known TOCTOU, deferred. Two snapshots can straddle a schema generation:
    //   1. the data middleware captures the read-model (allow-list) once, then calls this later;
    //   2. this capabilities fetch can be in flight when a concurrent schema refresh clear()s it.
    // Either gap lets the caller validate against capabilities from one generation while the
    // allow-list came from another. A full fix couples both reads to a single generation (return
    // read-model + capabilities together, or re-check `schemaCache.revision` across both and retry);
    // a retry here alone only closes gap 2. Low risk: the trigger is a 24h-TTL refresh landing exactly
    // during a request, and the agent stays the final validator.
    return this.capabilitiesCache.get(collection, fetcher);
  }

  ageSeconds(): number | undefined {
    return this.schemaCache.ageSeconds();
  }
}
