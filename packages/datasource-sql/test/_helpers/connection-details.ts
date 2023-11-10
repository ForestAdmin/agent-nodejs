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
  }),
  supports: {
    schemas: true,
    enums: true,
    arrays: true,
  },
  defaultSchema: 'public',
};

const CONNECTION_DETAILS: ConnectionDetails[] = [
  POSTGRESQL_DETAILS,
  {
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
    }),
    supports: {
      schemas: false,
      enums: true,
      arrays: false,
    },
    defaultSchema: undefined,
  },
  {
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
    }),
    supports: {
      schemas: true,
      enums: false,
      arrays: false,
    },
    defaultSchema: 'dbo',
  },
  {
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
    }),
    supports: {
      schemas: false,
      enums: true,
      arrays: false,
    },
    defaultSchema: undefined,
  },
];

export default CONNECTION_DETAILS;
