import type CapabilitiesCache from './capabilities-cache';
import type { CapabilitiesFetcher, CapabilitiesResult } from './capabilities-cache';
import type SchemaCache from './schema-cache';

import ReadModel from './read-model';

const MAX_GENERATION_RETRIES = 3;

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

  /**
   * Returns the capabilities together with the read-model they belong to, so a caller cannot mix a
   * read-model captured earlier (allow-list, primary keys) with capabilities from a newer schema
   * generation. Callers must use the returned `readModel`, not the one they held before this call.
   */
  async getCapabilities(
    collection: string,
    fetcher: CapabilitiesFetcher,
    attemptsLeft = MAX_GENERATION_RETRIES,
  ): Promise<{ capabilities: CapabilitiesResult; readModel: ReadModel }> {
    if (attemptsLeft <= 0) {
      throw new Error(
        `Schema generation kept changing while reading capabilities for "${collection}"`,
      );
    }

    // Ensure any pending schema refresh (and its capabilities invalidation) runs first.
    const readModel = await this.getReadModel();
    const capabilities = await this.capabilitiesCache.get(collection, fetcher);

    // A refresh can land while the fetch is in flight: the cache drops the stale write but still
    // resolves with it, so both reads are retried until they observe one generation. Bounded because
    // a refresh is driven by the 24h schema TTL, not by request volume.
    if (this.readModel !== readModel) {
      return this.getCapabilities(collection, fetcher, attemptsLeft - 1);
    }

    return { capabilities, readModel };
  }

  ageSeconds(): number | undefined {
    return this.schemaCache.ageSeconds();
  }
}
