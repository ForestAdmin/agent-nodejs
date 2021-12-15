import { Filter, Operator, Aggregator } from "./query/selection";

/**
 * Representation of a collection schema.
 *
 * It is used to generated the `.forestadmin-schema.json` file.
 */
export type CollectionSchema = {
  /* Declare action(s) associated with a collection. */
  actions: Array<ActionSchema>;
  /* Declare the list of fields of the collection. */
  fields: { [fieldName: string]: FieldSchema };
  /* When "true", the collection is searchable. */
  searchable: boolean;
  /* Declare a list of segment name. */
  segments: string[];
  /* Declare a list of filters that every records should match. */
  validation?: Filter;
};

/**
 * Representation of an action schema.
 */
export type ActionSchema = {
  /* Visible name of the action */
  name: string;
  /**
   * Scope of the action
   * - "single" mean the action is visible only when a single record is selected
   * - "bulk" mean the action is visible when more than one record is selected
   * - "global" mean the action is visible only when no records are selected
   */
  scope: "single" | "bulk" | "global";
  /* When "true", the action response will force a file download */
  forceDownload?: boolean;
};

/**
 *
 */
export type FieldSchema =
  | ColumnSchema
  | ManyToOneSchema
  | OneToManySchema
  | OneToOneSchema
  | ManyToManySchema;

/**
 *
 */
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
    | { aggregator: Aggregator; conditions: ColumnSchema["validation"] }
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

/* Enumeration of supported primitive types */
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

/* Enumeration of supported field types */
export enum FieldTypes {
  Column = "Column",
  ManyToOne = "ManyToOne",
  OneToOne = "OneToOne",
  OneToMany = "OneToMany",
  ManyToMany = "ManyToMany",
}
