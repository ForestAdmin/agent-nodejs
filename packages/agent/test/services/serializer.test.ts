import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';

import * as factories from '../__factories__';
import Serializer from '../../src/services/serializer';

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
  });

  describe('With relations', () => {
    const dataSource = factories.dataSource.buildWithCollections([
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
            editorId: factories.columnSchema.build({
              columnType: PrimitiveTypes.Number,
            }),
            editor: factories.manyToOneSchema.build({
              foreignCollection: 'editor',
              foreignKey: 'editorId',
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
              foreignKey: 'authorId',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'editor',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build({
              columnType: PrimitiveTypes.Number,
            }),
            address: factories.columnSchema.build(),
            books: factories.oneToManySchema.build({
              foreignCollection: 'book',
              foreignKey: 'editorId',
            }),
          },
        }),
      }),
    ]);

    test('serialize should serialize all relations which are provided', () => {
      const result = setupSerializer().serialize(dataSource.collections[0], {
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
      test('should properly deserialize uuid relation', () => {
        const result = setupSerializer().deserialize(dataSource.collections[0], {
          data: {
            type: 'book',
            id: '2d162303-78bf-599e-b197-93590ac3d315',
            attributes: { isbn: '9780345317988', title: 'Foundation' },
            relationships: {
              author: { data: { type: 'person', id: '1d162304-78bf-599e-b197-93590ac3d314' } },
            },
          },
          included: [
            {
              type: 'person',
              id: 'asim00',
              attributes: { id: 'asim00', name: 'Asimov' },
              relationships: {
                books: {
                  links: { related: { href: '/forest/person/asim00/relationships/books' } },
                },
              },
            },
          ],
          jsonapi: { version: '1.0' },
        });

        expect(result).toStrictEqual({
          isbn: '2d162303-78bf-599e-b197-93590ac3d315',
          title: 'Foundation',
          authorId: '1d162304-78bf-599e-b197-93590ac3d314',
        });
      });

      test('should properly deserialize number relation', () => {
        const result = setupSerializer().deserialize(dataSource.collections[0], {
          data: {
            type: 'book',
            id: '2d162303-78bf-599e-b197-93590ac3d315',
            attributes: { title: 'Foundation' },
            relationships: {
              editor: { data: { type: 'editor', id: '42' } },
            },
          },
          jsonapi: { version: '1.0' },
        });

        expect(result).toStrictEqual({
          isbn: '2d162303-78bf-599e-b197-93590ac3d315',
          title: 'Foundation',
          editorId: 42,
        });
      });
    });
  });
});
