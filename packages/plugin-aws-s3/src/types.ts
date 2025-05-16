import type {
  TCollectionName,
  TColumnName,
  TFieldName,
  TPartialSimpleRow,
  TSchema,
} from '@forestadmin/datasource-customizer';
import type CollectionCustomizationContext from '@forestadmin/datasource-customizer/dist/context/collection-context';
import type WriteCustomizationContext from '@forestadmin/datasource-customizer/dist/decorators/write/write-replace/context';

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
   * This function allows customizing the string that will be saved in the database.
   * If the objectKeyFromRecord option is not set, the output of that function will also
   * be used as the object key in S3.
   *
   * Note that the recordId parameter will _not_ be provided when records are created.
   *
   * Defaults to '<collection name>/<id>/<originalFilename>`.
   *
   * @example
   * ```js
   * storeAt: (recordId, originalFilename, context) => {
   *   return `${context.collection.name}/${recordId ?? 'new-record'}/${originalFilename}`;
   * }
   * ```
   */
  storeAt?: (
    recordId: string,
    originalFilename: string,
    context: WriteCustomizationContext<S, N>,
  ) => string | Promise<string>;

  /**
   * This function allows customizing the object key that will be used in S3 without interfering
   * with what is stored in the database.
   *
   * @example
   * ```
   * objectKeyFromRecord: {
   *   extraDependencies: ['firstname', 'lastname'],
   *   mappingFunction: (record, context) => {
   *     return `avatars/${record.firstname}-${record.lastname}.png`;
   *   }
   * };
   * ```
   */
  objectKeyFromRecord?: {
    extraDependencies?: TFieldName<S, N>[];
    mappingFunction: (
      record: TPartialSimpleRow<S, N>,
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

    /** AWS forcePathStyle, defauls to false */
    forcePathStyle?: boolean;
  };
};

export type Configuration<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = Required<
  Pick<Options<S, N>, 'acl' | 'deleteFiles' | 'readMode' | 'storeAt' | 'objectKeyFromRecord'> & {
    client: Client;
    sourcename: TColumnName<S, N>;
    filename: TColumnName<S, N>;
  }
>;
