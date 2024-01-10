import type { TCollectionName, TSchema } from '@forestadmin/datasource-customizer';
import type { ColumnSchema, Logger } from '@forestadmin/datasource-toolkit';

// import addDownloadAll from './actions/add-download-all';
import createField from './field/create-field';
import makeFieldDeleteable from './field/make-field-deleteable';
import makeFieldRequired from './field/make-field-required';
import makeFieldSortable from './field/make-field-sortable';
import makeFieldWritable from './field/make-field-writable';
import replaceField from './field/replace-field';
// import makeFieldRequired from './field/make-field-required';
// import makeFieldWritable from './field/make-field-writable';
// import replaceField from './field/replace-field';
import { Options } from './types';
// import Client from './utils/gcs';

// export { Options as CreateFileFieldOption, File, DownloadFilesOptions };

function assertIsSupportedType(field: string, collection) {
  const column = collection.schema.fields[field];

  if (
    !column ||
    !(
      column.columnType === 'String' ||
      (Array.isArray(column.columnType) && column.columnType[0] === 'String')
    )
  ) {
    throw new Error(
      `The field '${collection.name}.${field}' does not exist or is not a string or array of string.`,
    );
  }

  return true;
}

// eslint-disable-next-line import/prefer-default-export
export function createFileField<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
>(dataSource, collection, options: Options<S, N>, logger: Logger) {
  if (!collection) throw new Error('createFileField can only be used on collections.');
  if (!options) throw new Error('Options must be provided.');

  const sourceSchema = collection.schema.fields[options.fieldname] as ColumnSchema;

  if (sourceSchema.type !== 'Column') {
    const field = `${collection.name}.${options.fieldname}`;
    throw new Error(`The field '${field}' is not a field but a relation`);
  }

  assertIsSupportedType(options.fieldname, collection);

  const config = {
    sourcename: options.fieldname,
    filename: `${options.fieldname}__file`,
    client: options.client,
    storeAt: options?.storeAt ?? ((id, name) => `${collection.name}/${id}/${name}`),
    objectKeyFromRecord: options?.objectKeyFromRecord || null,
    deleteFiles: options?.deleteFiles ?? false,
  };

  createField(collection, config);
  if (options.client.save) makeFieldWritable(collection, config);
  makeFieldRequired(collection, config);
  makeFieldSortable(collection, config);
  if (options.client.delete) makeFieldDeleteable(collection, config);
  replaceField(collection, config);
}

// export function addDownloadFilesAction<
//   S extends TSchema = TSchema,
//   N extends TCollectionName<S> = TCollectionName<S>,
// >(datasource, collection, options: Options<S, N>, logger: Logger) {
//   if (!collection) throw new Error('createFileField can only be used on collections.');
//   if (!options) throw new Error('Options must be provided.');
//   if (options.fields && options.getFiles)
//     throw new Error(
//       '`fields` and `getFiles` can not be used together, please pick only one of the two options',
//     );
//   if (options.fields && !Array.isArray(options.fields))
//     throw new Error('`fields` should be of type array of string');
//   if (options.fields && options.fields.length === 0)
//     throw new Error('`fields` should at least contain one field');

//   if (
//     Number.isInteger(options.compressionLevel) &&
//     (options.compressionLevel < 0 || options.compressionLevel > 9)
//   ) {
//     throw new Error('`compressionlevel` should be a number between 0 and 9');
//   }

//   if (options.fields) {
//     options.fields.forEach(field => {
//       assertIsSupportedType(field, collection);
//     });
//   }

//   if (options.fileName && !options.fileName.endsWith('.zip')) {
//     options.fileName = `${options.fileName.split('.')[0]}.zip`;
//   }

//   // const config: DownloadFilesConfiguration = {
//   //   client: new Client(options.gcs, logger),
//   //   actionName: options.actionName || 'Download all files',
//   //   fields: options.fields,
//   //   getFiles: options.getFiles as unknown as DownloadFilesConfiguration['getFiles'],
//   //   fileName: options.fileName || 'all-files-download',
//   //   compressionLevel: options.compressionLevel,
//   // };

//   // addDownloadAll(collection, config)
// }
