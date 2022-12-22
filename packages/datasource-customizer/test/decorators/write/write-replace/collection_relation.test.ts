/* eslint-disable no-plusplus */
import { Collection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import DataSourceDecorator from '../../../../src/decorators/datasource-decorator';
import WriteReplacerCollectionDecorator from '../../../../src/decorators/write/write-replace/collection';

const caller = factories.caller.build();

describe('WriteDecorator > Create with many to one relation', () => {
  let books: Collection;
  let decoratedBooks: WriteReplacerCollectionDecorator;
  let decoratedAuthors: WriteReplacerCollectionDecorator;

  beforeEach(() => {
    // Books has a many to one relation with authors
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'authors',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build(),
            firstName: factories.columnSchema.build(),
            lastName: factories.columnSchema.build(),

            // This field will have a rewrite rule to alias firstName
            firstNameAlias: factories.columnSchema.build(),
          },
        }),
      }),
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build(),
            authorId: factories.columnSchema.build({ columnType: 'Number' }),
            author: factories.manyToOneSchema.build({
              foreignCollection: 'authors',
              foreignKey: 'authorId',
            }),
            title: factories.columnSchema.build({ columnType: 'String' }),

            // Those fields will have rewrite handler to the corresponding author fields
            authorFirstName: factories.columnSchema.build({ columnType: 'String' }),
            authorLastName: factories.columnSchema.build({ columnType: 'String' }),
          },
        }),
        create: jest.fn().mockImplementation((_, records) => records),
      }),
    ]);

    books = dataSource.getCollection('books');

    const decorated = new DataSourceDecorator(dataSource, WriteReplacerCollectionDecorator);
    decoratedBooks = decorated.getCollection('books');
    decoratedAuthors = decorated.getCollection('authors');
  });

  test('should create the related record when the relation is not set', async () => {
    // This checks that when the handlers write into a many to one relation, the related record
    // is created before the main record.
    const firstNameHandler = jest
      .fn()
      .mockImplementation(value => ({ author: { firstName: value } }));
    const lastNameHandler = jest
      .fn()
      .mockImplementation(value => ({ author: { lastName: value } }));

    decoratedBooks.replaceFieldWriting('authorFirstName', firstNameHandler);
    decoratedBooks.replaceFieldWriting('authorLastName', lastNameHandler);

    await decoratedBooks.create(caller, [
      { title: 'Memories', authorFirstName: 'John', authorLastName: 'Doe' },
      { title: 'Future', authorFirstName: 'Jane', authorLastName: 'Doe' },
    ]);

    expect(books.create).toHaveBeenCalledWith(caller, [
      { title: 'Memories', author: { firstName: 'John', lastName: 'Doe' } },
      { title: 'Future', author: { firstName: 'Jane', lastName: 'Doe' } },
    ]);

    // The handlers should be called with the correct values
    expect(firstNameHandler).toHaveBeenCalledWith(
      'John',
      expect.objectContaining({
        action: 'create',
        record: { title: 'Memories', authorFirstName: 'John', authorLastName: 'Doe' },
      }),
    );
    expect(lastNameHandler).toHaveBeenCalledWith(
      'Doe',
      expect.objectContaining({
        action: 'create',
        record: { title: 'Memories', authorFirstName: 'John', authorLastName: 'Doe' },
      }),
    );
    expect(firstNameHandler).toHaveBeenCalledWith(
      'Jane',
      expect.objectContaining({
        action: 'create',
        record: { title: 'Future', authorFirstName: 'Jane', authorLastName: 'Doe' },
      }),
    );
    expect(lastNameHandler).toHaveBeenCalledWith(
      'Doe',
      expect.objectContaining({
        action: 'create',
        record: { title: 'Future', authorFirstName: 'Jane', authorLastName: 'Doe' },
      }),
    );
  });

  test('should call the handlers of the related collection', async () => {
    // This checks that when writing on a many to one relation, the handlers of the related
    // collection are called.
    const firstNameHandler = jest.fn().mockImplementation(value => ({ firstName: value }));

    decoratedAuthors.replaceFieldWriting('firstNameAlias', firstNameHandler);
    decoratedBooks.replaceFieldWriting('authorFirstName', value => ({
      author: { firstNameAlias: value },
    }));
    decoratedBooks.replaceFieldWriting('authorLastName', value => ({
      author: { lastName: value },
    }));

    await decoratedBooks.create(caller, [
      { title: 'Memories', authorFirstName: 'John', authorLastName: 'Doe' },
    ]);

    expect(books.create).toHaveBeenCalledWith(caller, [
      { title: 'Memories', author: { firstName: 'John', lastName: 'Doe' } },
    ]);

    expect(firstNameHandler).toHaveBeenCalledWith(
      'John',
      expect.objectContaining({ action: 'create', record: { firstNameAlias: 'John' } }),
    );
  });
});
