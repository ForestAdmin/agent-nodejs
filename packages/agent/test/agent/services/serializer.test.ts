import * as factories from '../__factories__';
import Serializer from '../../../src/agent/services/serializer';

describe('Serializer', () => {
  const setupSerializer = (): Serializer => {
    return new Serializer({ prefix: '/forest' });
  };

  describe('With composite pk', () => {
    const dataSource = factories.dataSource.buildWithCollection({
      name: 'person',
      schema: factories.collectionSchema.build({
        fields: {
          idA: factories.columnSchema.isPrimaryKey().build(),
          firstName: factories.columnSchema.build(),
          idB: factories.columnSchema.isPrimaryKey().build(),
        },
      }),
    });

    const person = {
      idA: '2d162303-78bf-599e-b197-93590ac3d315',
      firstName: 'Isaac',
      idB: '2d162303-78bf-599e-b197-93590ac3d316',
    };
    const serializedPerson = {
      data: {
        type: 'person',
        id: '2d162303-78bf-599e-b197-93590ac3d315|2d162303-78bf-599e-b197-93590ac3d316',
        attributes: {
          idA: '2d162303-78bf-599e-b197-93590ac3d315',
          firstName: 'Isaac',
          idB: '2d162303-78bf-599e-b197-93590ac3d316',
        },
      },
      jsonapi: { version: '1.0' },
    };

    test('should serialize', () => {
      const result = setupSerializer().serialize(dataSource.collections[0], person);
      expect(result).toStrictEqual(serializedPerson);
    });

    test('should deserialize', () => {
      const result = setupSerializer().deserialize(dataSource.collections[0], serializedPerson);
      expect(result).toStrictEqual(person);
    });

    test('should use the serializer cache when a collection schema is already passed', () => {
      const serializer = setupSerializer();
      serializer.deserialize(dataSource.collections[0], serializedPerson);

      const result = serializer.deserialize(dataSource.collections[0], serializedPerson);

      expect(result).toStrictEqual(person);
    });

    describe('when serializer should provide metadata for the search result', () => {
      describe('when the search value has a value', () => {
        test('should serialize with metadata', () => {
          const result = setupSerializer().serializeWithSearchMetadata(
            dataSource.collections[0],
            [person],
            'Isaac',
          );
          expect(result).toStrictEqual({
            data: [
              {
                type: 'person',
                id: '2d162303-78bf-599e-b197-93590ac3d315|2d162303-78bf-599e-b197-93590ac3d316',
                attributes: {
                  idA: '2d162303-78bf-599e-b197-93590ac3d315',
                  firstName: 'Isaac',
                  idB: '2d162303-78bf-599e-b197-93590ac3d316',
                },
              },
            ],
            jsonapi: { version: '1.0' },
            meta: {
              decorators: {
                0: {
                  id: '2d162303-78bf-599e-b197-93590ac3d315|2d162303-78bf-599e-b197-93590ac3d316',
                  search: ['firstName'],
                },
              },
            },
          });
        });

        describe('when the search value does not match any record', () => {
          test('should not add the metadata in the payload', () => {
            const result = setupSerializer().serializeWithSearchMetadata(
              dataSource.collections[0],
              [person],
              'Not Match',
            );
            expect(result).toStrictEqual({
              data: [
                {
                  type: 'person',
                  id: '2d162303-78bf-599e-b197-93590ac3d315|2d162303-78bf-599e-b197-93590ac3d316',
                  attributes: {
                    idA: '2d162303-78bf-599e-b197-93590ac3d315',
                    firstName: 'Isaac',
                    idB: '2d162303-78bf-599e-b197-93590ac3d316',
                  },
                },
              ],
              jsonapi: { version: '1.0' },
            });
          });
        });

        describe('when the search value does not match the first record', () => {
          test('should start the index of the metadata by 0', () => {
            const result = setupSerializer().serializeWithSearchMetadata(
              dataSource.collections[0],
              [
                {
                  firstName: 'NOT MATCH',
                  idA: '2d162303-78bf-599e-b197-93590ac3d315',
                  idB: '2d162303-78bf-599e-b197-93590ac3d316',
                },
                {
                  firstName: 'MATCH',
                  idA: '2d162303-78bf-599e-b197-93590ac3d315',
                  idB: '2d162303-78bf-599e-b197-93590ac3d316',
                },
              ],
              'MATCH',
            );
            expect(result).toStrictEqual({
              jsonapi: {
                version: '1.0',
              },
              data: [
                {
                  type: 'person',
                  id: '2d162303-78bf-599e-b197-93590ac3d315|2d162303-78bf-599e-b197-93590ac3d316',
                  attributes: {
                    firstName: 'NOT MATCH',
                    idA: '2d162303-78bf-599e-b197-93590ac3d315',
                    idB: '2d162303-78bf-599e-b197-93590ac3d316',
                  },
                },
                {
                  type: 'person',
                  id: '2d162303-78bf-599e-b197-93590ac3d315|2d162303-78bf-599e-b197-93590ac3d316',
                  attributes: {
                    firstName: 'MATCH',
                    idA: '2d162303-78bf-599e-b197-93590ac3d315',
                    idB: '2d162303-78bf-599e-b197-93590ac3d316',
                  },
                },
              ],
              meta: {
                decorators: {
                  0: {
                    id: '2d162303-78bf-599e-b197-93590ac3d315|2d162303-78bf-599e-b197-93590ac3d316',
                    search: ['firstName'],
                  },
                },
              },
            });
          });
        });

        describe('when the attribute has a null value', () => {
          test('should not throw an error', () => {
            expect(() =>
              setupSerializer().serializeWithSearchMetadata(
                dataSource.collections[0],
                [
                  {
                    firstName: null,
                    idA: '2d162303-78bf-599e-b197-93590ac3d315',
                    idB: '2d162303-78bf-599e-b197-93590ac3d316',
                  },
                ],
                'Isaac',
              ),
            ).not.toThrow();
          });
        });
      });

      describe('when the search value is empty', () => {
        test('should serialize without metadata', () => {
          const result = setupSerializer().serializeWithSearchMetadata(
            dataSource.collections[0],
            [person],
            '',
          );
          expect(result).toStrictEqual({
            data: [
              {
                type: 'person',
                id: '2d162303-78bf-599e-b197-93590ac3d315|2d162303-78bf-599e-b197-93590ac3d316',
                attributes: {
                  idA: '2d162303-78bf-599e-b197-93590ac3d315',
                  firstName: 'Isaac',
                  idB: '2d162303-78bf-599e-b197-93590ac3d316',
                },
              },
            ],
            jsonapi: { version: '1.0' },
          });
        });
      });

      describe('when the search value is null', () => {
        test('should serialize without metadata', () => {
          const result = setupSerializer().serializeWithSearchMetadata(
            dataSource.collections[0],
            [person],
            null,
          );
          expect(result).toStrictEqual({
            data: [
              {
                type: 'person',
                id: '2d162303-78bf-599e-b197-93590ac3d315|2d162303-78bf-599e-b197-93590ac3d316',
                attributes: {
                  idA: '2d162303-78bf-599e-b197-93590ac3d315',
                  firstName: 'Isaac',
                  idB: '2d162303-78bf-599e-b197-93590ac3d316',
                },
              },
            ],
            jsonapi: { version: '1.0' },
          });
        });
      });
    });
  });

  describe('With relations', () => {
    const setupWithRelation = () => {
      return factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'book',
          schema: factories.collectionSchema.build({
            fields: {
              isbn: factories.columnSchema.isPrimaryKey().build(),
              authorId: factories.columnSchema.build(),
              author: factories.manyToOneSchema.build({
                foreignCollection: 'person',
                foreignKey: 'authorId',
              }),
            },
          }),
        }),
        factories.collection.build({
          name: 'person',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              name: factories.columnSchema.build(),
              books: factories.oneToManySchema.build({
                foreignCollection: 'book',
                originKey: 'authorId',
                originKeyTarget: 'id',
              }),
            },
          }),
        }),
      ]);
    };

    test('serialize should serialize all relations which are provided', () => {
      const result = setupSerializer().serialize(setupWithRelation().collections[0], {
        isbn: '9780345317988',
        title: 'Foundation',
        author: { id: 'asim00', name: 'Asimov' },
      });

      expect(result).toStrictEqual({
        data: {
          type: 'book',
          id: '9780345317988',
          attributes: { isbn: '9780345317988', title: 'Foundation' },
          relationships: { author: { data: { type: 'person', id: 'asim00' } } },
        },
        included: [
          {
            type: 'person',
            id: 'asim00',
            attributes: { id: 'asim00', name: 'Asimov' },
            relationships: {
              books: { links: { related: { href: '/forest/person/asim00/relationships/books' } } },
            },
          },
        ],
        jsonapi: { version: '1.0' },
      });
    });

    describe('when deserialize relationship', () => {
      describe('when uuid relation', () => {
        const setupWithColumnUuidIdRelation = () => {
          return factories.dataSource.buildWithCollections([
            factories.collection.build({
              name: 'book',
              schema: factories.collectionSchema.build({
                fields: {
                  authorId: factories.columnSchema.build({ columnType: 'Uuid' }),
                  author: factories.oneToOneSchema.build({
                    foreignCollection: 'person',
                    originKey: 'authorId',
                  }),
                },
              }),
            }),
            factories.collection.build({
              name: 'person',
              schema: factories.collectionSchema.build({
                fields: {
                  id: factories.columnSchema.isPrimaryKey().build(),
                },
              }),
            }),
          ]);
        };

        test('should properly deserialize', () => {
          const result = setupSerializer().deserialize(
            setupWithColumnUuidIdRelation().collections[0],
            {
              data: {
                type: 'book',
                relationships: {
                  author: { data: { type: 'person', id: '1d162304-78bf-599e-b197-93590ac3d314' } },
                },
              },

              jsonapi: { version: '1.0' },
            },
          );

          // provide the PK in the relation key
          expect(result).toStrictEqual({
            author: ['1d162304-78bf-599e-b197-93590ac3d314'],
          });
        });
      });

      describe('when number relation', () => {
        const setupWithColumnNumberIdRelation = () => {
          return factories.dataSource.buildWithCollections([
            factories.collection.build({
              name: 'book',
              schema: factories.collectionSchema.build({
                fields: {
                  editorId: factories.columnSchema.build({
                    columnType: 'Number',
                  }),
                  editor: factories.manyToOneSchema.build({
                    foreignCollection: 'editor',
                    foreignKey: 'editorId',
                  }),
                },
              }),
            }),
            factories.collection.build({
              name: 'editor',
              schema: factories.collectionSchema.build({
                fields: {
                  id: factories.columnSchema.isPrimaryKey().build({
                    columnType: 'Number',
                  }),
                },
              }),
            }),
          ]);
        };

        test('should properly deserialize', () => {
          const result = setupSerializer().deserialize(
            setupWithColumnNumberIdRelation().collections[0],
            {
              data: {
                type: 'book',
                relationships: {
                  editor: { data: { type: 'editor', id: '42' } },
                },
              },
              jsonapi: { version: '1.0' },
            },
          );

          expect(result).toStrictEqual({ editor: [42] });
        });
      });
    });
  });
});
