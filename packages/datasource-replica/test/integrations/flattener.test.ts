import { makeReplicaDataSource } from './factories';
import { ReplicaDataSourceOptions } from '../../src';

describe('flattener', () => {
  describe('when the flattener is in auto mode', () => {
    describe('when the field is an array', () => {
      describe('when there is no primary key', () => {
        it('should throw an error', async () => {
          const schema: ReplicaDataSourceOptions['schema'] = [
            {
              name: 'contacts',
              fields: {
                fieldArray: [{ type: 'String' }],
              },
            },
          ];

          await expect(() =>
            makeReplicaDataSource({ schema, flattenMode: 'auto' }),
          ).rejects.toThrow('No primary key found');
        });
      });

      it('should create a new collection and a one to many between them', async () => {
        const schema: ReplicaDataSourceOptions['schema'] = [
          {
            name: 'contacts',
            fields: {
              id: { type: 'Number', isPrimaryKey: true },
              fieldArray: [{ type: 'String' }],
            },
          },
        ];

        const datasource = await makeReplicaDataSource({ schema, flattenMode: 'auto' });

        expect(datasource.getCollection('contacts').schema.fields).toEqual({
          id: {
            columnType: 'Number',
            filterOperators: expect.any(Set),
            type: 'Column',
            isSortable: true,
            isPrimaryKey: true,
          },
          fieldArray: {
            foreignCollection: 'contacts_fieldArray',
            originKey: '_fpid',
            originKeyTarget: 'id',
            type: 'OneToMany',
          },
        });

        expect(datasource.getCollection('contacts_fieldArray').schema.fields).toEqual({
          value: {
            columnType: 'String',
            filterOperators: expect.any(Set),

            type: 'Column',
            isSortable: true,
          },
          _fid: {
            columnType: 'String',
            filterOperators: expect.any(Set),

            type: 'Column',
            isSortable: true,
            isPrimaryKey: true,
          },
          _fpid: {
            columnType: 'Number',
            filterOperators: expect.any(Set),

            type: 'Column',
            isSortable: true,
          },
          parent: {
            foreignCollection: 'contacts',
            foreignKey: '_fpid',
            foreignKeyTarget: 'id',
            type: 'ManyToOne',
          },
        });
      });
    });
  });

  describe('when the field is an object', () => {
    it('should flatten all the object fields', async () => {
      const schema: ReplicaDataSourceOptions['schema'] = [
        {
          name: 'contacts',
          fields: {
            id: { type: 'Number', isPrimaryKey: true },
            fieldObject: {
              fields: {
                subObject: {
                  fieldNumber: { type: 'Number' },
                  fieldString: { type: 'String' },
                },
              },
            },
          },
        },
      ];

      const datasource = await makeReplicaDataSource({ schema, flattenMode: 'auto' });

      expect(datasource.getCollection('contacts').schema.fields).toEqual({
        id: {
          columnType: 'Number',
          filterOperators: expect.any(Set),
          type: 'Column',
          isSortable: true,
          isPrimaryKey: true,
        },
        'fieldObject@@@fields.subObject.fieldString': {
          columnType: 'String',
          filterOperators: expect.any(Set),
          type: 'Column',
          isSortable: true,
        },
        'fieldObject@@@fields.subObject.fieldNumber': {
          columnType: 'Number',
          filterOperators: expect.any(Set),
          type: 'Column',
          isSortable: true,
        },
      });
    });
  });
});
