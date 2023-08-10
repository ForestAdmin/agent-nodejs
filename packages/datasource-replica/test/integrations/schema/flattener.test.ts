import { CollectionReplicaSchema, ReplicaDataSourceOptions } from '../../../src';
import { makeReplicaDataSource } from '../factories';

describe('flattener', () => {
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

      await expect(() => makeReplicaDataSource({ schema, flattenMode: 'auto' })).rejects.toThrow(
        'No primary key found',
      );
    });
  });

  describe('when the flattener is in auto mode', () => {
    describe('when the field is an array', () => {
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

    describe('when the field is an object', () => {
      it('should flatten the object', async () => {
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

  describe('when the flattener is in manual mode', () => {
    describe('when the field is an object', () => {
      it('should flatten all the object fields in manual mode', async () => {
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
                    fieldStringArray: [{ type: 'String' }],
                  },
                },
              },
            },
          },
        ];

        const datasource = await makeReplicaDataSource({
          schema,
          flattenMode: 'manual',
        });

        expect(datasource.getCollection('contacts').schema.fields).toEqual({
          id: {
            columnType: 'Number',
            filterOperators: expect.any(Set),
            type: 'Column',
            isSortable: true,
            isPrimaryKey: true,
            defaultValue: undefined,
            isReadOnly: undefined,
            validation: undefined,
          },
          fieldObject: {
            columnType: {
              fields: {
                subObject: {
                  fieldNumber: 'Number',
                  fieldString: 'String',
                  fieldStringArray: expect.any(Array),
                },
              },
            },
            defaultValue: undefined,
            isReadOnly: undefined,
            validation: undefined,
            isSortable: true,
            type: 'Column',
            filterOperators: expect.any(Set),
          },
        });
      });
    });
  });

  describe('with flatten options', () => {
    describe('when the flatten asFields field does not exist', () => {
      it('should throw an error', async () => {
        const addressSchema: CollectionReplicaSchema = {
          name: 'address',
          fields: {
            id: { type: 'Integer', isPrimaryKey: true },
            name: { type: 'String' },
            user: {
              name: { type: 'String' },
            },
          },
        };
        await expect(
          makeReplicaDataSource({
            flattenMode: 'manual',
            flattenOptions: {
              address: { asFields: ['doesnotexist'] },
            },
            schema: [addressSchema],
          }),
        ).rejects.toThrow(
          `Error while computing flattenOptions: Field doesnotexist not found in ${JSON.stringify(
            addressSchema.fields,
          )}`,
        );
      });
    });

    describe('when the flatten options collection key does not exist', () => {
      it('should throw an error', async () => {
        const addressSchema: CollectionReplicaSchema = {
          name: 'address',
          fields: {
            id: { type: 'Integer', isPrimaryKey: true },
            name: { type: 'String' },
            user: {
              name: { type: 'String' },
            },
          },
        };
        await expect(
          makeReplicaDataSource({
            flattenMode: 'manual',
            flattenOptions: {
              doesnotexist: { asModels: ['editor'] },
            },
            schema: [addressSchema],
          }),
        ).rejects.toThrow(
          'Error while computing flattenOptions: Collection doesnotexist not found in schema',
        );
      });
    });

    it('should flatten all fields', async () => {
      const datasource = await makeReplicaDataSource({
        schema: [
          {
            name: 'agencies',
            fields: {
              id: { type: 'Integer', isPrimaryKey: true },
              name: { type: 'String' },
            },
          },
          {
            name: 'authors',
            fields: {
              id: { type: 'Integer', isPrimaryKey: true },
              name: { type: 'String' },
            },
          },
          {
            name: 'books',
            fields: {
              id: { type: 'Integer', isPrimaryKey: true },
              title: { type: 'String' },
              editor: {
                name: { type: 'String' },
                address: { type: 'String' },
              },
              authors: [
                {
                  type: 'Integer',
                  reference: {
                    targetCollection: 'authors',
                    relationName: 'authors',
                    targetField: 'id',
                  },
                },
              ],
              prices: {
                fields: {
                  id: { type: 'Integer', isPrimaryKey: true },
                  name: { type: 'String' },
                },
              },
            },
          },
        ],
        flattenMode: 'manual',
        flattenOptions: {
          books: { asModels: ['authors'], asFields: ['id', 'prices'] },
        },
      });

      expect(datasource.getCollection('books').schema.fields).toEqual({
        authors: {
          foreignCollection: 'books_authors',
          originKey: '_fpid',
          originKeyTarget: 'id',
          type: 'OneToMany',
        },
        editor: {
          columnType: {
            address: 'String',
            name: 'String',
          },
          defaultValue: undefined,
          filterOperators: expect.any(Set),
          isReadOnly: undefined,
          isSortable: true,
          type: 'Column',
          validation: undefined,
        },
        'prices@@@fields.id': {
          columnType: 'Number',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isSortable: true,
          isPrimaryKey: true,
          defaultValue: undefined,
        },
        'prices@@@fields.name': {
          columnType: 'String',
          filterOperators: expect.any(Set),
          type: 'Column',
          validation: undefined,
          isReadOnly: undefined,
          isSortable: true,
          defaultValue: undefined,
        },
        id: {
          columnType: 'Number',
          defaultValue: undefined,
          filterOperators: expect.any(Set),
          isPrimaryKey: true,
          isReadOnly: undefined,
          isSortable: true,
          type: 'Column',
          validation: undefined,
        },
        title: {
          columnType: 'String',
          defaultValue: undefined,
          filterOperators: expect.any(Set),
          isReadOnly: undefined,
          isSortable: true,
          type: 'Column',
          validation: undefined,
        },
      });
    });
  });
});
