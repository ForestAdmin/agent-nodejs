/* eslint-disable no-await-in-loop */
import type { Sequelize } from 'sequelize';

import { NodeStudy, createNode, walkNode } from './analyzer';
import { CachedCollectionSchema, CachedDataSourceOptions } from '../../types';
import { resolveValueOrPromiseOrFactory } from '../utils';

async function guessSchema(
  rawOptions: CachedDataSourceOptions,
  sequelize: Sequelize,
): Promise<CachedCollectionSchema[]> {
  const recordCache = sequelize.model('forest_pending_records');
  const nodes: Record<string, NodeStudy> = {};

  // Schema was not cached, we need to compute it
  let more = true;
  let state = null;

  while (more) {
    const page = await rawOptions.pullDumpHandler({
      reasons: [{ at: new Date(), collections: null, reason: 'startup' }],
      collections: null,
      cache: null,
      previousDumpState: state,
    });

    for (const record of page.entries) {
      if (!nodes[record.collection]) nodes[record.collection] = createNode();
      walkNode(nodes[record.collection], record.record);
    }

    await recordCache.bulkCreate(page.entries);

    more = page.more;
    if (page.more === true) state = page.nextDumpState;
    if (page.more === false) state = page.nextDeltaState;
  }
}

export default async function getSchema(
  rawOptions: CachedDataSourceOptions,
  sequelize: Sequelize,
): Promise<CachedCollectionSchema[]> {
  // Schema is provided by the user
  if (rawOptions.schema) {
    return resolveValueOrPromiseOrFactory(rawOptions.schema);
  }

  // Schema was already computed and cached
  const schemaCache = sequelize.model('forest_schema');
  const schemaFromDb = await schemaCache.findOne({ where: { id: rawOptions.cacheNamespace } });
  if (schemaFromDb) return schemaFromDb.dataValues.schema;

  // Schema was not cached, we need to guess it from the records.
  const guessedSchema = await guessSchema(rawOptions, sequelize);
  await schemaCache.create({ id: rawOptions.cacheNamespace, schema: guessedSchema });

  return guessedSchema;
}

// function convertAnalysisToSchema(node: NodeStudy): CachedCollectionSchema['fields'] {
//   const schema: CachedCollectionSchema['fields'] = {};

//   for (const [key, value] of Object.entries(node.object)) {
//     const types = Object.keys(value.types).filter(t => t !== 'null');
//     let columnType = types.length === 1 ? types[0] : 'Json';

//     if (columnType === 'Json')

//     if (columnType === 'Object' || columnType === 'Array') columnType = 'Json';

//     schema[key] = {
//       type: columnType as ColumnType,
//       isPrimaryKey: key === 'id',
//     };
//   }

//   return schema;
// }

// async function guessSchema(options: CachedDataSourceOptions): Promise<CachedCollectionSchema[]> {
//   const nodesByCollection: Record<string, NodeStudy> = {};
//   let more = true;
//   let state = null;

//   while (more) {
//     // eslint-disable-next-line no-await-in-loop
//     const output = await (options as DumpOptions).getDump({
//       previousDumpState: state,
//       collections: [],
//       cache: null,
//       reasons: [{ reason: 'schema-discovery', at: new Date(), collections: [] }],
//     });

//     for (const { collection, record } of output.entries) {
//       if (!nodesByCollection[collection])
//         nodesByCollection[collection] = RecordAnalyzer.createNode();
//       RecordAnalyzer.walkNode(nodesByCollection[collection], record, 0);
//     }

//     more = output.more;
//     if (output.more) state = output.nextDumpState;
//   }

//   const schema = [];

//   for (const [collection, node] of Object.entries(nodesByCollection)) {
//     schema.push({
//       name: collection,
//       fields: convertAnalysisToSchema(node),
//     });
//   }

//   return schema;
// }
