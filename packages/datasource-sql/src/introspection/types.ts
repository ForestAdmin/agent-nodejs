import { AbstractDataType, AbstractDataTypeConstructor, QueryInterface } from 'sequelize/types';

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
  | {
      type: 'enum';

      /**
       * When using postgres, schema and name of the type of this enum (e.g. "enum_users_role")
       *
       * This is needed when the enum is used in an array, because sequelize needs to cast when
       * inserting into that column.
       * As this is not needed for enums which are not used in arrays, and requires extra
       * introspection queries, it is filled only when needed.
       */
      schema?: string;
      name?: string;

      /** list of values that the enum can take */
      values: string[];
    };

export type Table = {
  name: string;
  unique: string[][];
  columns: {
    name: string;
    type: ColumnType;
    defaultValue: unknown;
    allowNull: boolean;
    autoIncrement: boolean;
    primaryKey: boolean;
    constraints: {
      table: string;
      column: string;
    }[];
  }[];
};
