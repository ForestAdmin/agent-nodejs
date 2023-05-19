import type {
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';

import createField from './field/create-field';
import makeFieldFilterable from './field/make-field-filterable';
import makeFieldRequired from './field/make-field-required';
import makeFieldSortable from './field/make-field-sortable';
import makeFieldWritable from './field/make-field-writable';
import replaceField from './field/replace-field';
import { Options } from './types';
import Client from './utils/google';

export { Options };

export async function createGoogleDocsField(
  _dataSource: DataSourceCustomizer,
  collection: CollectionCustomizer,
  options?: Options,
): Promise<void> {
  if (!collection) throw new Error('createGoogleDocsField can only be used on collections.');
  if (!options) throw new Error('Options must be provided.');

  const sourceSchema = collection.schema.fields[options.fieldname];

  if (!sourceSchema || sourceSchema.type !== 'Column' || sourceSchema.columnType !== 'String') {
    const field = `${collection.name}.${options.fieldname}`;
    throw new Error(`The field '${field}' does not exist or is not a string.`);
  }

  const config = {
    readMode: options.readMode ?? 'download',
    sourcename: options.fieldname,
    filename: `${options.fieldname}__google-docs`,
    client: new Client(options.google),
  };

  createField(collection, config);
  makeFieldWritable(collection, config);
  makeFieldSortable(collection, config);
  makeFieldFilterable(collection, config);
  makeFieldRequired(collection, config);
  replaceField(collection, config);
}
