import { CachedDataSourceOptions } from '@forestadmin/datasource-cached';

export type HubSpotOptions<TypingCollections = undefined> = {
  cacheInto?: CachedDataSourceOptions['cacheInto'];
  accessToken: string;
  collections: TypingCollections | Record<string, string[]>;
  typingsPath?: string;
  /**
   * Generate the collection types if it changes.
   * Useful for development. In production, it should be false.
   * */
  generateCollectionTypes?: boolean;
};
