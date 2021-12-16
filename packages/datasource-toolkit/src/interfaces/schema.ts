import { Filter, Operator, Aggregator } from "./query/selection";

/**
 * Schema representation of a collection
 *
 * It is used to generated the `.forestadmin-schema.json` file
 */
export type CollectionSchema = {
  /**
   * Declare action(s) associated with a collection
   */
  actions: Array<ActionSchema>;
  /** Declare the list of fields of the collection */
  fields: { [fieldName: string]: FieldSchema };
  /** When "true", the collection is searchable */
  searchable: boolean;
  /** Declare a list of segment name */
  segments: string[];
  /**
   * Declare a filter that every records should match
   */
  validation?: Filter;
};

/**
 * Schema representation of an action
 */
export type ActionSchema = {
  /** Visible name of the action */
  name: string;
  /**
   * Scope of the action.
   * - "single": the action is only available for one selected record at a time
   * - "bulk": the action will be available when you click on one or several desired records
   * - "global": the action is always available and will be executed on all records
   */
  scope: "single" | "bulk" | "global";
  /** When "true", the action response will force a file download */
  forceDownload?: boolean;
};

/** Schema representation of a field */
export type FieldSchema =
  | ColumnSchema
  | ManyToOneSchema
  | OneToManySchema
  | OneToOneSchema
  | ManyToManySchema;

/** Schema representation of a column */
export type ColumnSchema = {
  /** Type of the column */
  columnType: ColumnType;
  /** List of all the supported operators */
  filterOperators: Set<Operator>;
  defaultValue?: unknown;
  /** Array of possible values for the column */
  enumValues?: string[];
  /** When "true", the column is considerer as a primary key */
  isPrimaryKey?: boolean;
  /** When "true", the column is considerer as a read-only */
  isReadOnly?: boolean;
  /** When "true", the column is considerer as a sortable */
  isSortable?: boolean;
  type: FieldTypes.Column;
  validation?:
    | { aggregator: Aggregator; conditions: ColumnSchema["validation"] }
    | { operator: Operator; field: string; value: unknown };
};

/** Schema representation of a many to one relationship */
export type ManyToOneSchema = {
  /** Targetted collection */
  foreignCollection: string;
  /** Targetted key of the collection */
  foreignKey: string;
  type: FieldTypes.ManyToOne;
};

/** Schema representation of a one to many relationship */
export type OneToManySchema = {
  /** Targetted collection */
  foreignCollection: string;
  /** Targetted key of the collection */
  foreignKey: string;
  type: FieldTypes.OneToMany;
};

/** Schema representation of a one to one relationship */
export type OneToOneSchema = {
  /** Targetted collection */
  foreignCollection: string;
  /** Targetted key of the collection */
  foreignKey: string;
  type: FieldTypes.OneToOne;
};

/** Schema representation of a many to many relationship */
export type ManyToManySchema = {
  /** Targetted collection */
  foreignCollection?: string;
  /** Targetted key of the collection */
  foreignKey?: string;
  otherField?: string;
  throughCollection?: string;
  type: FieldTypes.ManyToMany;
};

export type ColumnType = PrimitiveTypes | { [key: string]: ColumnType } | [ColumnType];

/** Enumeration of supported primitive types */
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

/** Enumeration of supported field types */
export enum FieldTypes {
  Column = "Column",
  ManyToOne = "ManyToOne",
  OneToOne = "OneToOne",
  OneToMany = "OneToMany",
  ManyToMany = "ManyToMany",
}
