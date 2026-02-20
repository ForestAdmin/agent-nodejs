import type { ReplicaDataSourceOptions } from '../../../src';

import { getAllRecords, makeReplicaDataSource } from '../factories';

describe('schema', () => {
  describe('when the schema on a delta strategy is not given', () => {
    it('should detect the schema correctly', async () => {
      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
        .fn()
        .mockResolvedValueOnce({
          more: false,
          newOrUpdatedEntries: [
            { collection: 'contacts', record: { id: 1, name: 'John' } },
            { collection: 'contacts', record: { id: 2, name: 'Jack' } },
          ],
          deletedEntries: [],
        });

      const datasource = await makeReplicaDataSource({
        pullDeltaHandler,
        pullDeltaOnRestart: true,
      });

      const detectedFields = datasource.getCollection('contacts').schema.fields;

      expect(detectedFields).toEqual(
        expect.objectContaining({
          id: expect.objectContaining({ columnType: 'Number', isPrimaryKey: true }),
          name: expect.objectContaining({ columnType: 'String' }),
        }),
      );
    });
  });

  describe('when the schema on a dump strategy is not given', () => {
    it('should compute the schema from the records', async () => {
      const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
        .fn()
        .mockResolvedValueOnce({
          more: false,
          entries: [
            { collection: 'contacts', record: { id: 1, name: 'John' } },
            {
              collection: 'contacts',
              record: {
                id: 2,
                name: 'Jack',
                json: {
                  name: 1,
                },
              },
            },
            {
              collection: 'contacts',
              record: {
                id: 3,
                json: {
                  name: 'Rose',
                },
                objectField: {
                  name: 'Smith',
                  subField: [1, 2, 3],
                  buffer: Buffer.from([0, 0, 0]),
                  date: new Date('1985-10-26T01:22:00-08:00'),
                  nullValue: null,
                },
              },
            },
          ],
        });
      const datasource = await makeReplicaDataSource({ pullDumpHandler });

      const records = await getAllRecords(datasource, 'contacts', [
        'id',
        'name',
        'json',
        'objectField',
      ]);

      expect(records).toEqual([
        { id: 1, json: null, name: 'John', objectField: null },
        { id: 2, json: { name: 1 }, name: 'Jack', objectField: null },
        {
          id: 3,
          json: { name: 'Rose' },
          name: null,
          objectField: {
            name: 'Smith',
            subField: [1, 2, 3],
            buffer: {
              data: expect.any(Array),
              type: 'Buffer',
            },
            date: '1985-10-26T09:22:00.000Z',
            nullValue: null,
          },
        },
      ]);
    });

    describe('when the collection has empty record', () => {
      it('should compute the schema from the records', async () => {
        const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
          .fn()
          .mockResolvedValueOnce({
            more: false,
            entries: [{ collection: 'contacts', record: null }],
          });
        await expect(() => makeReplicaDataSource({ pullDumpHandler })).rejects.toThrow(
          'No primary key found in the schema of the collection contacts',
        );
      });
    });
  });

  describe('test convert', () => {
    it('should create a new collection and a one to many between them', async () => {
      const schema: ReplicaDataSourceOptions['schema'] = [
        {
          name: 'contacts',
          fields: {
            id: { type: 'Number', isPrimaryKey: true },
            binary: { type: 'Binary' },
            boolean: { type: 'Boolean' },
            date: { type: 'Date' },
            dateOnly: { type: 'Dateonly' },
            integer: { type: 'Integer' },
            number: { type: 'Number' },
            string: { type: 'String' },
            enum: { type: 'Enum', enumValues: ['a', 'b', 'c'] },
          },
        },
      ];

      const logger = jest.fn();

      const datasource = await makeReplicaDataSource({ schema, flattenMode: 'auto' }, logger);

      expect(datasource.getCollection('contacts').schema.fields).toEqual({
        id: {
          allowNull: true,
          columnType: 'Number',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isGroupable: true,
          isSortable: true,
          isPrimaryKey: true,
          defaultValue: undefined,
        },
        binary: {
          allowNull: true,
          columnType: 'Binary',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isGroupable: true,
          isSortable: true,
          defaultValue: undefined,
        },
        boolean: {
          allowNull: true,
          columnType: 'Boolean',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isGroupable: true,
          isSortable: true,
          defaultValue: undefined,
        },
        date: {
          allowNull: true,
          columnType: 'Date',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isGroupable: true,
          isSortable: true,
          defaultValue: undefined,
        },
        dateOnly: {
          allowNull: true,
          columnType: 'Dateonly',
          defaultValue: undefined,
          filterOperators: expect.any(Set),
          isReadOnly: undefined,
          isGroupable: true,
          isSortable: true,
          type: 'Column',
          validation: undefined,
        },
        integer: {
          allowNull: true,
          columnType: 'Number',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isGroupable: true,
          isSortable: true,
          defaultValue: undefined,
        },
        number: {
          allowNull: true,
          columnType: 'Number',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isGroupable: true,
          isSortable: true,
          defaultValue: undefined,
        },
        string: {
          allowNull: true,
          columnType: 'String',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isGroupable: true,
          isSortable: true,
          defaultValue: undefined,
        },
        enum: {
          allowNull: true,
          columnType: 'Enum',
          defaultValue: undefined,
          enumValues: expect.any(Array),
          filterOperators: expect.any(Set),
          isReadOnly: undefined,
          isGroupable: true,
          isSortable: true,
          type: 'Column',
          validation: undefined,
        },
      });

      expect(logger).toHaveBeenCalledWith('Debug', 'forest: Initializing cache.');
    });
  });
});
