import PublicationCollectionDataSourceDecorator from '@forestadmin/datasource-customizer/dist/decorators/publication-collection/datasource';
import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import SchemaDataSourceDecorator from './decorators/schema/data-source';
import SyncDataSourceDecorator from './decorators/sync/data-source';
import WriteDataSourceDecorator from './decorators/write/data-source';
import createSequelize from './sequelize';
import { CachedDataSourceOptions, ResolvedOptions, ValueOrPromiseOrFactory } from './types';

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

async function resolveValueOrPromiseOrFactory<T extends object>(
  v: ValueOrPromiseOrFactory<T>,
): Promise<T> {
  return typeof v === 'function' ? v() : v;
}

function createCachedDataSource(rawOptions: CachedDataSourceOptions): DataSourceFactory {
  return async (logger: Logger) => {
    const options: ResolvedOptions = {
      ...rawOptions,
      schema: await resolveValueOrPromiseOrFactory(rawOptions.schema),
      flattenOptions: await resolveValueOrPromiseOrFactory(rawOptions.flattenOptions),
    };

    if (
      options.flattenOptions &&
      (options.createRecord || options.updateRecord || options.deleteRecord)
    ) {
      throw new Error('Cannot use flattenOptions with createRecord, updateRecord or deleteRecord');
    }

    const connection = await createSequelize(options);
    const factory = createSequelizeDataSource(connection);

    const sequelizeDs = await factory(logger);
    const publicationDs = new PublicationCollectionDataSourceDecorator(sequelizeDs);
    publicationDs.keepCollectionsMatching(null, ['forest_sync_state']);

    const syncDataSource = new SyncDataSourceDecorator(publicationDs, connection, options);
    await syncDataSource.start();

    const writeDataSource = new WriteDataSourceDecorator(syncDataSource, options);
    const schemaDataSource = new SchemaDataSourceDecorator(writeDataSource, options);

    return schemaDataSource;
  };
}

export { ColumnType } from '@forestadmin/datasource-toolkit';
export * from './types';
export { createCachedDataSource };
