import type CapabilitiesCache from './capabilities-cache';
import type { CapabilitiesFetcher, CapabilitiesResult } from './capabilities-cache';
import type SchemaCache from './schema-cache';
import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';

import ReadModel from './read-model';

const MAX_GENERATION_RETRIES = 3;

export interface SchemaSnapshot {
  collections: ForestSchemaCollection[];
  readModel: ReadModel;
  revision: number;
}

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
    return (await this.getSchemaSnapshot()).readModel;
  }

  async getSchemaSnapshot(): Promise<SchemaSnapshot> {
    const collections = await this.schemaCache.get();
    const { revision } = this.schemaCache;

    if (revision !== this.builtRevision || !this.readModel) {
      this.readModel = new ReadModel(collections);
      this.builtRevision = revision;
      this.capabilitiesCache.clear();
    }

    return { collections, readModel: this.readModel, revision };
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
    const { revision } = this.schemaCache;
    const capabilities = await this.capabilitiesCache.get(collection, fetcher);

    // A refresh can land while the fetch is in flight: the cache drops the stale write but still
    // resolves with it, so both reads are retried until they observe one generation. The revision is
    // the discriminator, not the read-model identity — `SchemaCache` bumps the revision inside its
    // refresh, before an awaiting `getReadModel` caller resumes and installs the new model, so an
    // identity comparison still sees the old object in that window. Bounded because a refresh is
    // driven by the 24h schema TTL, not by request volume.
    if (this.schemaCache.revision !== revision) {
      return this.getCapabilities(collection, fetcher, attemptsLeft - 1);
    }

    return { capabilities, readModel };
  }

  ageSeconds(): number | undefined {
    return this.schemaCache.ageSeconds();
  }
}
