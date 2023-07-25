import {
  RecordDataWithCollection,
  ReplicaDataSourceOptions,
} from '@forestadmin/datasource-replica';

export type HubSpotOptions<TypingCollections = undefined> = {
  accessToken: string;
  collections: TypingCollections | { [collectionName: string]: string[] };
  cacheInto?: ReplicaDataSourceOptions['cacheInto'];
  typingsPath?: string;
  pullDumpOnSchedule?: ReplicaDataSourceOptions['pullDumpOnSchedule'];
  pullDeltaOnSchedule?: ReplicaDataSourceOptions['pullDeltaOnSchedule'];
  /**
   * Generate the collection types if it changes.
   * Useful for development. In production, it should be true.
   * */
  skipTypings?: boolean;
  pullDeltaMaxRecordUpToDate?: number;
  pullDumpOnRestart?: boolean;
};

export type FieldProperty = { [fieldName: string]: any };
export type FieldPropertiesByCollection = { [collectionName: string]: FieldProperty[] };

export type Records = Record<string, any>[];

export type Response = {
  more: boolean;
  newOrUpdatedEntries: RecordDataWithCollection[];
  deletedEntries: RecordDataWithCollection[];
  nextState: unknown;
};

export type RecordWithRelationNames = { id: string; relations: []; collectionName: string };
