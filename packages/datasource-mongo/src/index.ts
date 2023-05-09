import { MongooseDatasource } from '@forestadmin/datasource-mongoose';
import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import { readFile, writeFile } from 'fs/promises';
import stringify from 'json-stringify-pretty-compact';
import mongoose, { Connection } from 'mongoose';

import Introspection from './introspection';
import { ModelStudyDef } from './introspection/types';
import OdmBuilder from './odm-builder';
import { IntrospectOptions, MongoOptions } from './type';

export { ModelStudyDef };
export { IntrospectOptions, MongoOptions };

export async function introspect(options: IntrospectOptions): Promise<ModelStudyDef[]> {
  const { uri, connectOptions, introspectionOptions } = options;
  let connection: Connection;

  try {
    connection = mongoose.createConnection(uri, connectOptions);

    return await Introspection.introspect(connection.getClient().db(), introspectionOptions);
  } finally {
    await connection?.close(true);
  }
}

export function createMongoDataSource(options: MongoOptions): DataSourceFactory {
  // Extract options
  const { uri, connectOptions, introspectionOptions } = options;
  const introspectionPath = 'introspectionPath' in options ? options.introspectionPath : undefined;
  const otherOptions = {
    flattenMode: options.flattenMode,
    flattenOptions: 'flattenOptions' in options ? options.flattenOptions : undefined,
    asModels: 'asModels' in options ? options.asModels : undefined,
  };

  // Check that either introspection or introspectionPath is provided, but not both
  let introspectionRef = 'introspection' in options ? options.introspection : undefined;
  if (!introspectionRef && !introspectionPath)
    throw new Error('You must provide either introspection or introspectionPath');
  if (introspectionRef && introspectionPath)
    throw new Error('You cannot provide both introspection and introspectionPath');

  return async (logger: Logger) => {
    const connection = mongoose.createConnection(uri, connectOptions);
    const db = connection.getClient().db();

    if (!introspectionRef) {
      try {
        introspectionRef = JSON.parse(await readFile(introspectionPath, 'utf-8'));
        logger('Info', `Loaded MongoDB structure from: '${introspectionPath}'`);
      } catch {
        logger('Info', `MongoDB structure file not found at '${introspectionPath}'`);
        introspectionRef = await Introspection.introspect(db, introspectionOptions);

        await writeFile(
          introspectionPath,
          stringify(introspectionRef, { indent: 2, maxLength: 100 }),
        );
        logger('Info', `Saved MongoDB structure to: '${introspectionPath}'`);
      }
    }

    OdmBuilder.defineModels(connection, introspectionRef);

    return new MongooseDatasource(connection, otherOptions, logger);
  };
}
