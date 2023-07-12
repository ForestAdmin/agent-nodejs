/* eslint-disable no-await-in-loop */
import type { Sequelize } from 'sequelize';

import { NodeStudy } from './analyzer';
import { CachedCollectionSchema, CachedDataSourceOptions } from '../../types';
import { resolveValueOrPromiseOrFactory } from '../utils';

function convertAnalysisToSchema(node: NodeStudy): CachedCollectionSchema['fields'] {
  const schema: CachedCollectionSchema['fields'] = {};

  for (const [key, value] of Object.entries(node.object)) {
    const types = Object.keys(value.types).filter(t => t !== 'null');
    let columnType = types.length === 1 ? types[0] : 'Json';

    // if (columnType === 'Json')
    if (columnType === 'Object' || columnType === 'Array') columnType = 'Json';

    schema[key] = {
      type: columnType as ColumnType,
      isPrimaryKey: key === 'id',
    };
  }

  return schema;
}

export async function getSchema(
  rawOptions: CachedDataSourceOptions,
  connection: Sequelize,
): Promise<CachedCollectionSchema[]> {
  // Schema is provided by the user
  if (rawOptions.schema) {
    return resolveValueOrPromiseOrFactory(rawOptions.schema);
  }

  // Schema was already computed and cached
  const schemaCache = connection.model('forest_schema');
  const schemaFromDb = await schemaCache.findOne({ where: { id: rawOptions.cacheNamespace } });
  if (schemaFromDb) return schemaFromDb.dataValues.schema;

  return null;
}

export async function buildSchema(
  rawOptions: CachedDataSourceOptions,
  connection: Sequelize,
  analysis: Record<string, NodeStudy>,
): Promise<CachedCollectionSchema[]> {
  const schema: CachedCollectionSchema[] = Object.entries(analysis).map(([name, node]) => ({
    name,
    fields: convertAnalysisToSchema(node),
  }));

  const schemaCache = connection.model('forest_schema');
  schemaCache.upsert({ id: rawOptions.cacheNamespace, schema });

  return schema;
}
