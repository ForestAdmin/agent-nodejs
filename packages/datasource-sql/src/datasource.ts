import { ColumnsDescription, Dialect, QueryInterface, Sequelize } from 'sequelize';

import { Logger } from '@forestadmin/datasource-toolkit';
import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import { FieldDescription } from './utils/types';
import DefaultValueParser from './utils/default-value-parser';
import ModelFactory from './utils/model-factory';
import RelationFactory from './utils/relation-factory';
import SqlTypeConverter from './utils/sql-type-converter';

export default class SqlDataSource extends SequelizeDataSource {
  private readonly queryInterface: QueryInterface;
  private readonly defaultValueParser: DefaultValueParser;
  private readonly sqlTypeConverter: SqlTypeConverter;
  protected logger: Logger;

  constructor(connectionUri: string, logger?: Logger) {
    const logging = (sql: string) => logger?.('Debug', sql.substring(sql.indexOf(':') + 2));
    super(new Sequelize(connectionUri, { logging }));

    this.logger = logger;
    this.queryInterface = this.sequelize.getQueryInterface();
    this.defaultValueParser = new DefaultValueParser(this.sequelize.getDialect() as Dialect);
    this.sqlTypeConverter = new SqlTypeConverter(this.sequelize);
  }

  /**
   * Fixes Sequelize behavior incorrectly implemented.
   * Types indicate that showAllTables() should return a list of string, but it
   * returns a list of object for both mariadb & mssql
   * @see https://github.com/sequelize/sequelize/blob/main/src/dialects/mariadb/query.js#L295
   */
  async getRealTableNames(): Promise<string[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableNames = (await this.queryInterface.showAllTables()) as Array<any>;

    return tableNames.map(tableName => tableName?.tableName || tableName);
  }

  async build() {
    const tableNames = await this.getRealTableNames();

    await this.defineModels(tableNames);
    await this.defineRelations(tableNames);

    this.createCollections(this.sequelize.models, this.logger);
  }

  private async defineModels(tableNames: string[]): Promise<void> {
    const modelToBuild = tableNames.map(async tableName => {
      const columnDescriptions = await this.queryInterface.describeTable(tableName);
      const fieldDescriptions = await this.buildFieldDescriptions(columnDescriptions, tableName);
      ModelFactory.build(tableName, fieldDescriptions, this.sequelize);
    });
    await Promise.all(modelToBuild);
  }

  private async buildFieldDescriptions(
    columnDescriptions: ColumnsDescription,
    tableName: string,
  ): Promise<FieldDescription[]> {
    const fields = Object.entries(columnDescriptions).map(
      async ([columnName, columnDescription]) => {
        try {
          const type = await this.sqlTypeConverter.convert(
            tableName,
            columnName,
            columnDescription,
          );

          let defaultValue = this.defaultValueParser.parse(columnDescription.defaultValue, type);

          if (columnDescription.primaryKey && defaultValue) {
            defaultValue = null;
            columnDescription.autoIncrement = true;
          }

          return [columnName, { ...columnDescription, type, defaultValue }];
        } catch (e) {
          this.logger?.('Warn', `Skipping column ${tableName}.${columnName} (${e.message})`);
        }
      },
    );

    const fieldDescriptions = await Promise.all(fields);

    return fieldDescriptions.filter(Boolean);
  }

  private async defineRelations(tableNames: string[]): Promise<void> {
    const relationsToBuild = tableNames.map(async tableName => {
      const foreignReferences = await this.queryInterface.getForeignKeyReferencesForTable(
        tableName,
      );
      const uniqueFields = await this.getUniqueFields(tableName);
      RelationFactory.build(tableName, foreignReferences, uniqueFields, this.sequelize);
    });

    await Promise.all(relationsToBuild);
  }

  private async getUniqueFields(tableName: string): Promise<string[]> {
    const tableIndex = await this.queryInterface.showIndex(tableName);

    return tableIndex
      .filter(({ primary, unique, fields }) => !primary && unique && fields.length === 1)
      .map(({ fields }) => fields.map(({ attribute }) => attribute))
      .flat();
  }
}
