import {
  Dialect,
  ModelAttributeColumnOptions,
  ModelAttributes,
  QueryInterface,
  Sequelize,
} from 'sequelize';

import { Logger } from '@forestadmin/datasource-toolkit';
import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import DefaultValueParser from './utils/default-value-parser';
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

  async build() {
    const tableNames = await this.queryInterface.showAllTables();

    await this.defineModels(tableNames);
    await this.defineRelations(tableNames);

    this.createCollections(this.sequelize.models, this.logger);
  }

  private async defineModels(tableNames: string[]): Promise<void[]> {
    return Promise.all(
      tableNames.map(async tableName => {
        this.logger?.('Debug', `Introspecting table '${tableName}'`);
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

  private async defineRelations(tableNames: string[]): Promise<void[]> {
    return Promise.all(
      tableNames.map(async tableName => {
        const foreignReferences = await this.queryInterface.getForeignKeyReferencesForTable(
          tableName,
        );

        const currentModel = this.sequelize.model(tableName);

        if (this.isJunctionTable(currentModel.getAttributes())) {
          const {
            referencedTableName: tableA,
            columnName: columnA,
            referencedColumnName: referencedColumnA,
          } = foreignReferences[0];
          const {
            referencedTableName: tableB,
            columnName: columnB,
            referencedColumnName: referencedColumnB,
          } = foreignReferences[1];

          const modelA = this.sequelize.model(tableA);
          const modelB = this.sequelize.model(tableB);

          modelA.belongsToMany(modelB, {
            through: currentModel.name,
            foreignKey: columnA,
            otherKey: columnB,
          });
          modelB.belongsToMany(modelA, {
            through: currentModel.name,
            foreignKey: columnB,
            otherKey: columnA,
          });
          currentModel.belongsTo(modelA, { foreignKey: columnA, targetKey: referencedColumnA });
          currentModel.belongsTo(modelB, { foreignKey: columnB, targetKey: referencedColumnB });
        } else {
          const uniqueFields = await this.getUniqueFields(tableName);

          foreignReferences.forEach(foreignReference => {
            const { columnName, referencedTableName, referencedColumnName } = foreignReference;

            const referencedModel = this.sequelize.model(referencedTableName);

            currentModel.belongsTo(referencedModel, {
              foreignKey: columnName,
              targetKey: referencedColumnName,
            });

            if (uniqueFields.includes(columnName)) {
              referencedModel.hasOne(currentModel, {
                foreignKey: columnName,
                sourceKey: referencedColumnName,
              });
            } else {
              referencedModel.hasMany(currentModel, {
                foreignKey: columnName,
                sourceKey: referencedColumnName,
              });
            }
          });
        }
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

  private isJunctionTable(modelAttributes: {
    [attribute: string]: ModelAttributeColumnOptions;
  }): boolean {
    // remove autogenerated field to keep the belongsToMany behavior
    const modelAttributesDefinition = Object.values(modelAttributes).filter(
      ({ _autoGenerated }) => !_autoGenerated,
    );
    if (modelAttributesDefinition.length !== 2) return false;

    if (modelAttributesDefinition.some(({ primaryKey }) => !primaryKey)) return false;

    return true;
  }

  private async getUniqueFields(tableName: string): Promise<string[]> {
    const tableIndex = await this.queryInterface.showIndex(tableName);

    return tableIndex
      .filter(({ primary, unique }) => !primary && unique)
      .map(({ fields }) => fields.map(({ attribute }) => attribute))
      .flat();
  }
}
