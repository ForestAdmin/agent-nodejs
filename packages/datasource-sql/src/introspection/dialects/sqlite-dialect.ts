import { QueryTypes, Sequelize } from 'sequelize';

import IntrospectionDialect, { ColumnDescription } from './dialect.interface';
import { SequelizeTableIdentifier } from '../type-overrides';

type DBColumn = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string;
  pk: number;
};

export default class SQLiteDialect implements IntrospectionDialect {
  listColumns(
    tableNames: SequelizeTableIdentifier[],
    sequelize: Sequelize,
  ): Promise<ColumnDescription[][]> {
    if (!tableNames?.length) return Promise.resolve([]);

    return Promise.all(tableNames.map(tableName => this.listColumnsForTable(tableName, sequelize)));
  }

  private async listColumnsForTable(
    tableIdentifier: SequelizeTableIdentifier,
    sequelize: Sequelize,
  ): Promise<ColumnDescription[]> {
    const [columns, [{ sql }]] = await Promise.all([
      sequelize.query<DBColumn>(`PRAGMA table_info(:tableName)`, {
        type: QueryTypes.SELECT,
        replacements: { tableName: tableIdentifier.tableName },
      }),
      sequelize.query<{ sql }>(`SELECT sql FROM sqlite_master WHERE tbl_name=:tableName`, {
        type: QueryTypes.SELECT,
        replacements: { tableName: tableIdentifier.tableName },
      }),
    ]);

    return columns.map(column => ({
      name: column.name,
      type: column.type,
      allowNull: !column.notnull,
      primaryKey: Boolean(column.pk),
      // Not bullet proof, but that's all we can do with SQLite
      // without starting to parse SQL queries
      autoIncrement: sql.includes(`AUTOINCREMENT`),
      comment: null,
      ...this.mapDefaultValue(column),
    }));
  }

  private mapDefaultValue(column: DBColumn): {
    defaultValue: string;
    isLiteralDefaultValue: boolean;
  } {
    if (column.dflt_value === null || column.dflt_value?.toUpperCase() === 'NULL') {
      return {
        defaultValue: null,
        isLiteralDefaultValue: false,
      };
    }

    if (column.dflt_value?.startsWith("'") && column.dflt_value?.endsWith("'")) {
      return {
        defaultValue: column.dflt_value.slice(1, -1).replace(/''/g, "'"),
        isLiteralDefaultValue: false,
      };
    }

    if (!Number.isNaN(Number(column.dflt_value))) {
      return {
        defaultValue: column.dflt_value,
        isLiteralDefaultValue: false,
      };
    }

    return {
      defaultValue: column.dflt_value,
      isLiteralDefaultValue: true,
    };
  }
}
