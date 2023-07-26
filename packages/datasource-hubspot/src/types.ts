import {
  RecordDataWithCollection,
  ReplicaDataSourceOptions,
} from '@forestadmin/datasource-replica';

export type HubSpotOptions<TypingCollections = undefined> = {
  /** HubSpot access token */
  accessToken: string;

  /**
   * HubSpot CRM objects and custom objects to import.
   * Use this documentation as a reference to obtain the list of accessible objects.
   * */
  collections: TypingCollections | { [collectionName: string]: string[] };

  /**
   * URL of the cache database (default to in-memory sqlite)
   */
  cacheInto?: ReplicaDataSourceOptions['cacheInto'];

  /**
   * Generate a typings file for the HubSpot objects.
   * If true, the typings file will not be generated. Useful for production.
   */
  skipTypings?: boolean;

  /**
   * Path to the typings file that will be generated.
   */
  typingsPath?: string;

  /**
   * Pull dump on schedule.
   * The schedule is defined by a cron expression.
   */
  pullDumpOnSchedule?: ReplicaDataSourceOptions['pullDumpOnSchedule'];

  /**
   * Pull delta on schedule.
   * The schedule is defined by a cron expression.
   */
  pullDeltaOnSchedule?: ReplicaDataSourceOptions['pullDeltaOnSchedule'];

  /**
   * Maximum number of records to check if they already exist in hubspot.
   * If the number of records to check is greater than this value, the check will be skipped.
   * It means that the records returned on the frontend can be already deleted on hubspot.
   * Be careful, if you set this value to 0, the check will be skipped for all records.
   * A to high value can slow down the pull delta.
   * Default is 500.
   */
  pullDeltaMaxRecordUpToDate?: number;

  /**
   * Pull dump on restart.
   */
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

export type RecordWithRelationships = { id: string; relationships: []; collectionName: string };
