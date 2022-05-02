import { ColumnSchema, RelationSchema } from '@forestadmin/datasource-toolkit';

export type LiveSchema = { [collectionName: string]: LiveCollectionSchema };
export type LiveCollectionSchema = { [fieldName: string]: LiveFieldSchema };
export type LiveFieldSchema = Omit<ColumnSchema, 'isSortable' | 'filterOperators'> | RelationSchema;
