import { DateOperation } from '@forestadmin/datasource-toolkit';
import { Col, Dialect, Fn, Literal, Sequelize, col, fn } from '@sequelize/core';

export default class DateAggregationConverter {
  private dialect: Dialect;

  constructor(sequelize: Sequelize) {
    this.dialect = sequelize.getDialect() as Dialect;
  }

  private convertPostgres(field: string, operation: DateOperation): Fn {
    const aggregateFunction = fn('DATE_TRUNC', [operation.toLocaleLowerCase(), col(field)]);

    return fn('TO_CHAR', [aggregateFunction, 'YYYY-MM-DD']);
  }

  private convertMssql(field: string, operation: DateOperation): Fn {
    let dateToConvert: Col | Fn;

    switch (operation) {
      case 'Year':
        dateToConvert = fn('DATEFROMPARTS', [
          fn('DATEPART', [new Literal('YEAR'), col(field)]),
          '01',
          '01',
        ]);
        break;
      case 'Month':
        dateToConvert = fn('DATEFROMPARTS', [
          fn('DATEPART', [new Literal('YEAR'), col(field)]),
          fn('DATEPART', [new Literal('MONTH'), col(field)]),
          '01',
        ]);
        break;
      case 'Week':
        dateToConvert = fn('DATEADD', [
          new Literal('DAY'),
          new Literal(`-DATEPART(dw, ${field})+2`),
          col(field),
        ]);
        break;
      case 'Day':
        dateToConvert = col(field);
        break;
      default:
        throw new Error(`Unknown Date operation: "${operation}"`);
    }

    // eslint-disable-next-line max-len
    // https://docs.microsoft.com/en-us/sql/t-sql/functions/cast-and-convert-transact-sql?redirectedfrom=MSDN&view=sql-server-ver15
    return fn('CONVERT', [new Literal('varchar(10)'), dateToConvert, 23]);
  }

  private convertMysql(field: string, operation: DateOperation): Fn {
    let format = '%Y-%m-%d';
    let dateToConvert: Col | Fn = col(field);

    switch (operation) {
      case 'Year':
        format = '%Y-01-01';
        break;
      case 'Month':
        format = '%Y-%m-01';
        break;
      case 'Week':
        dateToConvert = fn('DATE_SUB', [
          col(field),
          new Literal(`INTERVAL(WEEKDAY(${field})) DAY`),
        ]);
        break;
      case 'Day':
        break;
      default:
        throw new Error(`Unknown Date operation: "${operation}"`);
    }

    return fn('DATE_FORMAT', [dateToConvert, format]);
  }

  private convertSqlite(field: string, operation: DateOperation): Fn {
    if (operation === 'Week') {
      return fn('DATE', [col(field), 'weekday 0']);
    }

    let format: string;

    switch (operation) {
      case 'Year':
        format = '%Y-01-01';
        break;
      case 'Month':
        format = '%Y-%m-01';
        break;
      case 'Day':
        format = '%Y-%m-%d';
        break;
      default:
        throw new Error(`Unknown Date operation: "${operation}"`);
    }

    return fn('STRFTIME', [format, col(field)]);
  }

  convertToDialect(field: string, operation: DateOperation): Fn {
    switch (this.dialect) {
      case 'postgres':
        return this.convertPostgres(field, operation);
      case 'mssql':
        return this.convertMssql(field, operation);

      case 'mariadb':
      case 'mysql':
        return this.convertMysql(field, operation);

      case 'sqlite':
        return this.convertSqlite(field, operation);

      default:
        throw new Error(`Unsupported dialect: "${this.dialect}"`);
    }
  }
}
