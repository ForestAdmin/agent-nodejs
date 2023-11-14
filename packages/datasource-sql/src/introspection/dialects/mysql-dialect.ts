import { QueryTypes, Sequelize } from 'sequelize';

import IntrospectionDialect, { ColumnDescription } from './dialect.interface';
import { SequelizeColumn, SequelizeTableIdentifier } from '../type-overrides';

type DBColumn = {
  Field: string;
  Type: string;
  Collation: string;
  Default: string;
  Null: 'YES' | 'NO';
  Key: 'PRI' | '';
  Extra: string;
  Comment: string;
};

export default class MySQLDialect implements IntrospectionDialect {
  async listColumns(
    tableNames: SequelizeTableIdentifier[],
    sequelize: Sequelize,
  ): Promise<ColumnDescription[][]> {
    if (!tableNames?.length) return Promise.resolve([]);

    return Promise.all(
      tableNames.map(async tableIdentifier => this.listColumnsForTable(tableIdentifier, sequelize)),
    );
  }

  private async listColumnsForTable(
    tableIdentifier: SequelizeTableIdentifier,
    sequelize: Sequelize,
  ): Promise<ColumnDescription[]> {
    const columns = await sequelize.query<DBColumn>(
      `
      SHOW FULL COLUMNS FROM \`${tableIdentifier.tableName.replace(/`/g, '')}\`    
    `,
      {
        type: QueryTypes.SELECT,
      },
    );

    return columns.map(this.getColumnDescription.bind(this));
  }

  private getColumnDescription(dbColumn: DBColumn): ColumnDescription {
    const type = dbColumn.Type.startsWith('enum')
      ? dbColumn.Type.replace(/^enum/, 'ENUM')
      : dbColumn.Type.toUpperCase();

    const sequelizeColumn: SequelizeColumn = {
      type,
      allowNull: dbColumn.Null === 'YES',
      comment: dbColumn.Comment || null,
      primaryKey: dbColumn.Key === 'PRI',
      defaultValue: dbColumn.Default,
      autoIncrement: dbColumn.Extra?.toLowerCase() === 'auto_increment',
    };

    const { defaultValue, isLiteralDefaultValue } = this.mapDefaultValue(dbColumn);

    return {
      ...sequelizeColumn,
      name: dbColumn.Field,
      defaultValue,
      isLiteralDefaultValue,
    };
  }

  /**
   * Fixes the default behavior of Sequelize that does not allow us to
   * detect if a value is a function call or a constant value
   */
  private mapDefaultValue(dbColumn: DBColumn): {
    defaultValue: string;
    isLiteralDefaultValue: boolean;
  } {
    if (dbColumn.Default === null) {
      return {
        defaultValue: null,
        isLiteralDefaultValue: false,
      };
    }

    const extra = dbColumn.Extra?.toUpperCase();

    if (extra?.includes('DEFAULT_GENERATED') || extra?.includes('AUTO_INCREMENT')) {
      return {
        defaultValue: dbColumn.Default,
        isLiteralDefaultValue: true,
      };
    }

    return {
      defaultValue: dbColumn.Default,
      isLiteralDefaultValue: false,
    };
  }
}
