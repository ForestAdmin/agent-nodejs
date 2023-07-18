import {
  RecordDataWithCollection,
  ReplicaDataSourceOptions,
} from '@forestadmin/datasource-replica';

export type HubSpotOptions<TypingCollections = undefined> = {
  accessToken: string;
  collections: TypingCollections | FieldPropertiesByCollection;
  cacheInto?: ReplicaDataSourceOptions['cacheInto'];
  typingsPath?: string;
  pullDumpOnSchedule?: ReplicaDataSourceOptions['pullDeltaOnSchedule'];
  /**
   * Generate the collection types if it changes.
   * Useful for development. In production, it should be true.
   * */
  skipTypings?: boolean;
};

export type FieldProperties = Record<string, any>[];

export type FieldPropertiesByCollection = { [collectionName: string]: FieldProperties };

export type Records = Record<string, any>[];

export type Response = {
  more: boolean;
  newOrUpdatedEntries: RecordDataWithCollection[];
  deletedEntries: RecordDataWithCollection[];
  nextState: unknown;
};
