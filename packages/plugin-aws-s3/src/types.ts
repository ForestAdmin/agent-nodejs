/* eslint-disable max-len */
import type {
  TCollectionName,
  TColumnName,
  TFieldName,
  TSchema,
} from '@forestadmin/datasource-customizer';
import type CollectionCustomizationContext from '@forestadmin/datasource-customizer/dist/context/collection-context';
import type WriteCustomizationContext from '@forestadmin/datasource-customizer/dist/decorators/write/write-replace/context';
import type { RecordData } from '@forestadmin/datasource-toolkit';

import { ObjectCannedACL } from '@aws-sdk/client-s3';

import Client from './utils/s3';

export type File = {
  name: string;
  buffer: Buffer;
  mimeType: string;
  charset?: string;
};

/**
 * Configuration for the AWS S3 addon of Forest Admin.
 *
 * It can be included in the global agent configuration under the "s3" key and overriden for
 * specific fields by using the "config" property on `AmazonS3File`.
 */
export type Options<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = {
  /** Name of the field that you want to use as a file-picker on the frontend */
  fieldname: TColumnName<S, N>;

  /**
   * Where should the file be stored on S3?
   * Defaults to '<collection_name>/<field_name>/`.
   */
  storeAt?: (
    recordId: string,
    originalFilename: string,
    context: WriteCustomizationContext<S, N>,
  ) =>
    | string
    | { AWSPath: string; databasePath: string }
    | Promise<string | { AWSPath: string; databasePath: string }>;

  /**
   * If and how should the database key be computed to match the actual bucket file name
   */
  bucketFilePathFromDatabaseKey?: {
    dependencies?: TFieldName<S, N>[];
    mappingFunction: (
      record: RecordData,
      context: CollectionCustomizationContext<S, N>,
    ) => string | Promise<string>;
  };

  /** Either if old files should be deleted when updating or deleting a record. */

  deleteFiles?: boolean;

  /**
   * 'url' (the default) will cause urls to be transmitted to the frontend. You final users
   * will download the file from S3.
   *
   * 'proxy' will cause files to be routed by the agent. Use this option only if you are
   * dealing with small files and are behind an entreprise proxy which forbids direct
   * access to S3.
   */
  readMode?: 'url' | 'proxy';

  /**
   * Which ACL to use on the uploaded objects.
   * Default is "private" (urls will be signed so that the files can be reached from the frontend).
   *
   * Valid values are "authenticated-read", "aws-exec-read", "bucket-owner-full-control",
   * "bucket-owner-read", "private", "public-read", "public-read-write".
   *
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/globals.html#objectcannedacl
   */
  acl?: ObjectCannedACL;

  /** AWS configuration */
  aws?: {
    /** AWS access key, defaults to process.env.AWS_ACCESS_KEY_ID. */
    accessKeyId?: string;

    /** AWS secret, defaults to process.env.AWS_ACCESS_KEY_SECRET. */
    secretAccessKey?: string;

    /** AWS region, defaults to process.env.AWS_DEFAULT_REGION. */
    region?: string;

    /** AWS bucket, defaults to process.env.AWS_S3_BUCKET */
    bucket?: string;

    /** AWS endpoint, defaults to process.env.AWS_S3_ENDPOINT */
    endpoint?: string;
  };
};

export type Configuration<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = Required<
  Pick<
    Options<S, N>,
    'acl' | 'deleteFiles' | 'readMode' | 'storeAt' | 'bucketFilePathFromDatabaseKey'
  > & {
    client: Client;
    sourcename: TColumnName<S, N>;
    filename: TColumnName<S, N>;
  }
>;
