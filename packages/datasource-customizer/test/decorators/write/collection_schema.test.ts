import { ColumnSchema } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import WriteDecorator from '../../../src/decorators/write/collection';

describe('WriteDecorator > When their are no relations', () => {
  it('should mark fields as writable', () => {
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            name: factories.columnSchema.build({ isReadOnly: true }),
          },
        }),
      }),
    );

    const collection = dataSource.getCollection('books');
    const decorator = new WriteDecorator(collection, dataSource);
    expect((decorator.schema.fields.name as ColumnSchema).isReadOnly).toEqual(true);

    decorator.replaceFieldWriting('name', () => undefined);
    expect((decorator.schema.fields.name as ColumnSchema).isReadOnly).toEqual(false);
  });
});
