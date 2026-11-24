import 'dotenv/config';

export type SqlEngine = 'mariadb' | 'mssql' | 'mysql';

export type SqlOptions = {
  dialect: 'mariadb' | 'mssql' | 'mysql' | 'postgres';
  username: string;
  password: string;
  host: string;
  port: number;
  database: string;
};

const FULL_MODE_OPTIONS: Record<SqlEngine, SqlOptions> = {
  mariadb: {
    dialect: 'mariadb',
    username: 'example',
    password: 'password',
    host: 'localhost',
    port: 3808,
    database: 'example',
  },
  mssql: {
    dialect: 'mssql',
    username: 'sa',
    password: 'yourStrong(!)Password',
    host: 'localhost',
    port: 1433,
    database: 'example',
  },
  mysql: {
    dialect: 'mysql',
    username: 'example',
    password: 'password',
    host: 'localhost',
    port: 3306,
    database: 'example',
  },
};

export function isLightMode(exampleLight: string | undefined): boolean {
  return exampleLight !== 'false';
}

export function sqlOptions(
  engine: SqlEngine,
  lightMode = isLightMode(process.env.EXAMPLE_LIGHT),
): SqlOptions {
  if (!lightMode) return FULL_MODE_OPTIONS[engine];

  return {
    dialect: 'postgres',
    username: 'example',
    password: 'password',
    host: 'localhost',
    port: 5442,
    database: `example_${engine}`,
  };
}

export function sqlUri(
  engine: SqlEngine,
  lightMode = isLightMode(process.env.EXAMPLE_LIGHT),
): string {
  const { dialect, username, password, host, port, database } = sqlOptions(engine, lightMode);

  return `${dialect}://${username}:${password}@${host}:${port}/${database}`;
}
