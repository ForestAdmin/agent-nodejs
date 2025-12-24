import type { MySQLDBColumn } from './mysql-dialect';

import MySQLDialect from './mysql-dialect';

export default class MariadbDialect extends MySQLDialect {
  protected override mapDefaultValue(dbColumn: MySQLDBColumn): {
    defaultValue: string;
    isLiteralDefaultValue: boolean;
  } {
    if (dbColumn.Default === null || dbColumn.Default?.toLowerCase() === 'null') {
      return {
        defaultValue: null,
        isLiteralDefaultValue: false,
      };
    }

    if (dbColumn.Default?.startsWith("'") && dbColumn.Default?.endsWith("'")) {
      if (dbColumn.Type === 'text') {
        return {
          defaultValue: dbColumn.Default.slice(1, -1).replace(/\\(.)/g, '$1'),
          isLiteralDefaultValue: false,
        };
      }

      return {
        defaultValue: dbColumn.Default.slice(1, -1).replace(/''/g, "'").replace(/\\\\/g, '\\'),
        isLiteralDefaultValue: false,
      };
    }

    if (!Number.isNaN(Number(dbColumn.Default))) {
      return {
        defaultValue: dbColumn.Default,
        isLiteralDefaultValue: false,
      };
    }

    return {
      defaultValue: dbColumn.Default,
      isLiteralDefaultValue: true,
    };
  }
}
