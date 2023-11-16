import { tmpdir } from 'os';
import path from 'path';
import { Dialect, Options } from 'sequelize';

export type ConnectionDetails = {
  name: string;
  dialect: Dialect;
  url: (dbName?: string) => string;
  options: (dbName?: string) => Options;
  supports: {
    schemas?: boolean;
    enums?: boolean;
    arrays?: boolean;
    booleans: boolean;
    json?: boolean;
    multipleDatabases: boolean;
  };
  defaultSchema?: string;
};

export const POSTGRESQL_DETAILS: ConnectionDetails = {
  name: 'PostgreSQL',
  dialect: 'postgres',
  url: (dbName?: string) => `postgres://test:password@localhost:5443${dbName ? `/${dbName}` : ''}`,
  options: (dbName?: string) => ({
    dialect: 'postgres' as Dialect,
    username: 'test',
    password: 'password',
    host: 'localhost',
    port: 5443,
    database: dbName,
    logging: false,
  }),
  supports: {
    schemas: true,
    enums: true,
    arrays: true,
    booleans: true,
    json: true,
    multipleDatabases: true,
  },
  defaultSchema: 'public',
};

export const MSSQL_DETAILS: ConnectionDetails = {
  name: 'MS SQL Server',
  dialect: 'mssql',
  url: (dbName?: string) =>
    `mssql://sa:yourStrong(!)Password@localhost:1434${dbName ? `/${dbName}` : ''}`,
  options: (dbName?: string) => ({
    dialect: 'mssql' as Dialect,
    username: 'sa',
    password: 'yourStrong(!)Password',
    host: 'localhost',
    port: 1434,
    database: dbName,
    logging: false,
  }),
  supports: {
    schemas: true,
    enums: true,
    arrays: false,
    booleans: false,
    json: false,
    multipleDatabases: true,
  },
  defaultSchema: 'dbo',
};

export const MYSQL_DETAILS: ConnectionDetails = {
  name: 'MySQL',
  dialect: 'mysql',
  url: (dbName?: string) => `mysql://root:password@localhost:3307${dbName ? `/${dbName}` : ''}`,
  options: (dbName?: string) => ({
    dialect: 'mysql' as Dialect,
    username: 'root',
    password: 'password',
    host: 'localhost',
    port: 3307,
    database: dbName,
    logging: false,
  }),
  supports: {
    schemas: false,
    enums: true,
    arrays: false,
    booleans: false,
    multipleDatabases: true,
  },
  defaultSchema: undefined,
};

export const MARIADB_DETAILS: ConnectionDetails = {
  name: 'MariaDB',
  dialect: 'mariadb',
  url: (dbName?: string) => `mariadb://root:password@localhost:3809${dbName ? `/${dbName}` : ''}`,
  options: (dbName?: string) => ({
    dialect: 'mariadb' as Dialect,
    username: 'root',
    password: 'password',
    host: 'localhost',
    port: 3809,
    database: dbName,
    logging: false,
  }),
  supports: {
    schemas: false,
    enums: true,
    arrays: false,
    booleans: false,
    multipleDatabases: true,
  },
  defaultSchema: undefined,
};

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
  supports: {
    schemas: false,
    enums: false,
    arrays: false,
    booleans: false,
    multipleDatabases: false,
  },
  defaultSchema: undefined,
};

const CONNECTION_DETAILS: ConnectionDetails[] = [
  POSTGRESQL_DETAILS,
  MSSQL_DETAILS,
  MYSQL_DETAILS,
  MARIADB_DETAILS,
  SQLITE_DETAILS,
];

export default CONNECTION_DETAILS;
