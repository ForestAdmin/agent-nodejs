/* eslint-disable no-await-in-loop */
import { buildSequelizeInstance } from '@forestadmin/datasource-sql';
import { Logger } from '@forestadmin/datasource-toolkit';
import { DataType, DataTypes, ModelAttributes, Sequelize } from 'sequelize';

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

async function defineModels(
  sync: boolean,
  namespace: string,
  schema: CachedCollectionSchema[],
  sequelize: Sequelize,
) {
  for (const model of schema) {
    // const modelName = `${namespace}_${model.name}`;
    const attributes: ModelAttributes = {};

    for (const [name, field] of Object.entries(model.fields)) {
      attributes[name] = convertField(field);
    }

    const sequelizeModel = sequelize.define(model.name, attributes, {
      timestamps: false,
      tableName: `${namespace}_${model.name}`,
    });

    if (sync) await sequelizeModel.sync({ force: true });
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

export async function createSequelize(logger: Logger, options: CachedDataSourceOptions) {
  const sequelize = await buildSequelizeInstance(options.cacheInto, logger, []);

  // This table should never need to change => use normal sync
  await sequelize
    .define(`${options.cacheNamespace}_metadata`, {
      id: { type: DataTypes.STRING, primaryKey: true },
      content: DataTypes.JSON,
    })
    .sync();

  // This table should never be reused between runs => force: true
  await sequelize
    .define(`${options.cacheNamespace}_pending_operations`, {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      type: DataTypes.ENUM('dump', 'delta'),
      content: DataTypes.JSON,
    })
    .sync({ force: true });

  return sequelize;
}

export async function createModels(sequelize: Sequelize, options: ResolvedOptions) {
  const metadata = sequelize.model(`${options.cacheNamespace}_metadata`);
  const cachedSchema = (await metadata.findByPk('flat_schema'))?.dataValues?.content;
  const sync = JSON.stringify(cachedSchema) !== JSON.stringify(options.flattenSchema);

  // Tell the use what we are doing
  const level = options.cacheInto !== 'sqlite::memory:' ? 'Info' : 'Debug';

  if (!cachedSchema) {
    options.logger(level, `${options.cacheNamespace}: Initializing cache.`);
  } else if (sync) {
    options.logger(level, `${options.cacheNamespace}: Schema changed, reinitializing cache.`);
  } else {
    options.logger(level, `${options.cacheNamespace}: Cache already initialized.`);
  }

  // Sync
  await defineModels(sync, options.cacheNamespace, options.flattenSchema, sequelize);
  defineRelationships(options.flattenSchema, sequelize);

  // Set up metadata depending on the type of sync we did
  if (sync) {
    await metadata.truncate();
    await metadata.create({ id: 'schema', content: options.schema });
    await metadata.create({ id: 'flat_schema', content: options.flattenSchema });
  }
}
