import { ColumnType } from '@forestadmin/datasource-toolkit';

export interface ColumnSchema {
  columnType: ColumnType;
  defaultValue?: unknown;
  enumValues?: string[];
  isReadOnly?: boolean;
}

export type FieldSchema = ColumnSchema;

export type CollectionSchema = Record<string, FieldSchema>;
