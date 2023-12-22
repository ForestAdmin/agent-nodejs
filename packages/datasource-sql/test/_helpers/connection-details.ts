import fs from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { Dialect, Options, Sequelize } from 'sequelize';

async function reinitDbWithSequelize(url: string, database: string): Promise<void> {
  const sequelize = new Sequelize(url, { logging: false });

  try {
    const queryInterface = sequelize.getQueryInterface();

    await queryInterface.dropDatabase(database);
    await queryInterface.createDatabase(database);
  } catch (e) {
    console.error('Error', e);
    throw e;
  } finally {
    await sequelize.close();
  }
}

export type ConnectionDetails = {
  name: string;
  dialect: Dialect;
  url: (dbName?: string) => string;
  urlDocker: (dbName?: string) => string;
  options: (dbName?: string) => Options;
  reinitDb: (dbName: string) => Promise<void>;
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
  [16, 5446],
].map(([version, port]) => ({
  name: `PostgreSQL ${version}`,
  dialect: 'postgres',
  url: (dbName?: string) =>
    `postgres://test:password@localhost:${port}${dbName ? `/${dbName}` : ''}`,
  urlDocker: (dbName?: string) =>
    `postgres://test:password@postgres${version}:5432${dbName ? `/${dbName}` : ''}`,
  reinitDb: (dbName: string) =>
    reinitDbWithSequelize(`postgres://test:password@localhost:${port}`, dbName),
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
  urlDocker: (dbName?: string) =>
    `mssql://sa:yourStrong(!)Password@mssql${version}:1433${dbName ? `/${dbName}` : ''}`,
  reinitDb: (dbName: string) =>
    reinitDbWithSequelize(`mssql://sa:yourStrong(!)Password@localhost:${port}`, dbName),
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
  urlDocker: (dbName?: string) =>
    `mysql://root:password@mysql${version}:3306${dbName ? `/${dbName}` : ''}`,
  reinitDb: (dbName: string) =>
    reinitDbWithSequelize(`mysql://root:password@localhost:${port}`, dbName),
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
  urlDocker: (dbName?: string) =>
    `mariadb://root:password@mariadb${version}:3306${dbName ? `/${dbName}` : ''}`,
  reinitDb: (dbName: string) =>
    reinitDbWithSequelize(`mariadb://root:password@localhost:${port}`, dbName),
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

function generateDbPath(dbName?: string): string {
  return path.join(tmpdir(), dbName ? `${dbName}.db` : 'test.db');
}

function sqliteUrl(dbName?: string): string {
  return `sqlite://${generateDbPath(dbName)}`;
}

export const SQLITE_DETAILS: ConnectionDetails = {
  name: 'SQLite',
  dialect: 'sqlite',
  url: sqliteUrl,
  urlDocker: sqliteUrl,
  options: (dbName?: string) => ({
    dialect: 'sqlite' as Dialect,
    storage: generateDbPath(dbName),
    database: dbName,
    logging: false,
  }),
  reinitDb: async (dbName: string) => fs.rm(generateDbPath(dbName), { force: true }),
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
