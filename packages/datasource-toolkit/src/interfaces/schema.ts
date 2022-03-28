import { Operator } from './query/condition-tree/nodes/leaf';

export enum ActionScope {
  Single = 'single',
  Bulk = 'bulk',
  Global = 'global',
}

export type ActionSchema = {
  scope: ActionScope;
  generateFile?: boolean;
  staticForm?: boolean;
};

export type CollectionSchema = {
  actions: { [actionName: string]: ActionSchema };
  fields: { [fieldName: string]: FieldSchema };
  searchable: boolean;
  segments: string[];
};

export type DataSourceSchema = {
  collections: { [name: string]: CollectionSchema };
};

export type RelationSchema = ManyToOneSchema | OneToManySchema | OneToOneSchema | ManyToManySchema;
export type FieldSchema = ColumnSchema | RelationSchema;

export type ColumnSchema = {
  columnType: ColumnType;
  filterOperators?: Set<Operator>;
  defaultValue?: unknown;
  enumValues?: string[];
  isPrimaryKey?: boolean;
  isReadOnly?: boolean;
  isSortable?: boolean;
  type: FieldTypes.Column;
  validation?: Array<{ operator: Operator; value?: unknown }>;
};

export type ManyToOneSchema = {
  foreignCollection: string;
  foreignKey: string;
  foreignKeyTarget: string;
  type: FieldTypes.ManyToOne;
};

export type OneToManySchema = {
  foreignCollection: string;
  originKey: string;
  originKeyTarget: string;
  type: FieldTypes.OneToMany;
};

export type OneToOneSchema = {
  foreignCollection: string;
  originKey: string;
  originKeyTarget: string;
  type: FieldTypes.OneToOne;
};

export type ManyToManySchema = {
  throughCollection: string;
  foreignCollection: string;
  foreignKey: string;
  foreignKeyTarget: string;
  foreignRelation?: string;
  originKey: string;
  originKeyTarget: string;
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
