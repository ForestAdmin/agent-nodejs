import {
  ConditionTreeLeaf,
  Page,
  PaginatedFilter,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';

import * as factories from '../__factories__';
import CsvGenerator, { CHUNK_SIZE } from '../../src/utils/csv-generator';
import readCsv from '../__helper__/read-csv';

describe('CsvGenerator', () => {
  describe('generate', () => {
    const setup = () => {
      const records = [
        { name: 'ab', id: 1 },
        { name: 'abc', id: 2 },
        { name: 'abd', id: 3 },
        { name: 'abe', id: 4 },
      ];
      const filter = new PaginatedFilter({
        conditionTree: factories.conditionTreeLeaf.build({
          field: 'id',
          operator: 'Equal',
          value: '123e4567-e89b-12d3-a456-426614174000',
        }),
        sort: new Sort(),
        page: new Page(),
      });
      const collection = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            name: factories.columnSchema.build({ columnType: 'String' }),
          },
        }),
      });
      const projection = new Projection('name', 'id');

      return { records, filter, collection, projection };
    };

    test('should call collection list with specified page and sort options', async () => {
      const { records, filter, collection, projection } = setup();

      collection.list = jest.fn().mockResolvedValue(records);

      const caller = factories.caller.build();
      const generator = CsvGenerator.generate(
        caller,
        projection,
        'id,name',
        filter,
        collection,
        collection.list,
      );
      await readCsv(generator);

      expect(collection.list).toHaveBeenCalledWith(
        caller,
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
        factories.caller.build(),
        projection,
        'id,name',
        filter,
        collection,
        collection.list,
      );

      expect(await readCsv(generator)).toEqual(['id,name\n', 'ab,1\nabc,2\nabd,3\nabe,4']);
    });

    test('should apply the projection in the generated csv', async () => {
      const { filter, collection } = setup();
      const projection = new Projection('name');

      const records = [
        { name: 'ab', otherField: '1' },
        { name: 'abc', otherField: '1' },
        { name: 'abd', otherField: '1' },
        { name: 'abe', otherField: '1' },
      ];
      collection.list = jest.fn().mockResolvedValue(records);

      const generator = CsvGenerator.generate(
        factories.caller.build(),
        projection,
        'name',
        filter,
        collection,
        collection.list,
      );

      expect(await readCsv(generator)).toEqual(['name\n', 'ab\nabc\nabd\nabe']);
    });

    describe('when there are more records than the CHUNK_SIZE', () => {
      const setupWith2ChunkOfRecords = () => {
        const projection = new Projection('name', 'id');

        const records = Array.from({ length: CHUNK_SIZE }, (_, n: number) => [
          { name: 'ab', id: n },
        ]);
        const filter = new PaginatedFilter({
          conditionTree: factories.conditionTreeLeaf.build(),
        });
        const collection = factories.collection.build();

        return { records, filter, collection, projection };
      };

      test('should return all the records by fetching several time the list', async () => {
        const { records, filter, collection, projection } = setupWith2ChunkOfRecords();

        collection.list = jest
          .fn()
          .mockReturnValueOnce(records)
          .mockReturnValueOnce(records)
          .mockReturnValueOnce([]);

        const caller = factories.caller.build();
        const generator = CsvGenerator.generate(
          caller,
          projection,
          'name',
          filter,
          collection,
          collection.list,
        );
        await readCsv(generator);

        expect(collection.list).toHaveBeenCalledTimes(3);
        expect(collection.list).toHaveBeenNthCalledWith(
          1,
          caller,
          factories.filter.build({
            page: new Page(0, CHUNK_SIZE),

            conditionTree: expect.any(ConditionTreeLeaf),
            sort: expect.any(Sort),
          }),
          expect.any(Projection),
        );
        expect(collection.list).toHaveBeenNthCalledWith(
          2,
          caller,
          factories.filter.build({
            page: new Page(CHUNK_SIZE, CHUNK_SIZE),

            conditionTree: expect.any(ConditionTreeLeaf),
            sort: expect.any(Sort),
          }),
          expect.any(Projection),
        );
        expect(collection.list).toHaveBeenNthCalledWith(
          3,
          caller,
          factories.filter.build({
            page: new Page(CHUNK_SIZE * 2, CHUNK_SIZE),

            conditionTree: expect.any(ConditionTreeLeaf),
            sort: expect.any(Sort),
          }),
          expect.any(Projection),
        );
      });

      describe('when there is a page who ask a range of existing records', () => {
        const setupWith2ChunkOfRecordsAndPageFilter = () => {
          const projection = new Projection('name', 'id');

          const records = Array.from({ length: CHUNK_SIZE }, (_, n: number) => [
            { name: 'ab', id: n },
          ]);
          const filter = new PaginatedFilter({
            conditionTree: factories.conditionTreeLeaf.build(),
            page: new Page(500, CHUNK_SIZE * 2),
          });
          const collection = factories.collection.build();

          return { records, filter, collection, projection };
        };

        test('should export all the records asked by the page condition', async () => {
          const { records, filter, collection, projection } =
            setupWith2ChunkOfRecordsAndPageFilter();

          collection.list = jest
            .fn()
            .mockReturnValueOnce(records)
            .mockReturnValueOnce(records)
            .mockReturnValueOnce(records.slice(0, 500));

          const caller = factories.caller.build();
          const generator = CsvGenerator.generate(
            caller,
            projection,
            'name',
            filter,
            collection,
            collection.list,
          );
          await readCsv(generator);

          expect(collection.list).toHaveBeenCalledTimes(3);

          const startedSkipFromGivenPage = 500;
          expect(collection.list).toHaveBeenNthCalledWith(
            1,
            caller,
            factories.filter.build({
              page: new Page(startedSkipFromGivenPage, CHUNK_SIZE),
              conditionTree: expect.any(ConditionTreeLeaf),
              sort: expect.any(Sort),
            }),
            expect.any(Projection),
          );
          expect(collection.list).toHaveBeenNthCalledWith(
            2,
            caller,
            factories.filter.build({
              page: new Page(startedSkipFromGivenPage + CHUNK_SIZE, CHUNK_SIZE),
              conditionTree: expect.any(ConditionTreeLeaf),
              sort: expect.any(Sort),
            }),
            expect.any(Projection),
          );
          expect(collection.list).toHaveBeenNthCalledWith(
            3,
            caller,
            factories.filter.build({
              page: new Page(startedSkipFromGivenPage + CHUNK_SIZE * 2, startedSkipFromGivenPage),

              conditionTree: expect.any(ConditionTreeLeaf),
              sort: expect.any(Sort),
            }),
            expect.any(Projection),
          );
        });
      });
    });
  });
});
