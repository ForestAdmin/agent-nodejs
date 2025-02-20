import { DateOperation } from '@forestadmin/datasource-toolkit';
import { Dialect, Sequelize } from 'sequelize';
import { Col, Fn, Literal } from 'sequelize/types/utils';

export default class DateAggregationConverter {
  private dialect: Dialect;
  private fn: Sequelize['fn'];
  private col: Sequelize['col'];
  private literal: Sequelize['literal'];

  constructor(sequelize: Sequelize) {
    this.dialect = sequelize.getDialect() as Dialect;
    this.fn = sequelize.fn;
    this.col = sequelize.col;
    this.literal = sequelize.literal;
  }

  private convertPostgres(field: string, operation: DateOperation): Fn {
    const aggregateFunction = this.fn('DATE_TRUNC', operation.toLocaleLowerCase(), this.col(field));

    return this.fn('TO_CHAR', aggregateFunction, 'YYYY-MM-DD');
  }

  private convertMssql(field: string, operation: DateOperation): Fn {
    let dateToConvert: Col | Fn;

    switch (operation) {
      case 'Year':
        dateToConvert = this.fn(
          'DATEFROMPARTS',
          this.fn('DATEPART', this.literal('YEAR'), this.col(field)),
          '01',
          '01',
        );
        break;
      case 'Quarter':
        dateToConvert = this.fn(
          'DATEFROMPARTS',
          this.fn('DATEPART', this.literal('YEAR'), this.col(field)),
          this.literal(`DATEPART(q, ${field})*3`),
          '01',
        ); // transform the row date to the first day of the last month of it quarter
        break;
      case 'Month':
        dateToConvert = this.fn(
          'DATEFROMPARTS',
          this.fn('DATEPART', this.literal('YEAR'), this.col(field)),
          this.fn('DATEPART', this.literal('MONTH'), this.col(field)),
          '01',
        );
        break;
      case 'Week':
        dateToConvert = this.fn(
          'DATEADD',
          this.literal('DAY'),
          this.literal(`-DATEPART(dw, ${field})+2`),
          this.col(field),
        );
        break;
      case 'Day':
        dateToConvert = this.col(field);
        break;
      default:
        throw new Error(`Unknown Date operation: "${operation}"`);
    }

    // https://docs.microsoft.com/en-us/sql/t-sql/functions/cast-and-convert-transact-sql?redirectedfrom=MSDN&view=sql-server-ver15
    return this.fn('CONVERT', this.literal('varchar(10)'), dateToConvert, 23);
  }

  private convertMysql(field: string, operation: DateOperation): Fn {
    let format = '%Y-%m-%d';
    let dateToConvert: Col | Fn | Literal = this.col(field);

    switch (operation) {
      case 'Year':
        format = '%Y-01-01';
        break;
      case 'Quarter':
        dateToConvert = this.literal(
          `MAKEDATE(YEAR(${field}), 1) + Interval QUARTER(${field})-1 QUARTER`,
        );
        break;
      case 'Month':
        format = '%Y-%m-01';
        break;
      case 'Week':
        dateToConvert = this.fn(
          'DATE_SUB',
          this.col(field),
          this.literal(`INTERVAL(WEEKDAY(${field})) DAY`),
        );
        break;
      case 'Day':
        break;
      default:
        throw new Error(`Unknown Date operation: "${operation}"`);
    }

    return this.fn('DATE_FORMAT', dateToConvert, format);
  }

  private convertSqlite(field: string, operation: DateOperation): Fn {
    if (operation === 'Week') {
      return this.fn('DATE', this.col(field), 'weekday 0');
    }

    if (operation === 'Quarter') {
      return this.fn(
        'DATE',
        this.literal(
          `STRFTIME('%Y', ${field}) || '-' || FORMAT('%02d', (FLOOR((STRFTIME('%m', ${field}) - 1) / 3) + 1) * 3) || '-01'`,
        ),
      );
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

    return this.fn('STRFTIME', format, this.col(field));
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
