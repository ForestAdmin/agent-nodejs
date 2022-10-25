import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import CollectionChartContext from '../../../src/decorators/chart/context';

describe('CollectionChartContext', () => {
  const collection = factories.collection.build({
    name: 'myCollection',
    schema: {
      fields: {
        id1: factories.columnSchema.build({
          isPrimaryKey: true,
          columnType: 'Number',
          filterOperators: new Set(['Equal', 'In']),
        }),
        id2: factories.columnSchema.build({
          isPrimaryKey: true,
          columnType: 'Number',
          filterOperators: new Set(['Equal', 'In']),
        }),
      },
    },
    list: jest.fn().mockResolvedValue([{ id1: 1, id2: 2 }]),
  });

  const context = new CollectionChartContext(collection, factories.caller.build(), [1, 2]);

  test('recordId should throw an error', () => {
    expect(() => context.recordId).toThrowError(
      'Collection is using a composite pk: use `context.compositeRecordId`.',
    );
  });

  test('compositeRecordId should return the recordId', () => {
    expect(context.compositeRecordId).toStrictEqual([1, 2]);
  });

  test('getRecord should return the record', async () => {
    const record = await context.getRecord(['id1', 'id2']);

    expect(record).toStrictEqual({ id1: 1, id2: 2 });
  });
});
