import { buildSequelizeInstance } from '@forestadmin/datasource-sql';
import { Logger } from '@forestadmin/datasource-toolkit';
import { DataType, DataTypes, ModelAttributes, Sequelize } from 'sequelize';

import { flattenSchema } from './flattener';
import {
  CachedCollectionSchema,
  CachedDataSourceOptions,
  Field,
  ResolvedOptions,
  isLeafField,
} from './types';

function convertField(field: Field): ModelAttributes[string] {
  if (isLeafField(field)) {
    let type: DataType = DataTypes.JSON;
    if (field.type === 'Binary') type = DataTypes.BLOB('long');
    if (field.type === 'Boolean') type = DataTypes.BOOLEAN;
    if (field.type === 'Date') type = DataTypes.DATE;
    if (field.type === 'Dateonly') type = DataTypes.DATEONLY;
    if (field.type === 'Integer') type = DataTypes.INTEGER;
    if (field.type === 'Number') type = DataTypes.DOUBLE;
    if (field.type === 'String') type = DataTypes.TEXT;
    if (field.type === 'Enum') type = new DataTypes.ENUM(...field.enumValues);

    return {
      type,
      allowNull: true,
      primaryKey: field.isPrimaryKey,
      defaultValue: field.defaultValue,
    };
  }

  return { type: DataTypes.JSON, allowNull: true, primaryKey: false };
}

function defineModels(namespace: string, schema: CachedCollectionSchema[], sequelize: Sequelize) {
  for (const model of schema) {
    // const modelName = `${namespace}_${model.name}`;
    const attributes: ModelAttributes = {};

    for (const [name, field] of Object.entries(model.fields)) {
      attributes[name] = convertField(field);
    }

    sequelize.define(model.name, attributes, {
      timestamps: false,
      tableName: `${namespace}_${model.name}`,
    });
  }
}

function defineRelationships(schema: CachedCollectionSchema[], sequelize: Sequelize) {
  for (const model of schema) {
    const sequelizeModel = sequelize.model(model.name);

    for (const [name, field] of Object.entries(model.fields)) {
      if (isLeafField(field) && field.reference) {
        const otherSequelizeModel = sequelize.model(field.reference.targetCollection);

        sequelizeModel.belongsTo(otherSequelizeModel, {
          as: field.reference.relationName,
          foreignKey: name,
          targetKey: field.reference.targetField,
        });

        if (field.reference.relationInverse) {
          const handler = field.unique ? otherSequelizeModel.hasOne : otherSequelizeModel.hasMany;
          handler.call(otherSequelizeModel, sequelizeModel, {
            as: field.reference.relationInverse,
            foreignKey: name,
            sourceKey: field.reference.targetField,
          });
        }
      }
    }
  }
}

export async function createSequelize(
  logger: Logger,
  cacheInto: CachedDataSourceOptions['cacheInto'],
) {
  const sequelize = await buildSequelizeInstance(cacheInto ?? 'sqlite::memory:', logger, []);

  sequelize.define(`forest_sync_state`, {
    id: { type: DataTypes.STRING, primaryKey: true },
    state: DataTypes.TEXT,
  });

  sequelize.define('forest_schema', {
    id: { type: DataTypes.STRING, primaryKey: true },
    schema: DataTypes.JSON,
  });

  sequelize.define(`forest_pending_records`, {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    collection: DataTypes.STRING,
    record: DataTypes.JSON,
  });

  await sequelize.sync();

  return sequelize;
}

export async function createModels(sequelize: Sequelize, options: ResolvedOptions) {
  const flattenedSchema = flattenSchema(options.schema, options.flattenOptions);
  defineModels(options.cacheNamespace, flattenedSchema, sequelize);

  // Sync models before defining associations
  // This ensure that the foreign key contraints are not set which is convenient
  // for a caching use-case: we want to be able to load records in any order.

  // FIXME note that this will break if the schema changes
  // Ideally we should destroy the tables and recreate them, but only if the schema changed
  await sequelize.sync();

  defineRelationships(flattenedSchema, sequelize);
}
