import { tmpdir } from 'os';
import path from 'path';
import { Dialect, Options } from 'sequelize';

export type ConnectionDetails = {
  name: string;
  dialect: Dialect;
  url: (dbName?: string) => string;
  options: (dbName?: string) => Options;
  version: number;
  supports: {
    schemas?: boolean;
    enums?: boolean;
    enumsValueRetrieval: boolean;
    arrays?: boolean;
    booleans: boolean;
    json?: boolean;
    multipleDatabases: boolean;
    textDefaultValue: boolean;
    functionDefaultValue: boolean;
    dateDefault: boolean;
    authentication: boolean;
  };
  defaultSchema?: string;
};

export const POSTGRESQL_DETAILS: ConnectionDetails[] = [
  [9, 5439],
  [15, 5445],
].map(([version, port]) => ({
  name: `PostgreSQL ${version}`,
  dialect: 'postgres',
  url: (dbName?: string) =>
    `postgres://test:password@localhost:${port}${dbName ? `/${dbName}` : ''}`,
  options: (dbName?: string) => ({
    dialect: 'postgres' as Dialect,
    username: 'test',
    password: 'password',
    host: 'localhost',
    port,
    database: dbName,
    logging: false,
  }),
  version,
  supports: {
    schemas: true,
    enums: true,
    enumsValueRetrieval: true,
    arrays: true,
    booleans: true,
    json: true,
    multipleDatabases: true,
    textDefaultValue: true,
    functionDefaultValue: true,
    dateDefault: true,
    authentication: true,
  },
  defaultSchema: 'public',
}));

export const MSSQL_DETAILS: ConnectionDetails[] = [
  [2017, 1417],
  [2022, 1422],
].map(([version, port]) => ({
  name: `MS SQL Server ${version}`,
  dialect: 'mssql',
  url: (dbName?: string) =>
    `mssql://sa:yourStrong(!)Password@localhost:${port}${dbName ? `/${dbName}` : ''}`,
  options: (dbName?: string) => ({
    dialect: 'mssql' as Dialect,
    username: 'sa',
    password: 'yourStrong(!)Password',
    host: 'localhost',
    port,
    database: dbName,
    logging: false,
  }),
  version,
  supports: {
    schemas: true,
    enums: true,
    enumsValueRetrieval: false,
    arrays: false,
    booleans: false,
    json: false,
    multipleDatabases: true,
    textDefaultValue: true,
    functionDefaultValue: true,
    dateDefault: true,
    authentication: true,
  },
  defaultSchema: 'dbo',
}));

export const MYSQL_DETAILS: ConnectionDetails[] = [
  [5, 3305],
  [8, 3308],
].map(([version, port]) => ({
  name: `MySQL ${version}`,
  dialect: 'mysql',
  url: (dbName?: string) => `mysql://root:password@localhost:${port}${dbName ? `/${dbName}` : ''}`,
  options: (dbName?: string) => ({
    dialect: 'mysql' as Dialect,
    username: 'root',
    password: 'password',
    host: 'localhost',
    port,
    database: dbName,
    logging: false,
  }),
  version,
  supports: {
    schemas: false,
    enums: true,
    enumsValueRetrieval: true,
    arrays: false,
    booleans: false,
    multipleDatabases: true,
    textDefaultValue: false,
    functionDefaultValue: false,
    dateDefault: version >= 8,
    authentication: true,
  },
  defaultSchema: undefined,
}));

export const MARIADB_DETAILS: ConnectionDetails[] = [
  [10, 3810],
  [11, 3811],
].map(([version, port]) => ({
  name: `MariaDB ${version}`,
  dialect: 'mariadb',
  url: (dbName?: string) =>
    `mariadb://root:password@localhost:${port}${dbName ? `/${dbName}` : ''}`,
  options: (dbName?: string) => ({
    dialect: 'mariadb' as Dialect,
    username: 'root',
    password: 'password',
    host: 'localhost',
    port,
    database: dbName,
    logging: false,
  }),
  version,
  supports: {
    schemas: false,
    enums: true,
    enumsValueRetrieval: true,
    arrays: false,
    booleans: false,
    multipleDatabases: true,
    textDefaultValue: true,
    functionDefaultValue: true,
    dateDefault: true,
    authentication: true,
  },
  defaultSchema: undefined,
}));

export const SQLITE_DETAILS: ConnectionDetails = {
  name: 'SQLite',
  dialect: 'sqlite',
  url: (dbName?: string) => `sqlite://${path.join(tmpdir(), `${dbName}.db` || 'test.db')}}`,
  options: (dbName?: string) => ({
    dialect: 'sqlite' as Dialect,
    storage: ':memory:',
    database: dbName,
    logging: false,
  }),
  version: 3,
  supports: {
    schemas: false,
    enums: false,
    enumsValueRetrieval: false,
    arrays: false,
    booleans: false,
    multipleDatabases: false,
    textDefaultValue: true,
    functionDefaultValue: true,
    dateDefault: true,
    authentication: false,
  },
  defaultSchema: undefined,
};

const CONNECTION_DETAILS: ConnectionDetails[] = [
  ...POSTGRESQL_DETAILS,
  ...MSSQL_DETAILS,
  ...MYSQL_DETAILS,
  ...MARIADB_DETAILS,
  SQLITE_DETAILS,
];

export default CONNECTION_DETAILS;
