import { buildSequelizeInstance } from '@forestadmin/datasource-sql';
import { ColumnType } from '@forestadmin/datasource-toolkit';
import { DataType, DataTypes, ModelAttributes, Sequelize } from 'sequelize';

import { CachedCollectionSchema, CachedDataSourceOptions } from './types';

function convertType(column: ColumnType): DataType {
  if (column === 'Binary') return DataTypes.BLOB('long');
  if (column === 'Boolean') return DataTypes.BOOLEAN;
  if (column === 'Date') return DataTypes.DATE;
  if (column === 'Dateonly') return DataTypes.DATEONLY;
  if (column === 'Json') return DataTypes.JSON;
  if (column === 'Number') return DataTypes.DOUBLE;
  if (column === 'String') return DataTypes.TEXT;

  return DataTypes.STRING;
}

function defineModels(
  options: CachedDataSourceOptions,
  schema: CachedCollectionSchema[],
  sequelize: Sequelize,
) {
  for (const model of schema) {
    const modelName = `${options.namespace}_${model.name}`;
    const attributes: ModelAttributes = {};

    for (const [name, column] of Object.entries(model.fields)) {
      if (column.type === 'Column') {
        attributes[name] = {
          type:
            column.columnType === 'Enum'
              ? new DataTypes.ENUM(...column.enumValues)
              : convertType(column.columnType),
          allowNull: true,
          primaryKey: column.isPrimaryKey,
          defaultValue: column.defaultValue,
        };
      }
    }

    sequelize.define(modelName, attributes, { timestamps: false });
  }
}

function defineRelationships(
  options: CachedDataSourceOptions,
  schema: CachedCollectionSchema[],
  sequelize: Sequelize,
) {
  for (const model of schema) {
    const modelName = `${options.namespace}_${model.name}`;
    const sequelizeModel = sequelize.model(modelName);

    for (const [name, relation] of Object.entries(model.fields)) {
      if (relation.type !== 'Column') {
        const otherModelName = `${options.namespace}_${relation.foreignCollection}`;
        const otherSequelizeModel = sequelize.model(otherModelName);

        if (relation.type === 'ManyToOne') {
          sequelizeModel.belongsTo(otherSequelizeModel, {
            as: name,
            foreignKey: relation.foreignKey,
            targetKey: relation.foreignKeyTarget,
          });
        } else if (relation.type === 'OneToMany') {
          sequelizeModel.hasMany(otherSequelizeModel, {
            as: name,
            foreignKey: relation.originKey,
            sourceKey: relation.originKeyTarget,
          });
        }
      }
    }
  }
}

export default async function createSequelize(
  options: CachedDataSourceOptions,
  schema: CachedCollectionSchema[],
) {
  const sequelize = await buildSequelizeInstance(
    options.cacheInto ?? 'sqlite::memory:',
    () => {},
    [],
  );

  sequelize.define(`forest_sync_state`, {
    id: { type: DataTypes.STRING, primaryKey: true },
    state: DataTypes.TEXT,
  });

  defineModels(options, schema, sequelize);

  // Sync models before defining associations
  // This ensure that the foreign key contraints are not set which is convenient
  // for a caching use-case: we want to be able to load records in any order.
  await sequelize.sync();

  defineRelationships(options, schema, sequelize);

  return sequelize;
}
