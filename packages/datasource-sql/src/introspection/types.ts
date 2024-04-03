export type ScalarSubType =
  | 'BIGINT'
  | 'BLOB'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATEONLY'
  | 'DECIMAL'
  | 'DOUBLE'
  | 'FLOAT'
  | 'INET'
  | 'INTEGER'
  | 'JSON'
  | 'JSONB'
  | 'NUMBER'
  | 'REAL'
  | 'STRING'
  | 'TEXT'
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
  schema: string | undefined;
  unique: string[][];
  columns: {
    name: string;
    type: ColumnType;
    defaultValue: unknown;
    isLiteralDefaultValue: boolean;
    allowNull: boolean;
    autoIncrement: boolean;
    primaryKey: boolean;
    constraints: {
      table: string;
      column: string;
    }[];
  }[];
};

export type Introspection1 = {
  tables: Table[];
  version: 1;
};

export type Introspection2 = {
  tables: Table[];
  source: '@forestadmin/datasource-sql';
  version: 2;
};

export type Introspection3 = {
  tables: Table[];
  views: Table[];
  source: '@forestadmin/datasource-sql';
  version: 3;
};

export type Introspection = Introspection3;

export type LegacyIntrospection = Table[] | Introspection1 | Introspection2 | Introspection3;
