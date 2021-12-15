import { Filter, Operator, Aggregator } from "./query/selection";

export type CollectionSchema = {
  actions: Array<{
    name: string;
    scope: "single" | "bulk" | "global";
    forceDownload: boolean;
  }>;
  fields: { [fieldName: string]: FieldSchema };
  searchable: boolean;
  segments: string[];
  validation?: Filter;
};

export type FieldSchema =
  | ColumnSchema
  | BelongsToSchema
  | HasManySchema
  | HasOneSchema
  | BelongsToManySchema;

export type ColumnSchema = {
  columnType: ColumnType;
  filterOperators: Set<Operator>;
  defaultValue: unknown;
  enumValues?: string[];
  isPrimaryKey: boolean;
  isReadOnly: boolean;
  isSortable: boolean;
  type: FieldTypes.Column;
  validation?:
    | { aggregator: Aggregator; conditions: ColumnSchema["validation"] }
    | { operator: Operator; field: string; value: unknown };
};

export type BelongsToSchema = {
  foreignCollection: string;
  foreignKey: string;
  type: FieldTypes.ManyToOne;
};

export type HasManySchema = {
  foreignCollection: string;
  foreignKey: string;
  type: FieldTypes.OneToMany;
};

export type HasOneSchema = {
  foreignCollection: string;
  foreignKey: string;
  type: FieldTypes.OneToOne;
};

export type BelongsToManySchema = {
  foreignCollection?: string;
  foreignKey?: string;
  otherField?: string;
  throughCollection?: string;
  type: FieldTypes.ManyToMany;
};

export type ColumnType = PrimitiveTypes | { [key: string]: ColumnType } | [ColumnType];

export enum PrimitiveTypes {
  Boolean = "Boolean",
  Date = "Date",
  Dateonly = "Dateonly",
  Enum = "Enum",
  Json = "Json",
  Number = "Number",
  Point = "Point",
  String = "String",
  Timeonly = "Timeonly",
  Uuid = "Uuid",
}

export enum FieldTypes {
  Column = "Column",
  ManyToOne = "ManyToOne",
  OneToOne = "OneToOne",
  OneToMany = "OneToMany",
  ManyToMany = "ManyToMany",
}
