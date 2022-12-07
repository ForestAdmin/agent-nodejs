/* eslint-disable no-plusplus */
import { Collection, ConditionTreeLeaf, Filter, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import DataSourceDecorator from '../../../../src/decorators/datasource-decorator';
import UpdateRelationCollectionDecorator from '../../../../src/decorators/write/update-relations/collection';

const caller = factories.caller.build();
const filter = factories.filter.build();

let authorIdSequence = 0;
let bookIdSequence = 0;

describe('UpdateRelationCollectionDecorator > Many to one relation', () => {
  let books: Collection;
  let authors: Collection;
  let decoratedBooks: UpdateRelationCollectionDecorator;

  beforeEach(() => {
    authorIdSequence = bookIdSequence = 0; // eslint-disable-line no-multi-assign

    // Books has a many to one relation with authors
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'authors',
        schema: factories.collectionSchema.build({
          fields: {
            authorPk: factories.columnSchema.numericPrimaryKey().build(),
            firstName: factories.columnSchema.build(),
            lastName: factories.columnSchema.build(),
          },
        }),
        create: jest
          .fn()
          .mockImplementation((_, records) =>
            records.map(r => ({ ...r, authorPk: ++authorIdSequence })),
          ),
      }),
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            bookPk: factories.columnSchema.numericPrimaryKey().build(),
            authorId: factories.columnSchema.build({ columnType: 'Number' }),
            author: factories.manyToOneSchema.build({
              foreignCollection: 'authors',
              foreignKey: 'authorId',
              foreignKeyTarget: 'authorPk',
            }),
            title: factories.columnSchema.build({ columnType: 'String' }),
          },
        }),
        create: jest
          .fn()
          .mockImplementation((_, records) =>
            records.map(r => ({ ...r, bookPk: ++bookIdSequence })),
          ),
      }),
    ]);

    authors = dataSource.getCollection('authors');
    books = dataSource.getCollection('books');

    const decorated = new DataSourceDecorator(dataSource, UpdateRelationCollectionDecorator);
    decoratedBooks = decorated.getCollection('books');
  });

  test('should pass the call down without changes if no relations are used', async () => {
    await decoratedBooks.update(caller, filter, { title: 'New title' });

    expect(books.update).toHaveBeenCalledWith(caller, filter, { title: 'New title' });
  });

  test('should create the related record when it does not exists', async () => {
    const bookList = books.list as jest.Mock;
    bookList.mockResolvedValueOnce([{ bookPk: 1, author: null }]);

    await decoratedBooks.update(caller, filter, {
      title: 'New title',
      author: { firstName: 'John' },
    });

    // Check that the decorator listed the authors to update
    expect(books.list).toHaveBeenCalledWith(
      caller,
      filter,
      new Projection('bookPk', 'author:authorPk'),
    );

    // Check that the normal update was made
    expect(books.update).toHaveBeenCalledWith(caller, filter, { title: 'New title' });

    // Check that the author was created and the book updated with the new author id
    expect(authors.create).toHaveBeenCalledWith(caller, [{ firstName: 'John' }]);
    expect(books.update).toHaveBeenCalledWith(
      caller,
      new Filter({ conditionTree: new ConditionTreeLeaf('bookPk', 'Equal', 1) }),
      { authorId: 1 },
    );
  });

  test('should update the related record when it exists', async () => {
    const bookList = books.list as jest.Mock;
    bookList.mockResolvedValueOnce([{ bookPk: 1, author: { authorPk: 1 } }]);

    await decoratedBooks.update(caller, filter, {
      title: 'New title',
      author: { firstName: 'John' },
    });

    // Check that the decorator listed the authors to update
    expect(books.list).toHaveBeenCalledWith(
      caller,
      filter,
      new Projection('bookPk', 'author:authorPk'),
    );

    // Check that the update was made on both collections
    expect(books.update).toHaveBeenCalledWith(caller, filter, { title: 'New title' });
    expect(authors.update).toHaveBeenCalledWith(
      caller,
      new Filter({ conditionTree: new ConditionTreeLeaf('authorPk', 'Equal', 1) }),
      { firstName: 'John' },
    );
  });
});
