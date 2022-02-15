import { Dialect, col, fn, literal } from 'sequelize';

import { DateOperation } from '@forestadmin/datasource-toolkit';

import { Fn } from 'sequelize/dist/lib/utils';

export default class DateAggregationConverter {
  private static convertPostgres(field: string, operation: DateOperation): Fn {
    const aggregateFunction = fn('DATE_TRUNC', operation.toLocaleLowerCase(), col(field));

    return fn('TO_CHAR', aggregateFunction, 'YYYY-MM-DD');
  }

  private static convertMssql(field: string, operation: DateOperation): Fn {
    const dayFormat = 'yyyy-MM-dd';

    if (operation === DateOperation.ToWeek) {
      const aggregateFunction = fn(
        'DATEADD',
        literal('DAY'),
        literal(`-DATEPART(dw, ${field})+2`),
        col(field),
      );

      return fn('FORMAT', aggregateFunction, dayFormat);
    }

    let format: string;

    switch (operation) {
      case DateOperation.ToYear:
        format = 'yyyy-01-01';
        break;
      case DateOperation.ToMonth:
        format = 'yyyy-MM-01';
        break;
      case DateOperation.ToDay:
        format = dayFormat;
        break;
      default:
        throw new Error(`Unknow Date operation: "${operation}"`);
    }

    return fn('FORMAT', col(field), format);
  }

  private static convertMysql(field: string, operation: DateOperation): Fn {
    const dayFormat = '%Y-%m-%d';

    if (operation === DateOperation.ToWeek) {
      const aggregateFunction = fn(
        'DATE_SUB',
        col(field),
        literal(`INTERVAL(WEEKDAY(${field})) DAY`),
      );

      return fn('DATE_FORMAT', aggregateFunction, dayFormat);
    }

    let format: string;

    switch (operation) {
      case DateOperation.ToYear:
        format = '%Y-01-01';
        break;
      case DateOperation.ToMonth:
        format = '%Y-%m-01';
        break;
      case DateOperation.ToDay:
        format = dayFormat;
        break;
      default:
        throw new Error(`Unknow Date operation: "${operation}"`);
    }

    return fn('DATE_FORMAT', col(field), format);
  }

  private static convertSqlite(field: string, operation: DateOperation): Fn {
    if (operation === DateOperation.ToWeek) {
      return fn('DATE', col(field), 'weekday 0');
    }

    let format: string;

    switch (operation) {
      case DateOperation.ToYear:
        format = '%Y-01-01';
        break;
      case DateOperation.ToMonth:
        format = '%Y-%m-01';
        break;
      case DateOperation.ToDay:
        format = '%Y-%m-%d';
        break;
      default:
        throw new Error(`Unknow Date operation: "${operation}"`);
    }

    return fn('STRFTIME', format, col(field));
  }

  static convertToDialect(dialect: Dialect, field: string, operation: DateOperation): Fn {
    switch (dialect) {
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
        throw new Error(`Unsupported dialect: "${dialect}"`);
    }
  }
}
