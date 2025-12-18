import type { MongooseOptions as DataSourceMongooseOptions } from '@forestadmin/datasource-mongoose';
import type { ConnectOptions } from 'mongoose';
import type { SshOptions } from 'tunnel-ssh';

/** Options for the introspection */
export type IntrospectionOptions = {
  /**
   * Number of documents that should be loaded from each collection to guess the structure
   * Database where many fields are optional might need a higher number.
   *
   * Default: 100
   */
  collectionSampleSize?: number;

  /**
   * While streaming documents, the introspection process will remember a value for each field
   * and will query compatible collections with those to find references (foreign keys).
   *
   * This option defines the number of values that will be remembered.
   * - Setting a higher value will allow to avoid false positives.
   * - Setting this to 0 will disable the feature.
   *
   * Default: 10
   */
  referenceSampleSize?: number;

  /**
   * Maximum number of properties that will be loaded for each object.
   * Objects which have more properties will be considered as a `Mixed` type.
   *
   * This option allows detecting objects which use dynamic keys.
   *
   * Default: 30
   */
  maxPropertiesPerObject?: number;
};

export type ConnectionParams = {
  /**
   * Connection string (will be passed to mongoose)
   */
  uri: string;

  /**
   * Connection options that (will be passed to mongoose)
   */
  connection?: ConnectOptions & { ssh?: SshOptions };
};

export type IntrospectorParams = ConnectionParams & {
  introspection?: IntrospectionOptions;
};

export type MongoDatasourceParams = IntrospectorParams & {
  dataSource: DataSourceMongooseOptions;
};
