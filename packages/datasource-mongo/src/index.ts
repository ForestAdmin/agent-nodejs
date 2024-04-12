import type { Introspection } from './introspection/types';
import type { ConnectionParams, IntrospectorParams, MongoDatasourceParams } from './types';
import type { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import type { Connection } from 'mongoose';

import { MongooseDatasource } from '@forestadmin/datasource-mongoose';
import { Mongoose } from 'mongoose';

import createConnection from './connection/create-connection';
import Introspector from './introspection/introspector';
import listCollectionsFromIntrospection from './introspection/list-collections-from-introspection';
import OdmBuilder from './odm-builder';

export type { Introspection };
export type { IntrospectorParams };
export type { MongoDatasourceParams };
export type { ConnectionParams };

export async function introspect(options: IntrospectorParams): Promise<Introspection> {
  let connection: Connection;

  try {
    connection = await createConnection(options);

    return await Introspector.introspect(connection.getClient().db(), options.introspection);
  } finally {
    await connection?.close(true);
  }
}

export async function buildMongooseInstance(
  introspectionOptions: IntrospectorParams,
  introspection?: Introspection,
): Promise<Connection> {
  const connection = await createConnection(introspectionOptions);

  try {
    Introspector.assertGivenIntrospectionInLatestFormat(introspection);

    const { models } =
      introspection ||
      (await Introspector.introspect(
        connection.getClient().db(),
        introspectionOptions.introspection,
      ));

    OdmBuilder.defineModels(connection, models);
  } catch (error) {
    await connection?.close(true);
    throw error;
  }

  return connection;
}

export function buildDisconnectedMongooseInstance(introspection: Introspection): Mongoose {
  const mongooseInstance = new Mongoose();
  OdmBuilder.defineModels(mongooseInstance, introspection.models);

  return mongooseInstance;
}

export function createMongoDataSource(
  params: MongoDatasourceParams,
  options?: { introspection: Introspection },
): DataSourceFactory {
  return async (logger: Logger) => {
    const connection = await buildMongooseInstance(params, options?.introspection);

    return new MongooseDatasource(connection, params.dataSource, logger);
  };
}

export { listCollectionsFromIntrospection };
