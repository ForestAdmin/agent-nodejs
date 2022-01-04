import { Filter, Operator, Aggregator } from './query/selection';

export enum CollectionSchemaScope {
  Single = 'single',
  Bulk = 'bulk',
  Global = 'global',
}

export type CollectionSchema = {
  actions: Array<{
    name: string;
    scope: CollectionSchemaScope;
    forceDownload?: boolean;
  }>;
  fields: { [fieldName: string]: FieldSchema };
  searchable: boolean;
  segments: string[];
  validation?: Filter;
};

export type FieldSchema =
  | ColumnSchema
  | ManyToOneSchema
  | OneToManySchema
  | OneToOneSchema
  | ManyToManySchema;

export type ColumnSchema = {
  columnType: ColumnType;
  filterOperators: Set<Operator>;
  defaultValue?: unknown;
  enumValues?: string[];
  isPrimaryKey?: boolean;
  isReadOnly?: boolean;
  isSortable?: boolean;
  type: FieldTypes.Column;
  validation?:
    | { aggregator: Aggregator; conditions: ColumnSchema['validation'] }
    | { operator: Operator; field: string; value: unknown };
};

export type ManyToOneSchema = {
  foreignCollection: string;
  foreignKey: string;
  type: FieldTypes.ManyToOne;
};

export type OneToManySchema = {
  foreignCollection: string;
  foreignKey: string;
  type: FieldTypes.OneToMany;
};

export type OneToOneSchema = {
  foreignCollection: string;
  foreignKey: string;
  type: FieldTypes.OneToOne;
};

export type ManyToManySchema = {
  foreignCollection?: string;
  foreignKey?: string;
  otherField?: string;
  throughCollection?: string;
  type: FieldTypes.ManyToMany;
};

export type ColumnType = PrimitiveTypes | { [key: string]: ColumnType } | [ColumnType];

export enum PrimitiveTypes {
  Boolean = 'Boolean',
  Date = 'Date',
  Dateonly = 'Dateonly',
  Enum = 'Enum',
  Json = 'Json',
  Number = 'Number',
  Point = 'Point',
  String = 'String',
  Timeonly = 'Timeonly',
  Uuid = 'Uuid',
}

export enum FieldTypes {
  Column = 'Column',
  ManyToOne = 'ManyToOne',
  OneToOne = 'OneToOne',
  OneToMany = 'OneToMany',
  ManyToMany = 'ManyToMany',
}
