import { ColumnSchema, DataSource } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import WriteDecorator from '../../../../src/decorators/write/write-replace/collection';

describe('WriteDecorator > When their are no relations', () => {
  let dataSource: DataSource;

  beforeEach(() => {
    dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            name: factories.columnSchema.build({ isReadOnly: true }),
          },
        }),
      }),
    );
  });

  it('should throw when rewriting an inexistant field', () => {
    const collection = dataSource.getCollection('books');
    const decorator = new WriteDecorator(collection, dataSource);

    expect(() => decorator.replaceFieldWriting('inexistant', () => ({}))).toThrow(
      "Column not found: 'books.inexistant'",
    );
  });

  it('should mark fields as writable when handler is defined', () => {
    const collection = dataSource.getCollection('books');
    const decorator = new WriteDecorator(collection, dataSource);

    expect((collection.schema.fields.name as ColumnSchema).isReadOnly).toEqual(true);
    expect((decorator.schema.fields.name as ColumnSchema).isReadOnly).toEqual(true);

    decorator.replaceFieldWriting('name', () => undefined);

    expect((collection.schema.fields.name as ColumnSchema).isReadOnly).toEqual(true);
    expect((decorator.schema.fields.name as ColumnSchema).isReadOnly).toEqual(false);
  });

  it('should throw an error when definition is null', () => {
    const collection = dataSource.getCollection('books');
    const decorator = new WriteDecorator(collection, dataSource);

    expect((collection.schema.fields.name as ColumnSchema).isReadOnly).toEqual(true);
    expect((decorator.schema.fields.name as ColumnSchema).isReadOnly).toEqual(true);

    expect(() => decorator.replaceFieldWriting('name', null)).toThrow(
      'definition handler is required',
    );
  });

  it('should mark fields as readonly when handler is null', () => {
    const collection = dataSource.getCollection('books');
    const decorator = new WriteDecorator(collection, dataSource);

    expect((collection.schema.fields.name as ColumnSchema).isReadOnly).toEqual(true);
    expect((decorator.schema.fields.name as ColumnSchema).isReadOnly).toEqual(true);

    decorator.disableFieldWriting('name');

    expect((collection.schema.fields.name as ColumnSchema).isReadOnly).toEqual(true);
    expect((decorator.schema.fields.name as ColumnSchema).isReadOnly).toEqual(true);
  });
});
