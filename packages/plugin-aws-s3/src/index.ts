import type { TCollectionName, TSchema } from '@forestadmin/datasource-customizer';

import { SchemaUtils } from '@forestadmin/datasource-toolkit';

import createField from './field/create-field';
import makeFieldDeleteable from './field/make-field-deleteable';
import makeFieldFilterable from './field/make-field-filterable';
import makeFieldRequired from './field/make-field-required';
import makeFieldSortable from './field/make-field-sortable';
import makeFieldWritable from './field/make-field-writable';
import replaceField from './field/replace-field';
import { File, Options } from './types';
import Client from './utils/s3';

export type { Options, File };

export async function createFileField<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
>(dataSource, collection, options?: Options<S, N>): Promise<void> {
  if (!collection) throw new Error('createFileField can only be used on collections.');
  if (!options) throw new Error('Options must be provided.');

  const sourceSchema = SchemaUtils.getField(collection.schema, options.fieldname, collection.name);

  if (!sourceSchema || sourceSchema.type !== 'Column' || sourceSchema.columnType !== 'String') {
    const field = `${collection.name}.${options.fieldname}`;
    throw new Error(`The field '${field}' does not exist or is not a string.`);
  }

  const config = {
    sourcename: options.fieldname,
    filename: `${options.fieldname}__file`,
    client: new Client(options.aws),
    deleteFiles: options?.deleteFiles ?? false,
    readMode: options?.readMode ?? 'url',
    acl: options?.acl ?? 'private',
    storeAt: options?.storeAt ?? ((id, name) => `${collection.name}/${id}/${name}`),
    objectKeyFromRecord: options?.objectKeyFromRecord || null,
  };

  createField(collection, config);
  makeFieldWritable(collection, config);
  makeFieldDeleteable(collection, config);
  makeFieldSortable(collection, config);
  makeFieldFilterable(collection, config);
  makeFieldRequired(collection, config);
  replaceField(collection, config);
}
