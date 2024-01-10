/* eslint-disable max-len */
import type {
  TCollectionName,
  TColumnName,
  TFieldName,
  TPartialSimpleRow,
  TSchema,
} from '@forestadmin/datasource-customizer';
import type CollectionCustomizationContext from '@forestadmin/datasource-customizer/dist/context/collection-context';
import type WriteCustomizationContext from '@forestadmin/datasource-customizer/dist/decorators/write/write-replace/context';

export type File = {
  name: string;
  buffer: Buffer;
  mimeType: string;
  charset?: string;
};

export interface IClient {
  getUrlFromKey(key: string): Promise<string>;
  load(key: string): Promise<File>;
  save?(key: string, file: File): Promise<void>;
  delete?(key: string): Promise<void>;
}

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

  client: IClient;
};

export type Configuration<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = Required<
  Pick<Options<S, N>, 'deleteFiles' | 'storeAt' | 'objectKeyFromRecord'> & {
    client: IClient;
    sourcename: TColumnName<S, N>;
    filename: TColumnName<S, N>;
  }
>;
