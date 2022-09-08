import { AbstractDataType, AbstractDataTypeConstructor, QueryInterface } from 'sequelize/types';

export type SequelizeIndex = Awaited<ReturnType<QueryInterface['showIndex']>>[number];
export type SequelizeColumn = Awaited<ReturnType<QueryInterface['describeTable']>>[number];
export type SequelizeColumnType = AbstractDataType | AbstractDataTypeConstructor;
export type SequelizeReference = Awaited<
  ReturnType<QueryInterface['getForeignKeyReferencesForTable']>
>[number];

export type Table = {
  name: string;
  columns: {
    name: string;
    type: SequelizeColumnType;
    defaultValue: unknown;
    allowNull: boolean;
    unique: boolean;
    autoIncrement: boolean;
    primaryKey: boolean;
    constraints: {
      table: string;
      column: string;
    }[];
  }[];
};
