import { Dialect } from 'sequelize';

export type ConnectionDetails = {
  dialect: Dialect;
  username: string;
  password: string;
  host: string;
  port: number;
  supportsSchema: boolean;
};

const CONNECTION_DETAILS = [
  {
    dialect: 'postgres' as Dialect,
    username: 'test',
    password: 'password',
    host: 'localhost',
    port: 5443,
    supports: {
      schemas: true,
      enums: true,
      arrays: true,
    },
  },
  {
    dialect: 'mysql' as Dialect,
    username: 'root',
    password: 'password',
    host: 'localhost',
    port: 3307,
    supports: {
      schemas: false,
      enums: true,
      arrays: false,
    },
  },
  {
    dialect: 'mssql' as Dialect,
    username: 'sa',
    password: 'yourStrong(!)Password',
    host: 'localhost',
    port: 1434,
    supports: {
      schemas: true,
      enums: false,
      arrays: false,
    },
  },
  {
    dialect: 'mariadb' as Dialect,
    username: 'root',
    password: 'password',
    host: 'localhost',
    port: 3809,
    supports: {
      schemas: false,
      enums: true,
      arrays: false,
    },
  },
];

export default CONNECTION_DETAILS;
