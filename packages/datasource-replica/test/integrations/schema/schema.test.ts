import { ReplicaDataSourceOptions } from '../../../src';
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
            { collection: 'contacts', record: { id: 1, name: 'f' } },
            { collection: 'contacts', record: { id: 2, name: 'orest' } },
            {
              collection: 'contacts',
              record: {
                id: 3,
                objectField: {
                  name: 'orest',
                  subField: [1, 2, 3],
                },
              },
            },
          ],
        });
      const datasource = await makeReplicaDataSource({ pullDumpHandler });

      const records = await getAllRecords(datasource, 'contacts', ['id', 'name', 'objectField']);

      expect(records).toEqual([
        { id: 1, name: 'f', objectField: null },
        { id: 2, name: 'orest', objectField: null },
        {
          id: 3,
          name: null,
          objectField: {
            name: 'orest',
            subField: [1, 2, 3],
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
          columnType: 'Number',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isSortable: true,
          isPrimaryKey: true,
          defaultValue: undefined,
        },
        binary: {
          columnType: 'Binary',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isSortable: true,
          defaultValue: undefined,
        },
        boolean: {
          columnType: 'Boolean',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isSortable: true,
          defaultValue: undefined,
        },
        date: {
          columnType: 'Date',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isSortable: true,
          defaultValue: undefined,
        },
        integer: {
          columnType: 'Number',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isSortable: true,
          defaultValue: undefined,
        },
        number: {
          columnType: 'Number',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isSortable: true,
          defaultValue: undefined,
        },
        string: {
          columnType: 'String',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isSortable: true,
          defaultValue: undefined,
        },
        enum: {
          columnType: 'Enum',
          defaultValue: undefined,
          enumValues: expect.any(Array),
          filterOperators: expect.any(Set),
          isReadOnly: undefined,
          isSortable: true,
          type: 'Column',
          validation: undefined,
        },
      });

      expect(logger).toHaveBeenCalledWith('Debug', 'forest: Initializing cache.');
    });
  });
});
