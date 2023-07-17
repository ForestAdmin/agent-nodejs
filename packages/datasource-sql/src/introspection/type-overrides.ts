// Override the types from sequelize to add properties from private fields and methods
// that we use in the datasource-sequelize package, but that are not exported by sequelize.
import { AbstractQueryInterface } from '@sequelize/core';

export type SequelizeReference = {
  constraintName: string;
  constraintSchema: string;
  constraintCatalog: string;
  tableName: string;
  tableSchema: string;
  tableCatalog: string;
  columnName: string;
  referencedTableSchema: string;
  referencedTableCatalog: string;
  referencedTableName: string;
  referencedColumnName: string;
};

export interface PGQueryInterface extends AbstractQueryInterface {
  fromArray: (rowEnumValue: string) => string[];
}
