import Serializer from '../../src/services/serializer';
import * as factories from '../__factories__';

describe('Serializer', () => {
  const setupSerializer = (): Serializer => {
    return new Serializer('/forest');
  };

  describe('With composite pk', () => {
    const dataSource = factories.dataSource.buildWithCollection({
      name: 'person',
      schema: factories.collectionSchema.build({
        fields: {
          birthdate: factories.columnSchema.isPrimaryKey().build(),
          firstName: factories.columnSchema.build(),
          lastName: factories.columnSchema.isPrimaryKey().build(),
        },
      }),
    });

    const person = { birthdate: '1920-01-02', firstName: 'Isaac', lastName: 'Asimov' };
    const serializedPerson = {
      data: {
        type: 'person',
        id: '1920-01-02|Asimov',
        attributes: { birthdate: '1920-01-02', firstName: 'Isaac', lastName: 'Asimov' },
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
    ]);

    const record = {
      isbn: '9780345317988',
      title: 'Foundation',
      authorId: 'asim00',
      author: { id: 'asim00', name: 'Asimov' },
    };

    const serializedRecord = {
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
            books: { links: { related: '/forest/person/asim00/relationships/books' } },
          },
        },
      ],
      jsonapi: { version: '1.0' },
    };

    test('should serialize a record with relations', () => {
      const result = setupSerializer().serialize(dataSource.collections[0], record);
      expect(result).toStrictEqual(serializedRecord);
    });

    test('should deserialize a json api into a record', () => {
      const result = setupSerializer().deserialize(dataSource.collections[0], serializedRecord);

      expect(result).toStrictEqual(record);
    });
  });
});
