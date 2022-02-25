import {
  ConditionTree,
  Filter,
  Operator,
  Page,
  PrimitiveTypes,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';
import { Readable } from 'stream';

import * as factories from '../__factories__';
import CsvGenerator, { PAGE_SIZE } from '../../src/utils/csv-generator';

// eslint-disable-next-line import/prefer-default-export
export const readCsv = async (generator: AsyncGenerator<string>) => {
  const csvResult = [];

  for await (const csv of Readable.from(generator) as Readable) {
    csvResult.push(csv);
  }

  return csvResult;
};

describe('CsvGenerator', () => {
  describe('generate', () => {
    const setup = () => {
      const records = [
        { name: 'ab', id: 1 },
        { name: 'abc', id: 2 },
        { name: 'abd', id: 3 },
        { name: 'abe', id: 4 },
      ];
      const filter = new Filter({
        conditionTree: factories.conditionTreeLeaf.build({
          field: 'id',
          operator: Operator.Equal,
          value: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });
      const collection = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
          },
        }),
      });
      const projection = new Projection('name', 'id');

      return { records, filter, collection, projection };
    };

    test('should call collection list with specified page and sort options', async () => {
      const { records, filter, collection, projection } = setup();

      collection.list = jest.fn().mockResolvedValue(records);

      const generator = CsvGenerator.generate(
        projection,
        'id,name',
        filter,
        collection,
        collection.list,
      );
      await readCsv(generator);

      expect(collection.list).toHaveBeenCalledWith(
        factories.filter.build({
          conditionTree: filter.conditionTree,
          page: new Page(0, 1000),
          sort: new Sort({ ascending: true, field: 'id' }),
        }),
        projection,
      );
    });

    test('should generate all the records as csv format with the header', async () => {
      const { records, filter, collection, projection } = setup();

      collection.list = jest.fn().mockResolvedValue(records);

      const generator = CsvGenerator.generate(
        projection,
        'id,name',
        filter,
        collection,
        collection.list,
      );

      expect(await readCsv(generator)).toEqual(['id,name\n', 'ab,1\nabc,2\nabd,3\nabe,4\n']);
    });

    test('should filter the fields by given a projection in the generated csv', async () => {
      const { filter, collection } = setup();
      const projection = new Projection('name');

      const records = [{ name: 'ab' }, { name: 'abc' }, { name: 'abd' }, { name: 'abe' }];
      collection.list = jest.fn().mockResolvedValue(records);

      const generator = CsvGenerator.generate(
        projection,
        'name',
        filter,
        collection,
        collection.list,
      );

      expect(await readCsv(generator)).toEqual(['name\n', 'ab\nabc\nabd\nabe\n']);
    });

    describe('when there are more records than the PAGE_SIZE', () => {
      const setupWith2PageSizeRecords = () => {
        const projection = new Projection('name', 'id');

        const records = Array.from({ length: PAGE_SIZE * 2 }, (_, n: number) => [
          { name: 'ab', id: n },
        ]);
        const filter = new Filter({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'id',
            operator: Operator.Equal,
            value: '123e4567-e89b-12d3-a456-426614174000',
          }),
        });
        const collection = factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
            },
          }),
        });

        return { records, filter, collection, projection };
      };

      test('should call list collection 3 times', async () => {
        const { records, filter, collection, projection } = setupWith2PageSizeRecords();

        collection.list = jest
          .fn()
          .mockReturnValueOnce(records.slice(0, PAGE_SIZE))
          .mockReturnValueOnce(records.slice(PAGE_SIZE, PAGE_SIZE * 2))
          .mockReturnValueOnce([]);

        const generator = CsvGenerator.generate(
          projection,
          'name',
          filter,
          collection,
          collection.list,
        );
        await readCsv(generator);

        expect(collection.list).toHaveBeenCalledTimes(3);
        expect(collection.list).toHaveBeenCalledWith(
          factories.filter.build({
            conditionTree: expect.any(ConditionTree),
            page: new Page(0, PAGE_SIZE),
            sort: expect.any(Sort),
          }),
          expect.any(Projection),
        );
        expect(collection.list).toHaveBeenCalledWith(
          factories.filter.build({
            conditionTree: expect.any(ConditionTree),
            page: new Page(PAGE_SIZE, PAGE_SIZE),
            sort: expect.any(Sort),
          }),
          expect.any(Projection),
        );
        expect(collection.list).toHaveBeenCalledWith(
          factories.filter.build({
            conditionTree: expect.any(ConditionTree),
            page: new Page(PAGE_SIZE * 2, PAGE_SIZE),
            sort: expect.any(Sort),
          }),
          expect.any(Projection),
        );
      });
    });
  });
});
