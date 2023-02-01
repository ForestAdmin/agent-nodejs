import { AbstractDataType, AbstractDataTypeConstructor, QueryInterface } from 'sequelize/types';

export type SequelizeIndex = Awaited<ReturnType<QueryInterface['showIndex']>>[number];
export type SequelizeColumn = Awaited<ReturnType<QueryInterface['describeTable']>>[number];
export type SequelizeColumnType = AbstractDataType | AbstractDataTypeConstructor;
export type SequelizeReference = Awaited<
  ReturnType<QueryInterface['getForeignKeyReferencesForTable']>
>[number];

export type ScalarSubType =
  | 'BIGINT'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATEONLY'
  | 'DOUBLE'
  | 'FLOAT'
  | 'INET'
  | 'JSON'
  | 'JSONB'
  | 'NUMBER'
  | 'STRING'
  | 'TIME'
  | 'UUID';

export type ColumnType =
  | { type: 'scalar'; subType: ScalarSubType }
  | { type: 'array'; subType: ColumnType }
  | { type: 'enum'; values: string[] };

export type Table = {
  name: string;
  columns: {
    name: string;
    type: ColumnType;
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
