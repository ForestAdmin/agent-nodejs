import { Dialect, ModelAttributes, QueryInterface, Sequelize } from 'sequelize';

import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import DefaultValueParser from './utils/default-value-parser';
import SqlTypeConverter from './utils/sql-type-converter';

export default class SqlDataSource extends SequelizeDataSource {
  private readonly queryInterface: QueryInterface;
  private readonly defaultValueParser: DefaultValueParser;
  private readonly sqlTypeConverter: SqlTypeConverter;

  constructor(connectionUri: string) {
    super(new Sequelize(connectionUri, { logging: false }));

    this.queryInterface = this.sequelize.getQueryInterface();
    this.defaultValueParser = new DefaultValueParser(this.sequelize.getDialect() as Dialect);
    this.sqlTypeConverter = new SqlTypeConverter(this.sequelize);
  }

  async build() {
    const tableNames = await this.queryInterface.showAllTables();

    await this.defineModels(tableNames);

    this.createCollections(this.sequelize.models);
  }

  private async defineModels(tableNames: string[]): Promise<void[]> {
    return Promise.all(
      tableNames.map(async tableName => {
        const colmumnDescriptions = await this.queryInterface.describeTable(tableName);

        const fieldDescriptions = await Promise.all(
          Object.entries(colmumnDescriptions).map(async ([columnName, colmumnDescription]) => {
            const type = await this.sqlTypeConverter.convert(
              tableName,
              columnName,
              colmumnDescription,
            );

            let defaultValue = this.defaultValueParser.parse(colmumnDescription.defaultValue, type);

            if (colmumnDescription.primaryKey && defaultValue) {
              defaultValue = null;
              colmumnDescription.autoIncrement = true;
            }

            return [
              columnName,
              {
                ...colmumnDescription,
                type,
                defaultValue,
              },
            ];
          }),
        );

        let modelDefinition: ModelAttributes = Object.fromEntries(fieldDescriptions);
        const columnNames = Object.keys(modelDefinition);

        const hasTimestamps = this.hasTimestamps(columnNames);
        const isParanoid = this.isParanoid(columnNames);

        if (hasTimestamps) {
          modelDefinition = this.removeTimeStampColumns(modelDefinition);
        }

        if (isParanoid) {
          modelDefinition = this.removeParanoidColumn(modelDefinition);
        }

        this.sequelize.define(tableName, modelDefinition, {
          tableName,
          timestamps: hasTimestamps,
          paranoid: isParanoid,
        });
      }),
    );
  }

  private hasTimestamps(columnNames: string[]): boolean {
    const hasCreatedAt = columnNames.includes('createdAt');
    const hasUpdatedAt = columnNames.includes('updatedAt');

    return hasCreatedAt && hasUpdatedAt;
  }

  private removeTimeStampColumns(modelDefinition: ModelAttributes): ModelAttributes {
    const copy = { ...modelDefinition };
    delete copy.createdAt;
    delete copy.updatedAt;

    return copy;
  }

  private isParanoid(columnNames: string[]): boolean {
    return columnNames.includes('deletedAt');
  }

  private removeParanoidColumn(modelDefinition: ModelAttributes): ModelAttributes {
    const copy = { ...modelDefinition };
    delete copy.deletedAt;

    return copy;
  }
}
