import { resolveValueOrPromiseOrFactory } from './utils';
import { CachedCollectionSchema, CachedDataSourceOptions } from '../types';

export default function getSchema(
  rawOptions: CachedDataSourceOptions,
): Promise<CachedCollectionSchema[]> {
  return resolveValueOrPromiseOrFactory(rawOptions.schema);
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
