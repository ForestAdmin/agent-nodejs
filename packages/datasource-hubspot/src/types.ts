import { CachedDataSourceOptions } from '@forestadmin/datasource-cached';

export type HubSpotOptions<TypingCollections = undefined> = {
  accessToken: string;
  collections: TypingCollections | Record<string, string[]>;
  cacheInto?: CachedDataSourceOptions['cacheInto'];
  typingsPath?: string;
  /**
   * Generate the collection types if it changes.
   * Useful for development. In production, it should be true.
   * */
  skipTypings?: boolean;
};

export type FieldProperties = Record<string, any>[];
export type FieldPropertiesByCollection = { [collectionName: string]: FieldProperties };
