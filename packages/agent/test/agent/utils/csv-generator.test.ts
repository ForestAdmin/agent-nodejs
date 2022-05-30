import { Filter, Page, Projection, Sort } from '@forestadmin/datasource-toolkit';

import * as factories from '../__factories__';
import CsvGenerator, { CHUNK_SIZE } from '../../../src/agent/utils/csv-generator';
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
      const filter = new Filter({
        conditionTree: factories.conditionTreeLeaf.build({
          field: 'id',
          operator: 'Equal',
          value: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });
      const collection = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.build({ columnType: 'Number', isPrimaryKey: true }),
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
          page: new Page(0, CHUNK_SIZE, null),
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

        const records = Array.from({ length: CHUNK_SIZE * 2.5 }, (_, n: number) => ({
          id: n,
          name: 'ab',
        }));

        const filter = new Filter({});
        const collection = factories.collection.build({
          schema: {
            fields: {
              id: factories.columnSchema.build({ isPrimaryKey: true, columnType: 'Number' }),
              name: factories.columnSchema.build({ columnType: 'String' }),
            },
          },
        });

        return { records, filter, collection, projection };
      };

      test('should return all the records by fetching several time the list', async () => {
        const { records, filter, collection, projection } = setupWith2ChunkOfRecords();

        collection.list = jest
          .fn()
          .mockReturnValueOnce(records.slice(0, CHUNK_SIZE))
          .mockReturnValueOnce(records.slice(CHUNK_SIZE, CHUNK_SIZE * 2))
          .mockReturnValueOnce(records.slice(CHUNK_SIZE * 2));

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
          {
            page: { skip: 0, limit: CHUNK_SIZE, cursor: null },
            sort: [{ field: 'id', ascending: true }],
          },
          ['name', 'id'],
        );
        expect(collection.list).toHaveBeenNthCalledWith(
          2,
          caller,
          {
            page: { skip: CHUNK_SIZE, limit: CHUNK_SIZE, cursor: [CHUNK_SIZE - 1] },
            sort: [{ field: 'id', ascending: true }],
          },
          ['name', 'id'],
        );
        expect(collection.list).toHaveBeenNthCalledWith(
          3,
          caller,
          {
            page: { skip: CHUNK_SIZE * 2, limit: CHUNK_SIZE, cursor: [CHUNK_SIZE * 2 - 1] },
            sort: [{ field: 'id', ascending: true }],
          },
          ['name', 'id'],
        );
      });
    });
  });
});
