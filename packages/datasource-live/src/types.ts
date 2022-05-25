import {
  ColumnSchema,
  CompositeId,
  DataSource,
  RecordData,
  RelationSchema,
} from '@forestadmin/datasource-toolkit';

export type LiveSchema = { [collectionName: string]: LiveCollectionSchema };
export type LiveCollectionSchema = { [fieldName: string]: LiveFieldSchema };
export type LiveFieldSchema = Omit<ColumnSchema, 'isSortable' | 'filterOperators'> | RelationSchema;

export type LiveDataSourceOptions = {
  seeder: (datasource: DataSource) => Promise<void>;
};

export type CachedDataSourceOptions = {
  listChanges(cursor?: any): Promise<{
    done: boolean;
    nextCursor: any;
    changes: {
      [collection: string]: {
        creations: RecordData[];
        updates: RecordData[];
        deletions: CompositeId[];
      };
    };
  }>;

  createRecord?(name: string, data: RecordData): Promise<void>;
  updateRecord?(name: string, id: CompositeId, patch: RecordData): Promise<void>;
  deleteRecord?(name: string, id: CompositeId): Promise<void>;
};
