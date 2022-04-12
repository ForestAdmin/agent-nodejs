import * as factories from '../../__factories__';
import { Collection } from '../../../src/interfaces/collection';
import ActionContextBulk from '../../../src/decorators/actions/context/bulk';
import ActionContextSingle from '../../../src/decorators/actions/context/single';
import Filter from '../../../src/interfaces/query/filter/unpaginated';

describe('ActionContext', () => {
  let books: Collection;

  beforeEach(() => {
    books = factories.collection.build({
      dataSource: factories.dataSource.build(),
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({ isPrimaryKey: true }),
          title: factories.columnSchema.build(),
        },
      }),
      list: jest.fn().mockResolvedValue([{ id: 1, title: 'Foundation' }]),
    });
  });

  test('should factorize calls to list made at the same time', async () => {
    const filter = new Filter({ timezone: 'Europe/Paris' });
    const context = new ActionContextSingle(books, {}, filter);
    const [id, partial1, partial2, partial3] = await Promise.all([
      context.getRecordId(),
      context.getRecord(['title']),
      context.getRecord(['id']),
      context.getRecord(['id', 'title']),
    ]);

    expect(books.list).toHaveBeenCalledTimes(1);
    expect(books.list).toHaveBeenCalledWith(filter, ['id', 'title']);
    expect(id).toEqual([1]);
    expect(partial1).toEqual({ title: 'Foundation' });
    expect(partial2).toEqual({ id: 1 });
    expect(partial3).toEqual({ id: 1, title: 'Foundation' });
  });

  test('should track calls mades to formValues', async () => {
    const filter = new Filter({ timezone: 'Europe/Paris' });
    const used = new Set<string>();
    const context = new ActionContextSingle(books, { title: 'Foundation' }, filter, used);

    expect(context.formValues.title).toEqual('Foundation');
    expect(used).toEqual(new Set(['title']));
  });

  test('should throw if form values is written to when tracking', async () => {
    // we check that only for load/change hooks, as in the execute handler it does not
    // matter if the user wants to write there (for instance to put defaults values).

    const filter = new Filter({ timezone: 'Europe/Paris' });
    const used = new Set<string>();
    const context = new ActionContextSingle(books, { title: 'Foundation' }, filter, used);

    expect(() => {
      context.formValues.title = 'toto';
    }).toThrow('formValues is readonly');
  });

  test('should work in bulk mode', async () => {
    const filter = new Filter({ timezone: 'Europe/Paris' });
    const context = new ActionContextBulk(books, { title: 'Foundation' }, filter);

    const [ids, partials] = await Promise.all([
      context.getRecordIds(),
      context.getRecords(['title']),
    ]);
    expect(books.list).toHaveBeenCalledTimes(1);
    expect(ids).toEqual([[1]]);
    expect(partials).toEqual([{ title: 'Foundation' }]);
  });

  test('getrecords should reject all promises if the query fails', async () => {
    (books.list as jest.Mock).mockRejectedValue(new Error('bad request'));

    const filter = new Filter({ timezone: 'Europe/Paris' });
    const context = new ActionContextBulk(books, { title: 'Foundation' }, filter);

    const promise1 = context.getRecords(['title']);
    const promise2 = context.getRecords(['id']);

    await expect(promise1).rejects.toThrow('bad request');
    await expect(promise2).rejects.toThrow('bad request');
  });
});
