import { AbstractDataType, AbstractDataTypeConstructor, ColumnDescription } from 'sequelize';

export type FieldDescription = (
  | string
  | (Omit<ColumnDescription, 'defaultValue' | 'type'> & {
      defaultValue: unknown;
      type: AbstractDataType | AbstractDataTypeConstructor;
    })
)[];

export type ForeignKeyReference = {
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
