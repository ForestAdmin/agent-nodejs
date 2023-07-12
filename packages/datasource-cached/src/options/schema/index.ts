/* eslint-disable no-await-in-loop */
import type { Sequelize } from 'sequelize';

import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';

import { NodeStudy } from './analyzer';
import { CachedCollectionSchema, CachedDataSourceOptions, Field, isLeafField } from '../../types';
import { resolveValueOrPromiseOrFactory } from '../utils';

function convertAnalysisToSchema(node: NodeStudy): Field {
  const types = Object.keys(node.types).filter(t => t !== 'null');

  if (types.length > 1) return { type: 'Json' };

  if (types[0] === 'Object') {
    const entries = Object.entries(node.object).map(([k, v]) => [k, convertAnalysisToSchema(v)]);

    return Object.fromEntries(entries);
  }

  if (types[0] === 'Array') {
    return [convertAnalysisToSchema(node.arrayElement)];
  }

  return { type: types[0] as PrimitiveTypes };
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
  const schema: CachedCollectionSchema[] = Object.entries(analysis).map(([name, node]) => {
    const fields = convertAnalysisToSchema(node) as Record<string, Field>;

    if (isLeafField(fields.id)) fields.id.isPrimaryKey = true;
    else throw new Error(`No primary key found in the schema of the collection ${name}`);

    return { name, fields };
  });

  const schemaCache = connection.model('forest_schema');
  schemaCache.upsert({ id: rawOptions.cacheNamespace, schema });

  return schema;
}
