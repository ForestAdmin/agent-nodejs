import { buildSequelizeInstance } from '@forestadmin/datasource-sql';
import { DataType, DataTypes, ModelAttributes, Sequelize } from 'sequelize';

import { CachedCollectionSchema, CachedDataSourceOptions, Field } from './types';

function convertField(field: Field): ModelAttributes[string] {
  if (field.type === 'Object' || field.type === 'Array') {
    return { type: DataTypes.JSON, allowNull: true, primaryKey: false };
  }

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

function defineModels(
  options: CachedDataSourceOptions,
  schema: CachedCollectionSchema[],
  sequelize: Sequelize,
) {
  for (const model of schema) {
    const modelName = `${options.namespace}_${model.name}`;
    const attributes: ModelAttributes = {};

    for (const [name, field] of Object.entries(model.fields)) {
      attributes[name] = convertField(field);
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

    for (const [name, field] of Object.entries(model.fields)) {
      if (field.type !== 'Array' && field.type !== 'Object' && field.reference) {
        const otherModelName = `${options.namespace}_${field.reference.targetCollection}`;
        const otherSequelizeModel = sequelize.model(otherModelName);

        sequelizeModel.belongsTo(otherSequelizeModel, {
          as: field.reference.relationName,
          foreignKey: name,
          targetKey: field.reference.targetField,
        });

        if (field.reference.relationInverse) {
          otherSequelizeModel.hasMany(sequelizeModel, {
            as: field.reference.relationName,
            foreignKey: name,
            sourceKey: field.reference.targetField,
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
