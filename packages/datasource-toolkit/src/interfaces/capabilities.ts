import { ColumnType } from './schema';

export type FieldCapabilities = {
  name: string;
  type: ColumnType;
  operators: string[];
};

export type CollectionCapabilities = {
  name: string;
  fields: FieldCapabilities[];
};
