import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import CollectionChartContext from '../../../src/decorators/chart/context';

describe('CollectionChartContext', () => {
  const collection = factories.collection.build({
    name: 'myCollection',
    schema: {
      fields: {
        id1: factories.columnSchema.numericPrimaryKey().build(),
        id2: factories.columnSchema.numericPrimaryKey().build(),
      },
    },
    list: jest.fn().mockResolvedValue([{ id1: 1, id2: 2 }]),
  });

  const context = new CollectionChartContext(collection, factories.caller.build(), [1, 2]);

  test('recordId should throw an error', () => {
    expect(() => context.recordId).toThrow(
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

  describe('parameters', () => {
    test('should return empty object when no context variables are provided', () => {
      const ctx = new CollectionChartContext(collection, factories.caller.build(), [1, 2]);

      expect(ctx.parameters).toStrictEqual({});
    });

    test('should return the context variables when provided', () => {
      const ctx = new CollectionChartContext(collection, factories.caller.build(), [1, 2], {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(ctx.parameters).toStrictEqual({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
    });

    test('should return a frozen object', () => {
      const ctx = new CollectionChartContext(collection, factories.caller.build(), [1, 2], {
        key: 'value',
      });

      expect(() => {
        (ctx.parameters as Record<string, string>).newKey = 'newValue';
      }).toThrow();
    });
  });
});
