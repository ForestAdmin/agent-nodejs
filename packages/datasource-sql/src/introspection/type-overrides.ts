// Override the types from sequelize to add properties from private fields and methods
// that we use in the datasource-sequelize package, but that are not exported by sequelize.

import type {
  AbstractDataType,
  AbstractDataTypeConstructor,
  ColumnDescription,
  Logging,
  QueryInterface,
  QueryInterfaceOptions,
  QueryOptions,
  Sequelize,
  TableName,
} from 'sequelize/types';

export interface SequelizeIndex {
  name: string;
  primary: boolean;
  unique: boolean;
  indkey: string;
  definition: string;
  fields: { attribute: string }[];
}

export interface SequelizeColumn extends ColumnDescription {
  special?: string[];
  elementType?: string | null;
}

export interface SequelizeTableIdentifier {
  tableName: string;
  schema?: string;
}

export type SequelizeColumnType = AbstractDataType | AbstractDataTypeConstructor;

export type SequelizeReference = {
  constraintName: string;
  constraintSchema: string;
  constraintCatalog: string;
  tableName: string | SequelizeTableIdentifier;
  tableSchema: string;
  tableCatalog: string;
  columnName: string;
  referencedTableSchema: string;
  referencedTableCatalog: string;
  referencedTableName: string;
  referencedColumnName: string;
};

export interface QueryInterfaceExt extends QueryInterface {
  showIndex(tableName: string | object, options?: QueryOptions): Promise<SequelizeIndex[]>;

  getForeignKeyReferencesForTable(
    tableName: TableName,
    options?: QueryInterfaceOptions,
  ): Promise<SequelizeReference[]>;

  describeTable(
    tableName: TableName,
    options?: string | ({ schema?: string; schemaDelimiter?: string } & Logging),
  ): Promise<Record<string, SequelizeColumn>>;
}

export interface SequelizeWithOptions extends Sequelize {
  options: {
    schema?: string;
  };
}
