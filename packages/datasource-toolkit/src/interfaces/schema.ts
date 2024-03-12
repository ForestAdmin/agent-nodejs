import { Operator } from './query/condition-tree/nodes/operators';

export type ActionScope = 'Single' | 'Bulk' | 'Global';

export type ActionSchema = {
  scope: ActionScope;
  generateFile?: boolean;
  staticForm?: boolean;
};

export type DataSourceSchema = {
  charts: string[];
};

export type CollectionSchema = {
  actions: { [actionName: string]: ActionSchema };
  charts: string[];
  countable: boolean;
  fields: { [fieldName: string]: FieldSchema };
  searchable: boolean;
  segments: string[];
};

export type RelationSchema = ManyToOneSchema | OneToManySchema | OneToOneSchema | ManyToManySchema;
export type FieldSchema = ColumnSchema | RelationSchema;

export type ColumnSchemaValidation = Array<{ operator: Operator; value?: unknown }>;

export type ColumnSchema = {
  columnType: ColumnType;
  filterOperators?: Set<Operator>;
  defaultValue?: unknown;
  enumValues?: string[];
  isPrimaryKey?: boolean;
  isReadOnly?: boolean;
  isSortable?: boolean;
  allowNull?: boolean;
  type: 'Column';
  validation?: ColumnSchemaValidation;
};

export type ManyToOneSchema = {
  foreignCollection: string;
  foreignKey: string;
  foreignKeyTarget: string;
  type: 'ManyToOne';
};

export type OneToManySchema = {
  foreignCollection: string;
  originKey: string;
  originKeyTarget: string;
  type: 'OneToMany';
};

export type OneToOneSchema = {
  foreignCollection: string;
  originKey: string;
  originKeyTarget: string;
  type: 'OneToOne';
};

export type ManyToManySchema = {
  throughCollection: string;
  foreignCollection: string;
  foreignKey: string;
  foreignKeyTarget: string;
  originKey: string;
  originKeyTarget: string;
  type: 'ManyToMany';
};

export type ColumnType = PrimitiveTypes | { [key: string]: ColumnType } | [ColumnType];

export type PrimitiveTypes =
  | 'Boolean'
  | 'Binary'
  | 'Date'
  | 'Dateonly'
  | 'Enum'
  | 'Json'
  | 'Number'
  | 'Point'
  | 'String'
  | 'Time'
  | 'Timeonly' // Deprecated. Use Time
  | 'Uuid';

export type FieldTypes = 'Column' | 'ManyToOne' | 'OneToOne' | 'OneToMany' | 'ManyToMany';
