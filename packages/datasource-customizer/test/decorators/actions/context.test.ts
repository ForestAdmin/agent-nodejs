import { Collection, Filter } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import ActionContext from '../../../src/decorators/actions/context/base';
import ActionContextSingle from '../../../src/decorators/actions/context/single';

describe('ActionContext', () => {
  let books: Collection;

  beforeEach(() => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        dataSource: factories.dataSource.build(),
        name: 'authors',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.build({ isPrimaryKey: true }),
            firstname: factories.columnSchema.build(),
            lastname: factories.columnSchema.build(),
          },
        }),
      }),
      factories.collection.build({
        dataSource: factories.dataSource.build(),
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.build({ isPrimaryKey: true }),
            title: factories.columnSchema.build(),
            author: factories.manyToOneSchema.build({ foreignCollection: 'authors' }),
          },
        }),
        list: jest
          .fn()
          .mockResolvedValue([
            { id: 1, title: 'Foundation', author: { firstname: 'Isaac', lastname: 'Asimov' } },
          ]),
      }),
    ]);

    books = dataSource.getCollection('books');
  });

  test('should factorize calls to list made at the same time', async () => {
    const caller = factories.caller.build();

    const context = new ActionContextSingle(books, caller, {}, {});
    const [id, partial1, partial2, partial3] = await Promise.all([
      context.getRecordId(),
      context.getRecord(['title']),
      context.getRecord(['id']),
      context.getRecord(['id', 'title']),
    ]);

    expect(books.list).toHaveBeenCalledTimes(1);
    expect(books.list).toHaveBeenCalledWith(caller, new Filter({}), ['id', 'title']);
    expect(id).toEqual(1);
    expect(partial1).toEqual({ title: 'Foundation' });
    expect(partial2).toEqual({ id: 1 });
    expect(partial3).toEqual({ id: 1, title: 'Foundation' });
  });

  test('should track calls mades to formValues', async () => {
    const used = new Set<string>();
    const context = new ActionContextSingle(
      books,
      factories.caller.build(),
      { title: 'Foundation' },
      {},
      used,
    );

    expect(context.formValues.title).toEqual('Foundation');
    expect(used).toEqual(new Set(['title']));
  });

  test('should throw if form values is written to when tracking', async () => {
    // we check that only for load/change hooks, as in the execute handler it does not
    // matter if the user wants to write there (for instance to put defaults values).

    const context = new ActionContextSingle(
      books,
      factories.caller.build(),
      { title: 'Foundation' },
      {},
      new Set<string>(),
    );

    expect(() => {
      context.formValues.title = 'toto';
    }).toThrow('formValues is readonly');
  });

  test('should work in bulk mode', async () => {
    const context = new ActionContext(books, factories.caller.build(), { title: 'Foundation' }, {});
    const [ids, partials] = await Promise.all([
      context.getRecordIds(),
      context.getRecords(['title']),
    ]);

    expect(books.list).toHaveBeenCalledTimes(1);
    expect(ids).toEqual([1]);
    expect(partials).toEqual([{ title: 'Foundation' }]);
  });

  test('getrecords should reject all promises if the query fails', async () => {
    (books.list as jest.Mock).mockRejectedValue(new Error('bad request'));

    const context = new ActionContext(books, factories.caller.build(), { title: 'Foundation' }, {});
    const promise1 = context.getRecords(['title']);
    const promise2 = context.getRecords(['id']);

    await expect(promise1).rejects.toThrow('bad request');
    await expect(promise2).rejects.toThrow('bad request');
  });

  test('should get individual fields', async () => {
    const caller = factories.caller.build();

    const context = new ActionContextSingle(books, caller, {}, {});
    const [id, title, authorFirstName] = await Promise.all([
      context.getField('id'),
      context.getField('title'),
      context.getField('author:firstname'),
    ]);

    expect(books.list).toHaveBeenCalledTimes(1);
    expect(books.list).toHaveBeenCalledWith(caller, new Filter({}), [
      'id',
      'title',
      'author:firstname',
    ]);
    expect(id).toEqual(1);
    expect(title).toEqual('Foundation');
    expect(authorFirstName).toEqual('Isaac');
  });

  test('should throw a specific error is there are no records in the action context', async () => {
    const caller = factories.caller.build();
    (books.list as jest.Mock).mockResolvedValue([]);

    const context = new ActionContextSingle(books, caller, {}, {});

    await expect(context.getRecordIds()).rejects.toThrow(
      'Query with filter did not match any records',
    );
  });
});
