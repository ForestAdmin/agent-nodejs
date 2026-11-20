import { isLightMode, sqlOptions, sqlUri } from '../../src/connections/sql-options';

describe('sql connection options', () => {
  it('runs in light mode unless EXAMPLE_LIGHT is false, like docker compose up', () => {
    expect(isLightMode(undefined)).toBe(true);
    expect(isLightMode('true')).toBe(true);
    expect(isLightMode('false')).toBe(false);
  });

  it('points each engine to its own container in full mode', () => {
    expect(sqlUri('mysql', false)).toBe('mysql://example:password@localhost:3306/example');
    expect(sqlUri('mariadb', false)).toBe('mariadb://example:password@localhost:3808/example');
    expect(sqlUri('mssql', false)).toBe('mssql://sa:yourStrong(!)Password@localhost:1433/example');
  });

  it('points each engine to its own database in the postgres container in light mode', () => {
    expect(sqlUri('mysql', true)).toBe('postgres://example:password@localhost:5442/example_mysql');
    expect(sqlUri('mariadb', true)).toBe(
      'postgres://example:password@localhost:5442/example_mariadb',
    );
    expect(sqlUri('mssql', true)).toBe('postgres://example:password@localhost:5442/example_mssql');
  });

  it('gives the same target as an options object', () => {
    expect(sqlOptions('mariadb', true)).toEqual({
      dialect: 'postgres',
      username: 'example',
      password: 'password',
      host: 'localhost',
      port: 5442,
      database: 'example_mariadb',
    });
  });
});
